// Västtrafik proxy: keeps the API key on the server.
// POST { action: "search", q: "Brunnsparken" }      -> { results: [{ gid, name }] }
// POST { action: "search", q: "Chalmers", any: true } -> also addresses and places, with lat/lon
// POST { action: "departures", gid: "9021014001760000" } -> { departures: [...] }
// POST { action: "journeys", from: { gid } | { lat, lon, name }, to: (same) } -> { journeys: [...] }
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

// ---------- Trip planner ----------
type Place = { gid?: string; lat?: number; lon?: number; name?: string };
const JOURNEY_CACHE_MS = 30_000;

// A stop goes by its id; an address or place by its coordinates.
function placeParams(side: "origin" | "destination", p?: Place): string | null {
  if (!p || typeof p !== "object") return null;
  if (p.gid !== undefined && p.gid !== null) {
    return /^\d{16}$/.test(String(p.gid)) ? `${side}Gid=${p.gid}` : null;
  }
  const lat = Number(p.lat), lon = Number(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const name = String(p.name ?? "").slice(0, 80);
  return `${side}Latitude=${lat}&${side}Longitude=${lon}` + (name ? `&${side}Name=${encodeURIComponent(name)}` : "");
}

const when = (c: any) => c?.estimatedOtherwisePlannedTime ?? c?.estimatedTime ?? c?.plannedTime ?? null;
const planned = (c: any) => c?.plannedTime ?? when(c);
const mins = (x: any) => {
  const m = x?.estimatedDurationInMinutes ?? x?.plannedDurationInMinutes ?? x?.durationInMinutes;
  if (Number.isFinite(Number(m))) return Math.round(Number(m));
  const a = Date.parse(when(x?.origin)), b = Date.parse(when(x?.destination));
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 60000)) : 0;
};
const walk = (link: any) => {
  if (!link) return null;
  const min = mins(link);
  return min > 0 ? { walk: min } : null;
};

// One connection, simplified for the display: when to leave, when you arrive, and the
// chain of rides with the walks in between (like the Västtrafik app's trip list).
function journey(r: any) {
  const legs = (r.tripLegs ?? []).map((l: any) => {
    const sj = l.serviceJourney ?? {}, line = sj.line ?? {};
    return {
      line: line.shortName ?? line.designation ?? line.name ?? "",
      mode: line.transportMode ?? "",
      bg: line.backgroundColor ?? null,
      fg: line.foregroundColor ?? null,
      dir: sj.directionDetails?.shortDirection ?? sj.direction ?? "",
      from: l.origin?.stopPoint?.stopArea?.name ?? l.origin?.stopPoint?.name ?? "",
      platform: l.origin?.stopPoint?.platform ?? l.origin?.plannedPlatform ?? null,
      dep: when(l.origin), depPlanned: planned(l.origin),
      to: l.destination?.stopPoint?.stopArea?.name ?? l.destination?.stopPoint?.name ?? "",
      arr: when(l.destination), arrPlanned: planned(l.destination),
      cancelled: !!(l.isCancelled || l.isPartCancelled),
    };
  });
  // Walking-only answer (destination is close by).
  if (!legs.length) {
    const d = r.destinationLink;
    if (!d) return null;
    return { dep: when(d.origin), depPlanned: planned(d.origin), arr: when(d.destination), arrPlanned: planned(d.destination),
      cancelled: false, steps: [{ walk: mins(d) }] };
  }
  const links = r.connectionLinks ?? [];
  const steps: any[] = [];
  const access = walk(r.departureAccessLink);
  if (access) steps.push({ walk: access.walk });
  legs.forEach((leg: any, i: number) => {
    if (i > 0) {
      // Prefer the walk that ends where this leg starts; otherwise the gap between rides.
      const link = links.find((c: any) => c?.destination?.stopPoint?.stopArea?.name === leg.from && (c.transportMode ?? "walk") === "walk") ?? links[i - 1];
      const w = link ? mins(link) : 0;
      if (w > 0) steps.push({ walk: w });
    }
    steps.push(leg);
  });
  const egress = walk(r.arrivalAccessLink);
  if (egress) steps.push({ walk: egress.walk });
  const first = legs[0], last = legs[legs.length - 1];
  // Walks at the ends shift the times, so a late tram also makes you arrive late.
  const shift = (t: string | null, m: number) => t && m ? new Date(Date.parse(t) + m * 60000).toISOString() : t;
  const a = access?.walk ?? 0, e = egress?.walk ?? 0;
  return {
    // Leave time includes the walk to the first stop when the trip starts at an address.
    dep: shift(first.dep, -a), depPlanned: shift(first.depPlanned, -a),
    ride: first.dep,
    arr: shift(last.arr, e), arrPlanned: shift(last.arrPlanned, e),
    cancelled: legs.some((l: any) => l.cancelled),
    steps,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let body: { action?: string; q?: string; gid?: string; any?: boolean; from?: Place; to?: Place };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    if (body.action === "search") {
      const q = String(body.q ?? "").trim();
      if (q.length < 2 || q.length > 60) return json({ error: "Type at least 2 letters" }, 400);
      if (body.any) {
        const j = await vt(`/pr/v4/locations/by-text?q=${encodeURIComponent(q)}&limit=10`);
        const results = (j.results ?? [])
          .map((x: any) => {
            const stop = x.locationType === "stoparea" && /^\d{16}$/.test(String(x.gid ?? ""));
            const lat = Number(x.latitude), lon = Number(x.longitude);
            return {
              gid: stop ? String(x.gid) : null,
              name: String(x.name ?? ""),
              type: String(x.locationType ?? ""),
              lat: Number.isFinite(lat) ? lat : null,
              lon: Number.isFinite(lon) ? lon : null,
            };
          })
          .filter((x: any) => x.name && (x.gid || (x.lat !== null && x.lon !== null)));
        return json({ results });
      }
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

    if (body.action === "journeys") {
      const from = placeParams("origin", body.from), to = placeParams("destination", body.to);
      if (!from || !to) return json({ error: "Invalid trip" }, 400);
      const key = "j:" + from + "&" + to;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < JOURNEY_CACHE_MS) return json(hit.data);
      const j = await vt(`/pr/v4/journeys?${from}&${to}&limit=5`);
      const journeys = (j.results ?? []).map(journey).filter(Boolean);
      const data = { journeys, fetchedAt: new Date().toISOString() };
      cache.set(key, { at: Date.now(), data });
      return json(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 502);
  }
});
