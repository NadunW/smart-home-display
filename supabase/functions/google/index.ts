// Google Calendar sync. Holds the Google client secret and everyone's tokens; the browser never sees them.
//
// POST (signed-in app users; this function checks the JWT itself, see below)
//   { action: "connect", household, person_id?, return_to, tz } -> { url }  (open it to sign in with Google)
//   { action: "sync", household, tz, force? }                    -> { accounts, errors }
//   { action: "push", item, tz }                                 -> { ok }  (after saving an appointment/reminder)
//   { action: "remove", household, account, cal, event }         -> { ok }  (before deleting one)
//   { action: "disconnect", account }                            -> { ok }
// GET ?code=…&state=…  Google sends the browser back here after sign-in; we store the account
//   and send the browser on to the app (return_to?gcal=ok).
//
// Deployed with "Verify JWT" OFF, because Google's redirect carries no Supabase login.
// Every POST action checks the caller's login and family membership itself.
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Redirect URI to register at Google:
//   https://<project-ref>.supabase.co/functions/v1/google

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secretKey();
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || SERVICE;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const SELF = `${SB_URL}/functions/v1/google`;
const CAL = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly", // the list of calendars
  "https://www.googleapis.com/auth/calendar.events", // read and write events
];
const DAY = 864e5;
const SYNC_EVERY_MS = 90_000; // several displays may ask at once; one sync per account per 90 s
const PAST_DAYS = 2, FUTURE_DAYS = 62;

function secretKey(): string {
  try {
    const k = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    return k.default ?? Object.values(k)[0] ?? "";
  } catch {
    return "";
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

class Fail extends Error {
  constructor(msg: string, public status = 400) {
    super(msg);
  }
}
class Reconnect extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, what: string): string => {
  if (typeof v !== "string" || !UUID.test(v)) throw new Fail(`Missing or bad ${what}`);
  return v;
};

// ---------- database (service role, bypasses row-level security) ----------
async function db(path: string, method = "GET", body?: unknown, prefer = "return=representation"): Promise<any> {
  const headers: Record<string, string> = { apikey: SERVICE, "Content-Type": "application/json", Prefer: prefer };
  if (!SERVICE.startsWith("sb_")) headers.Authorization = `Bearer ${SERVICE}`;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Database ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

async function caller(req: Request): Promise<string> {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new Fail("Sign in first", 401);
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) throw new Fail("Sign in first", 401);
  const u = await r.json();
  if (!u?.id) throw new Fail("Sign in first", 401);
  return u.id;
}

async function role(uid: string, household: string): Promise<string> {
  const rows = await db(`household_users?select=role&household_id=eq.${household}&user_id=eq.${uid}`);
  if (!rows.length) throw new Fail("Not a member of this family", 403);
  return rows[0].role;
}

const goodTz = (tz: unknown): string | null => {
  if (typeof tz !== "string" || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
};

// ---------- signed state for the Google redirect ----------
const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function sign(s: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SERVICE + "|google-state"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(s))));
}
async function makeState(p: Record<string, unknown>): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(p)));
  return body + "." + await sign(body);
}
async function readState(s: string): Promise<any> {
  const [body, sig] = s.split(".");
  if (!body || !sig || sig !== await sign(body)) throw new Fail("Bad sign-in link");
  const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
  if (!(p.x > Date.now())) throw new Fail("The sign-in took too long. Try again.");
  return p;
}

// ---------- Google ----------
async function tokenRequest(params: Record<string, string>): Promise<any> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === "invalid_grant") throw new Reconnect("Google access was withdrawn or expired");
    throw new Error(`Google sign-in failed (${r.status} ${j.error ?? ""})`);
  }
  return j;
}

async function accessToken(accountId: string): Promise<string> {
  const [t] = await db(`google_tokens?account_id=eq.${accountId}&select=*`);
  if (!t) throw new Reconnect("No Google token stored");
  if (t.access_token && t.expires_at && Date.parse(t.expires_at) > Date.now() + 60_000) return t.access_token;
  let j: any;
  try {
    j = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
  } catch (e) {
    if (e instanceof Reconnect) await db(`google_accounts?id=eq.${accountId}`, "PATCH", { sync_error: "reconnect" }, "return=minimal").catch(() => {});
    throw e;
  }
  await db(`google_tokens?account_id=eq.${accountId}`, "PATCH", {
    access_token: j.access_token,
    expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
  }, "return=minimal");
  return j.access_token;
}

async function gapi(token: string, path: string, method = "GET", body?: unknown): Promise<{ status: number; data: any }> {
  const r = await fetch(CAL + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (r.status === 401) throw new Reconnect("Google said the login is no longer valid");
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
}
const calPath = (cal: string) => `/calendars/${encodeURIComponent(cal)}/events`;

async function calendarList(token: string): Promise<any[]> {
  const out: any[] = [];
  let page = "";
  do {
    const { status, data } = await gapi(token, `/users/me/calendarList?maxResults=250${page ? "&pageToken=" + encodeURIComponent(page) : ""}`);
    if (status !== 200) throw new Error(`Couldn't read the calendar list (${status})`);
    out.push(...(data.items ?? []));
    page = data.nextPageToken ?? "";
  } while (page);
  return out;
}

// Keep the family's choices (which calendars show) when the list is read again.
function mergeCalendars(list: any[], old: any[] = []): any[] {
  const prev = new Map(old.map((c) => [c.id, c]));
  return list.filter((c) => !c.deleted).map((c) => ({
    id: c.id,
    name: String(c.summaryOverride ?? c.summary ?? c.id).slice(0, 80),
    color: c.backgroundColor ?? null,
    primary: !!c.primary,
    write: c.accessRole === "owner" || c.accessRole === "writer",
    show: prev.has(c.id) ? !!prev.get(c.id).show : !!c.primary,
  }));
}

// ---------- connect ----------
async function connect(uid: string, b: any): Promise<Response> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Fail("Google Calendar isn't set up on the server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", 500);
  const household = uuid(b.household, "family");
  await role(uid, household);
  const person = b.person_id ? uuid(b.person_id, "person") : null;
  const ret = String(b.return_to ?? "");
  if (!/^https?:\/\//.test(ret) || ret.length > 500) throw new Fail("Bad return address");
  const state = await makeState({ u: uid, h: household, p: person, r: ret, tz: goodTz(b.tz), x: Date.now() + 15 * 6e4 });
  const q = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: SELF,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account", // always hands out a refresh token, and lets you pick the account
    include_granted_scopes: "true",
    state,
  });
  return json({ url: "https://accounts.google.com/o/oauth2/v2/auth?" + q });
}

function back(ret: string, params: Record<string, string>): Response {
  let u: URL;
  try {
    u = new URL(ret);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    return new Response(params.gcal === "ok" ? "Google Calendar connected. You can close this page." : "Couldn't connect Google Calendar: " + (params.why ?? ""), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return new Response(null, { status: 303, headers: { Location: u.href } });
}

async function callback(url: URL): Promise<Response> {
  let st: any;
  try {
    st = await readState(url.searchParams.get("state") ?? "");
  } catch (e) {
    return new Response("Couldn't connect Google Calendar: " + (e as Error).message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const err = url.searchParams.get("error");
  if (err) return back(st.r, { gcal: "error", why: err === "access_denied" ? "denied" : err });
  try {
    await role(st.u, st.h);
    const tok = await tokenRequest({ code: url.searchParams.get("code") ?? "", redirect_uri: SELF, grant_type: "authorization_code" });
    const granted = String(tok.scope ?? "").split(" ");
    if (!granted.includes("https://www.googleapis.com/auth/calendar.events") || !granted.includes("https://www.googleapis.com/auth/calendar.readonly")) {
      return back(st.r, { gcal: "error", why: "scopes" });
    }
    const id = JSON.parse(new TextDecoder().decode(unb64u(String(tok.id_token ?? "").split(".")[1] ?? "")));
    if (!id.sub) throw new Error("Google didn't say which account this is");
    const cals = await calendarList(tok.access_token);
    const [old] = await db(`google_accounts?household_id=eq.${st.h}&google_sub=eq.${encodeURIComponent(id.sub)}&select=*`);
    const calendars = mergeCalendars(cals, old?.calendars);
    const primary = calendars.find((c) => c.primary)?.id ?? calendars.find((c) => c.write)?.id ?? null;
    const fields: Record<string, unknown> = {
      user_id: st.u,
      email: String(id.email ?? "").slice(0, 200),
      calendars,
      write_cal: old?.write_cal && calendars.some((c) => c.id === old.write_cal && c.write) ? old.write_cal : primary,
      sync_error: null,
      synced_at: null,
      ...(st.tz ? { tz: st.tz } : {}),
    };
    if (st.p || !old) fields.person_id = st.p ?? null;
    let acc: any;
    if (old) [acc] = await db(`google_accounts?id=eq.${old.id}`, "PATCH", fields);
    else [acc] = await db("google_accounts", "POST", { household_id: st.h, google_sub: id.sub, ...fields });
    const token = {
      account_id: acc.id,
      access_token: tok.access_token,
      expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
      ...(tok.refresh_token ? { refresh_token: tok.refresh_token } : {}),
    };
    if (!tok.refresh_token && !old) throw new Error("Google didn't hand out a refresh token");
    if (old && !tok.refresh_token) await db(`google_tokens?account_id=eq.${acc.id}`, "PATCH", token, "return=minimal");
    else await db("google_tokens?on_conflict=account_id", "POST", token, "resolution=merge-duplicates,return=minimal");
    try {
      await syncAccount(acc, true);
    } catch (e) {
      console.error("first sync", e);
    }
    return back(st.r, { gcal: "ok" });
  } catch (e) {
    console.error("callback", e);
    return back(st.r, { gcal: "error", why: "failed" });
  }
}

// ---------- Google event <-> display item ----------
const two = (n: number) => String(n).padStart(2, "0");
// Adds minutes to a local "YYYY-MM-DDTHH:MM" without any time zone shifting.
function addMin(date: string, time: string, min: number): { date: string; time: string } {
  const [y, m, d] = date.split("-").map(Number), [hh, mm] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) + min * 6e4);
  return { date: `${t.getUTCFullYear()}-${two(t.getUTCMonth() + 1)}-${two(t.getUTCDate())}`, time: `${two(t.getUTCHours())}:${two(t.getUTCMinutes())}` };
}

// events.list is asked for times in the family's time zone, so the local date and time are in the string.
function fromGoogle(ev: any): { date: string; time: string | null; dur_min: number | null } | null {
  const s = ev.start ?? {}, e = ev.end ?? {};
  if (s.dateTime) {
    const dur = e.dateTime ? Math.round((Date.parse(e.dateTime) - Date.parse(s.dateTime)) / 6e4) : null;
    return { date: s.dateTime.slice(0, 10), time: s.dateTime.slice(11, 16), dur_min: dur !== null && dur >= 0 && dur <= 20160 ? dur : null };
  }
  if (s.date) {
    const days = e.date ? Math.round((Date.parse(e.date) - Date.parse(s.date)) / DAY) : 1;
    return { date: s.date, time: null, dur_min: days > 1 && days <= 14 ? days * 1440 : null };
  }
  return null;
}
const eventKey = (ev: any) => {
  const o = ev.originalStartTime;
  return String(ev.iCalUID ?? ev.id) + (o ? "|" + (o.dateTime ?? o.date) : "");
};

function toGoogle(it: any, tz: string): any {
  const isRem = it.type === "reminder";
  const body: any = {
    summary: it.title,
    extendedProperties: { private: { fhd_type: isRem ? "reminder" : "event" } },
    reminders: isRem && it.time ? { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] } : { useDefault: true },
  };
  if (it.time) {
    const time = String(it.time).slice(0, 5), end = addMin(it.date, time, it.dur_min ?? (isRem ? 15 : 60));
    body.start = { dateTime: `${it.date}T${time}:00`, timeZone: tz };
    body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone: tz };
  } else {
    const days = Math.max(1, Math.round((it.dur_min ?? 1440) / 1440));
    body.start = { date: it.date };
    body.end = { date: addMin(it.date, "00:00", days * 1440).date };
  }
  return body;
}

// ---------- sync: Google -> display ----------
async function listEvents(token: string, cal: string, tz: string): Promise<any[] | null> {
  const out: any[] = [];
  let page = "";
  do {
    const q = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: new Date(Date.now() - PAST_DAYS * DAY).toISOString(),
      timeMax: new Date(Date.now() + FUTURE_DAYS * DAY).toISOString(),
      timeZone: tz,
      maxResults: "250",
    });
    if (page) q.set("pageToken", page);
    const { status, data } = await gapi(token, `${calPath(cal)}?${q}`);
    if (status !== 200) return null; // calendar gone or unreadable: leave its items alone
    out.push(...(data.items ?? []));
    page = data.nextPageToken ?? "";
  } while (page && out.length < 2500);
  return out;
}

async function syncAccount(acc: any, force = false): Promise<void> {
  if (!force && acc.synced_at && Date.now() - Date.parse(acc.synced_at) < SYNC_EVERY_MS) return;
  // Claim this round first, so a second display asking at the same moment skips it.
  await db(`google_accounts?id=eq.${acc.id}`, "PATCH", { synced_at: new Date().toISOString() }, "return=minimal");
  try {
    const token = await accessToken(acc.id);
    const tz = goodTz(acc.tz) ?? "Europe/Stockholm";
    const shown = (acc.calendars ?? []).filter((c: any) => c.show).map((c: any) => c.id);
    const mine: any[] = await db(`items?gcal_account=eq.${acc.id}&select=id,type,title,date,time,dur_min,gcal_cal,gcal_event,gcal_key,updated_at,created_by`);
    const byEvent = new Map(mine.map((r) => [`${r.gcal_cal}\n${r.gcal_event}`, r]));
    const seen = new Set<string>(), listed = new Set<string>(), add: any[] = [];
    for (const cal of shown) {
      const events = await listEvents(token, cal, tz);
      if (!events) continue;
      listed.add(cal);
      for (const ev of events) {
        if (ev.status === "cancelled") continue;
        const when = fromGoogle(ev);
        if (!when) continue;
        const row = byEvent.get(`${cal}\n${ev.id}`);
        const title = String(ev.summary ?? "").trim().slice(0, 120) || "(No title)";
        if (row) {
          seen.add(row.id);
          const cur = { title: row.title, date: row.date, time: row.time ? String(row.time).slice(0, 5) : null, dur_min: row.dur_min };
          const next = { title, ...when, gcal_key: eventKey(ev) };
          const changed = cur.title !== next.title || cur.date !== next.date || cur.time !== next.time || cur.dur_min !== next.dur_min;
          // A change made on the display after Google's last change wins (it's on its way to Google).
          if (changed && Date.parse(ev.updated ?? 0) > Date.parse(row.updated_at)) {
            await db(`items?id=eq.${row.id}`, "PATCH", next, "return=minimal").catch((e) => console.error("update", e));
          }
        } else if (ev.extendedProperties?.private?.fhd_type !== "reminder") {
          // A reminder made on the display and dismissed there stays dismissed.
          add.push({
            household_id: acc.household_id,
            type: "event",
            title,
            person_id: acc.person_id ?? null,
            ...when,
            gcal_account: acc.id,
            gcal_cal: cal,
            gcal_event: ev.id,
            gcal_key: eventKey(ev),
            created_by: null,
          });
        }
      }
    }
    // Shown once per family: if another member's calendar already brought this event, skip it.
    for (let i = 0; i < add.length; i += 200) {
      await db("items?on_conflict=household_id,gcal_key", "POST", add.slice(i, i + 200), "resolution=ignore-duplicates,return=minimal");
    }
    // Gone from Google (deleted, or moved out of the window), or its calendar is no longer shown.
    const from = new Date(Date.now() - (PAST_DAYS - 1) * DAY).toISOString().slice(0, 10);
    const to = new Date(Date.now() + (FUTURE_DAYS - 1) * DAY).toISOString().slice(0, 10);
    const gone = mine.filter((r) =>
      (listed.has(r.gcal_cal) && !seen.has(r.id) && r.date && r.date >= from && r.date <= to && r.gcal_event) ||
      (!shown.includes(r.gcal_cal) && r.created_by === null)
    ).map((r) => r.id);
    for (let i = 0; i < gone.length; i += 100) await db(`items?id=in.(${gone.slice(i, i + 100).join(",")})`, "DELETE", undefined, "return=minimal");
    await db(`google_accounts?id=eq.${acc.id}`, "PATCH", { sync_error: null }, "return=minimal");
  } catch (e) {
    const msg = e instanceof Reconnect ? "reconnect" : String((e as Error).message ?? e).slice(0, 200);
    await db(`google_accounts?id=eq.${acc.id}`, "PATCH", { sync_error: msg }, "return=minimal").catch(() => {});
    throw e;
  }
}

async function sync(uid: string, b: any): Promise<Response> {
  const household = uuid(b.household, "family");
  await role(uid, household);
  const accounts: any[] = await db(`google_accounts?household_id=eq.${household}&select=*`);
  const errors: string[] = [];
  for (const acc of accounts) {
    try {
      await syncAccount(acc, !!b.force);
    } catch (e) {
      errors.push(`${acc.email}: ${e instanceof Reconnect ? "connect again" : (e as Error).message}`);
    }
  }
  return json({ accounts: accounts.length, errors });
}

// ---------- push: display -> Google ----------
async function push(uid: string, b: any): Promise<Response> {
  const id = uuid(b.item, "item");
  const [it] = await db(`items?id=eq.${id}&select=*`);
  if (!it) return json({ ok: true, skipped: "gone" });
  await role(uid, it.household_id);
  let acc: any = null;
  if (it.gcal_account) [acc] = await db(`google_accounts?id=eq.${it.gcal_account}&select=*`);
  else if (it.person_id) {
    [acc] = await db(`google_accounts?household_id=eq.${it.household_id}&person_id=eq.${it.person_id}&write_cal=not.is.null&select=*&order=created_at&limit=1`);
  }
  if (!acc || acc.household_id !== it.household_id) return json({ ok: true, skipped: "no calendar" });
  const tz = goodTz(b.tz) ?? goodTz(acc.tz) ?? "Europe/Stockholm";
  const token = await accessToken(acc.id);
  const wanted = (it.type === "event" || it.type === "reminder") && !!it.date;

  if (it.gcal_event) {
    const path = `${calPath(it.gcal_cal)}/${encodeURIComponent(it.gcal_event)}`;
    if (!wanted) { // turned into a task, or lost its date: take it out of Google
      await gapi(token, path, "DELETE");
      await db(`items?id=eq.${it.id}`, "PATCH", { gcal_account: null, gcal_cal: null, gcal_event: null, gcal_key: null, dur_min: null }, "return=minimal");
      return json({ ok: true });
    }
    const r = await gapi(token, path, "PATCH", toGoogle(it, tz));
    if (r.status === 200) return json({ ok: true });
    if (r.status !== 404 && r.status !== 410) throw new Error(`Google answered ${r.status}`);
    // deleted in Google meanwhile: fall through and create it again
  }
  if (!wanted || !acc.write_cal) return json({ ok: true, skipped: "nothing to send" });
  const r = await gapi(token, calPath(acc.write_cal), "POST", toGoogle(it, tz));
  if (r.status !== 200) throw new Error(`Google answered ${r.status}`);
  await db(`items?id=eq.${it.id}`, "PATCH", {
    gcal_account: acc.id,
    gcal_cal: acc.write_cal,
    gcal_event: r.data.id,
    gcal_key: eventKey(r.data),
  }, "return=minimal");
  return json({ ok: true });
}

async function remove(uid: string, b: any): Promise<Response> {
  const household = uuid(b.household, "family"), account = uuid(b.account, "account");
  await role(uid, household);
  const [acc] = await db(`google_accounts?id=eq.${account}&select=id,household_id`);
  if (!acc || acc.household_id !== household) return json({ ok: true, skipped: "no calendar" });
  if (typeof b.cal !== "string" || typeof b.event !== "string" || !b.cal || !b.event) throw new Fail("Missing event");
  const token = await accessToken(acc.id);
  const r = await gapi(token, `${calPath(b.cal)}/${encodeURIComponent(b.event)}`, "DELETE");
  if (r.status >= 300 && r.status !== 404 && r.status !== 410) throw new Error(`Google answered ${r.status}`);
  return json({ ok: true });
}

async function disconnect(uid: string, b: any): Promise<Response> {
  const account = uuid(b.account, "account");
  const [acc] = await db(`google_accounts?id=eq.${account}&select=*`);
  if (!acc) return json({ ok: true });
  const r = await role(uid, acc.household_id);
  if (acc.user_id !== uid && r !== "owner") throw new Fail("Only the person who connected it (or the family's creator) can disconnect it", 403);
  const [t] = await db(`google_tokens?account_id=eq.${acc.id}&select=refresh_token`);
  if (t) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: t.refresh_token }) }).catch(() => {});
  // What came from Google goes; what was made on the display stays, just no longer linked.
  await db(`items?gcal_account=eq.${acc.id}&created_by=is.null`, "DELETE", undefined, "return=minimal");
  await db(`items?gcal_account=eq.${acc.id}`, "PATCH", { gcal_account: null, gcal_cal: null, gcal_event: null, gcal_key: null }, "return=minimal");
  await db(`google_accounts?id=eq.${acc.id}`, "DELETE", undefined, "return=minimal");
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  if (req.method === "GET") {
    if (url.searchParams.has("state")) return await callback(url);
    return new Response("Family display: Google Calendar function is running.", { headers: { "Content-Type": "text/plain" } });
  }
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  try {
    if (!SB_URL || !SERVICE) throw new Fail("Server is missing its Supabase settings", 500);
    const uid = await caller(req);
    const b = await req.json().catch(() => ({}));
    switch (b.action) {
      case "connect": return await connect(uid, b);
      case "sync": return await sync(uid, b);
      case "push": return await push(uid, b);
      case "remove": return await remove(uid, b);
      case "disconnect": return await disconnect(uid, b);
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    if (e instanceof Reconnect) return json({ error: "reconnect" }, 409);
    console.error(e);
    return json({ error: (e as Error).message ?? "Something went wrong" }, 502);
  }
});
