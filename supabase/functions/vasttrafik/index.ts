// Västtrafik proxy: keeps the API key on the server.
// POST { action: "search", q: "Brunnsparken" }      -> { results: [{ gid, name }] }
// POST { action: "departures", gid: "9021014001760000" } -> { departures: [...] }
// Only signed-in users of the app can call it (Supabase verifies the JWT).

const VT = "https://ext-api.vasttrafik.se";
const ID = Deno.env.get("VT_CLIENT_ID") ?? "";
const SECRET = Deno.env.get("VT_CLIENT_SECRET") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

let token: { value: string; expires: number } | null = null;

async function getToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  if (!ID || !SECRET) throw new Error("Server is missing VT_CLIENT_ID / VT_CLIENT_SECRET");
  const r = await fetch(`${VT}/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${ID}:${SECRET}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error(`Västtrafik token request failed (${r.status})`);
  const j = await r.json();
  token = { value: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function vt(path: string): Promise<any> {
  let r = await fetch(VT + path, { headers: { Authorization: `Bearer ${await getToken()}` } });
  if (r.status === 401) {
    token = null;
    r = await fetch(VT + path, { headers: { Authorization: `Bearer ${await getToken()}` } });
  }
  if (!r.ok) throw new Error(`Västtrafik answered ${r.status}`);
  return r.json();
}

// Many displays may show the same stop: cache departures briefly.
const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 20_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: { action?: string; q?: string; gid?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    if (body.action === "search") {
      const q = String(body.q ?? "").trim();
      if (q.length < 2 || q.length > 60) return json({ error: "Type at least 2 letters" }, 400);
      const j = await vt(`/pr/v4/locations/by-text?q=${encodeURIComponent(q)}&types=stoparea&limit=8`);
      const results = (j.results ?? [])
        .filter((x: any) => x.gid)
        .map((x: any) => ({ gid: String(x.gid), name: String(x.name ?? "") }));
      return json({ results });
    }

    if (body.action === "departures") {
      const gid = String(body.gid ?? "");
      if (!/^\d{16}$/.test(gid)) return json({ error: "Invalid stop id" }, 400);
      const hit = cache.get(gid);
      if (hit && Date.now() - hit.at < CACHE_MS) return json(hit.data);
      const j = await vt(`/pr/v4/stop-areas/${gid}/departures?limit=15&timeSpanInMinutes=90`);
      const departures = (j.results ?? []).map((d: any) => {
        const sj = d.serviceJourney ?? {}, l = sj.line ?? {};
        return {
          line: l.shortName ?? l.designation ?? l.name ?? "",
          dest: sj.directionDetails?.shortDirection ?? sj.direction ?? "",
          mode: l.transportMode ?? "",
          bg: l.backgroundColor ?? null,
          fg: l.foregroundColor ?? null,
          platform: d.stopPoint?.platform ?? null,
          time: d.estimatedOtherwisePlannedTime ?? d.estimatedTime ?? d.plannedTime,
          realtime: !!d.estimatedTime,
          cancelled: !!d.isCancelled,
        };
      });
      const data = { departures, fetchedAt: new Date().toISOString() };
      cache.set(gid, { at: Date.now(), data });
      return json(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 502);
  }
});
