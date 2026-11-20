// A stand-in for supabase-js, served in place of the CDN script during tests.
// It keeps the family's data in memory (and in sessionStorage, so it survives a reload)
// and answers the same calls the page makes: tables, database functions, auth,
// realtime and the vasttrafik and google server functions.
//
// Tests set the starting data with window.__FAKE_SEED (see ../harness.js) and can look
// at window.__fake.state and window.__fake.calls afterwards.
(() => {
  const KEY = '__fake_state';
  let state;
  try { state = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
  if (!state) state = JSON.parse(JSON.stringify(window.__FAKE_SEED || {}));
  state.db ||= {};
  for (const t of ['households', 'household_users', 'people', 'items', 'reward_items', 'reward_log', 'trips', 'google_accounts']) state.db[t] ||= [];
  state.users ||= [];
  state.fail ||= {};
  state.vt ||= {};
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  save();

  const calls = [];
  window.__fake = { state, calls, save };

  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoWeek = s => { const t = new Date(s + 'T12:00'); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
    const w1 = new Date(t.getFullYear(), 0, 4); return t.getFullYear() + '-' + (1 + Math.round(((t - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7)); };
  let seq = 0;
  const id = () => 'f' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  let lastTs = 0;
  const stamp = () => { lastTs = Math.max(Date.now(), lastTs + 1); return new Date(lastTs).toISOString(); };
  const err = (message, code) => ({ message, code: code || 'P0001' });
  const later = v => new Promise(r => setTimeout(() => r(v), 0));
  const uid = () => state.session?.user?.id || null;

  // Fail on purpose: state.fail['items.insert'] = 'message' (or 'reward_items.select', 'rpc.reward_earn',
  // 'vasttrafik.departures', …). A value of {message, code} sets the error code too.
  const failure = key => { const f = state.fail[key]; if (!f) return null; return typeof f === 'string' ? err(f) : err(f.message, f.code); };

  const DEFAULTS = {
    households: () => ({ join_code: 'NEWCODE1', vt_gid: null, vt_stop: null, place: null, lat: null, lon: null, created_by: uid() }),
    people: () => ({ color: '#8a8896', sort: 0, goal_item: null }),
    items: () => ({ person_id: null, date: null, time: null, repeat: 'none', done: false, done_on: null, countdown: false, created_by: uid() }),
    reward_items: () => ({ person_id: null, icon: null, category: null, per: 'any', sort: 0 }),
    reward_log: () => ({ item_id: null, icon: null, created_by: uid() }),
    trips: () => ({ icon: '📍', walk_min: 0, sort: 0, from_gid: null, from_lat: null, from_lon: null, to_gid: null, to_lat: null, to_lon: null }),
  };

  // What the signed-in user may see (row-level security, simplified to "families I'm in").
  const myHouseholds = () => new Set(state.db.household_users.filter(m => m.user_id === uid()).map(m => m.household_id));
  function rows(table) {
    const mine = myHouseholds();
    if (table === 'reward_balances') {
      const by = {};
      for (const l of state.db.reward_log) if (mine.has(l.household_id)) {
        const k = l.person_id; by[k] ||= { person_id: k, household_id: l.household_id, balance: 0 }; by[k].balance += l.notes;
      }
      return Object.values(by);
    }
    const all = state.db[table];
    if (!all) return null;
    if (table === 'households') return all.filter(h => mine.has(h.id));
    return all.filter(r => !('household_id' in r) || mine.has(r.household_id));
  }

  class Query {
    constructor(table) { this.table = table; this.op = 'select'; this.filters = []; this.orders = []; this.max = null; this.one = false; this.payload = null; this.returning = false; }
    select() { if (this.op !== 'select') this.returning = true; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; }
    update(p) { this.op = 'update'; this.payload = p; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c, v) { this.filters.push(r => r[c] === v); return this; }
    in(c, vs) { this.filters.push(r => vs.includes(r[c])); return this; }
    gte(c, v) { this.filters.push(r => r[c] >= v); return this; }
    is(c, v) { this.filters.push(r => (r[c] ?? null) === v); return this; }
    order(c, o = {}) { this.orders.push([c, o.ascending !== false]); return this; }
    limit(n) { this.max = n; return this; }
    single() { this.one = true; return this; }
    then(ok, bad) { return later().then(() => this.run()).then(ok, bad); }
    run() {
      calls.push({ kind: 'table', table: this.table, op: this.op, payload: clone(this.payload) });
      const f = failure(`${this.table}.${this.op}`);
      if (f) return { data: null, error: f };
      const visible = rows(this.table);
      if (!visible) return { data: null, error: err(`relation "public.${this.table}" does not exist`, '42P01') };
      const match = visible.filter(r => this.filters.every(fn => fn(r)));
      let out;
      if (this.op === 'select') out = match;
      else if (this.op === 'insert') {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(p => ({ id: id(), created_at: stamp(), ...DEFAULTS[this.table]?.(), ...clone(p) }));
        state.db[this.table].push(...list); out = list;
      } else if (this.op === 'update') {
        for (const r of match) Object.assign(r, clone(this.payload));
        out = match;
      } else {
        const gone = new Set(match);
        state.db[this.table] = state.db[this.table].filter(r => !gone.has(r));
        if (this.table === 'people') {  // like the foreign keys: items lose their person, chart and log rows go
          const ids = new Set(match.map(p => p.id));
          for (const r of state.db.items) if (ids.has(r.person_id)) r.person_id = null;
          state.db.reward_items = state.db.reward_items.filter(r => !ids.has(r.person_id));
          state.db.reward_log = state.db.reward_log.filter(r => !ids.has(r.person_id));
        }
        out = match;
      }
      if (this.op !== 'select') save();
      if (this.op !== 'select' && !this.returning) return { data: null, error: null };
      for (const [c, asc] of [...this.orders].reverse()) out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
      if (this.max != null) out = out.slice(0, this.max);
      if (this.one) {
        if (out.length !== 1) return { data: null, error: err('JSON object requested, multiple (or no) rows returned', 'PGRST116') };
        return { data: clone(out[0]), error: null };
      }
      return { data: clone(out), error: null };
    }
  }

  // ---------- database functions ----------
  const RPC = {
    create_household({ p_name }) {
      if (!uid()) throw err('not signed in');
      const h = { id: id(), created_at: stamp(), ...DEFAULTS.households(), name: p_name, join_code: 'NEWCODE1' };
      state.db.households.push(h); state.db.household_users.push({ household_id: h.id, user_id: uid(), role: 'owner' }); return h;
    },
    join_household({ p_code }) {
      if (!uid()) throw err('not signed in');
      const h = state.db.households.find(x => x.join_code === String(p_code).toUpperCase());
      if (!h) throw err('No household with that code');
      if (!myHouseholds().has(h.id)) state.db.household_users.push({ household_id: h.id, user_id: uid(), role: 'member' });
      return h;
    },
    new_join_code({ h }) {
      if (!state.db.household_users.some(m => m.household_id === h && m.user_id === uid() && m.role === 'owner')) throw err('only the owner can do that');
      const hh = state.db.households.find(x => x.id === h); hh.join_code = 'ROTATED1'; return hh.join_code;
    },
    reward_earn({ p_item, p_person, p_day }) {
      const it = state.db.reward_items.find(i => i.id === p_item);
      if (!it || !myHouseholds().has(it.household_id)) throw err('Not found');
      if (it.kind !== 'earn') throw err('That is a reward, not something to earn');
      if (it.person_id && it.person_id !== p_person) throw err("That is on someone else's chart");
      const mine = state.db.reward_log.filter(l => l.person_id === p_person && l.item_id === it.id);
      if (it.per === 'day' && mine.some(l => l.day === p_day)) throw err('Already earned today');
      if (it.per === 'week' && mine.some(l => isoWeek(l.day) === isoWeek(p_day))) throw err('Already earned this week');
      return logRow(it, p_person, it.notes, p_day);
    },
    reward_spend({ p_item, p_person, p_day }) {
      const it = state.db.reward_items.find(i => i.id === p_item);
      if (!it || !myHouseholds().has(it.household_id)) throw err('Not found');
      if (it.kind !== 'spend') throw err('That is something to earn, not a reward');
      if (it.person_id && it.person_id !== p_person) throw err("That is on someone else's chart");
      const bal = state.db.reward_log.filter(l => l.person_id === p_person).reduce((s, l) => s + l.notes, 0);
      if (bal < it.notes) throw err('Not enough notes yet');
      return logRow(it, p_person, -it.notes, p_day);
    },
  };
  function logRow(it, person, notes, day) {
    const r = { id: id(), created_at: stamp(), ...DEFAULTS.reward_log(), household_id: it.household_id, person_id: person, item_id: it.id, title: it.title, icon: it.icon, notes, day };
    state.db.reward_log.push(r); return r;
  }

  // ---------- auth ----------
  const listeners = [];
  const emit = ev => { const s = state.session ? clone(state.session) : null; for (const cb of listeners) setTimeout(() => cb(ev, s), 0); };
  const auth = {
    async getSession() { return { data: { session: clone(state.session) || null }, error: null }; },
    async signInWithPassword({ email, password }) {
      calls.push({ kind: 'auth', op: 'signIn', email });
      const u = state.users.find(x => x.email === email && x.password === password);
      if (!u) return later({ data: { session: null, user: null }, error: err('Invalid login credentials', 'invalid_credentials') });
      state.session = { user: { id: u.id, email: u.email } }; save(); emit('SIGNED_IN');
      return later({ data: { session: clone(state.session), user: clone(state.session.user) }, error: null });
    },
    async signUp({ email, password }) {
      calls.push({ kind: 'auth', op: 'signUp', email });
      if (state.users.some(x => x.email === email)) return later({ data: { session: null, user: null }, error: err('User already registered', 'user_already_exists') });
      const u = { id: id(), email, password }; state.users.push(u);
      if (state.confirmEmail) { save(); return later({ data: { session: null, user: { id: u.id, email } }, error: null }); }
      state.session = { user: { id: u.id, email } }; save(); emit('SIGNED_IN');
      return later({ data: { session: clone(state.session), user: { id: u.id, email } }, error: null });
    },
    async signOut() { calls.push({ kind: 'auth', op: 'signOut' }); state.session = null; save(); emit('SIGNED_OUT'); return { error: null }; },
    async resetPasswordForEmail(email) { calls.push({ kind: 'auth', op: 'reset', email }); return later({ data: {}, error: null }); },
    async updateUser(p) { calls.push({ kind: 'auth', op: 'updateUser', p }); return later({ data: {}, error: null }); },
    onAuthStateChange(cb) {
      listeners.push(cb); setTimeout(() => cb('INITIAL_SESSION', clone(state.session) || null), 0);
      return { data: { subscription: { unsubscribe() { listeners.splice(listeners.indexOf(cb), 1); } } } };
    },
  };

  // ---------- vasttrafik server function ----------
  // state.vt = { departures: [...], journeys: { default: [...], '<to gid or name>': [...] }, search: [...] }
  function vasttrafik(body) {
    const f = failure('vasttrafik.' + body.action);
    if (f) return { data: null, error: f };
    if (body.action === 'departures') return { data: { departures: clone(state.vt.departures || []) }, error: null };
    if (body.action === 'journeys') {
      const j = state.vt.journeys || {}, k = body.to?.gid || body.to?.name;
      return { data: { journeys: clone(j[k] || j.default || []) }, error: null };
    }
    if (body.action === 'search') return { data: { results: clone(state.vt.search || []) }, error: null };
    return { data: { error: 'unknown action' }, error: null };
  }

  // ---------- google server function ----------
  // Answers like the real one without Google: connect hands back a sign-in address, the rest say ok.
  // disconnect removes the account and what came from it, like the server does.
  function google(body) {
    const f = failure('google.' + body.action);
    if (f) return { data: null, error: f };
    if (body.action === 'connect') return { data: { url: 'https://accounts.google.test/signin?person=' + (body.person_id || '') }, error: null };
    if (body.action === 'disconnect') {
      state.db.items = state.db.items.filter(i => !(i.gcal_account === body.account && !i.created_by));
      state.db.google_accounts = state.db.google_accounts.filter(a => a.id !== body.account); save();
    }
    if (body.action === 'sync') return { data: { accounts: state.db.google_accounts.length, errors: [] }, error: null };
    return { data: { ok: true }, error: null };
  }

  function createClient() {
    return {
      from: t => new Query(t),
      async rpc(name, args) {
        calls.push({ kind: 'rpc', name, args: clone(args) });
        await later();
        const f = failure('rpc.' + name);
        if (f) return { data: null, error: f };
        try { const data = RPC[name](args); save(); return { data: clone(data), error: null }; }
        catch (e) { return { data: null, error: e.message ? e : err(String(e)) }; }
      },
      functions: { async invoke(name, { body }) { calls.push({ kind: 'fn', name, body: clone(body) }); await later(); return name === 'google' ? google(body) : vasttrafik(body); } },
      auth,
      channel() { const ch = { on: () => ch, subscribe: cb => { setTimeout(() => cb && cb('SUBSCRIBED'), 0); return ch; } }; return ch; },
      removeChannel() {},
    };
  }
  window.supabase = { createClient };
})();
