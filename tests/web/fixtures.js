// Starting data for the tests: one signed-in parent, a family with two people, a few
// appointments, tasks and reminders, a reward chart for Mirali, a saved trip, bus times
// and a weather forecast. Every time is relative to NOW, so the screen reads the same on
// every run.

// Wednesday 18 November 2026, 07:30 in Gothenburg (the tests run in Europe/Stockholm).
export const NOW = new Date('2026-11-18T07:30:00+01:00');
export const TODAY = '2026-11-18';
export const YESTERDAY = '2026-11-17';
const inMin = m => new Date(NOW.getTime() + m * 6e4).toISOString();

export const USER = { id: 'u-parent', email: 'parent@example.com', password: 'correct-horse' };
export const HH = 'h-family';
export const MIRALI = 'p-mirali', DAD = 'p-dad';
export const RI = { bed: 'ri-bed', read: 'ri-read', tv: 'ri-tv', lekland: 'ri-lekland' };

export function seed({ signedIn = true, family = true } = {}) {
  const s = {
    users: [USER],
    session: signedIn ? { user: { id: USER.id, email: USER.email } } : null,
    db: { households: [], household_users: [], people: [], items: [], reward_items: [], reward_log: [], trips: [] },
    vt: vasttrafik(),
    fail: {},
  };
  if (!family) return s;
  const at = (k) => `2026-11-1${k}T08:00:00.000Z`;
  Object.assign(s.db, {
    households: [{ id: HH, name: 'Familjen Test', join_code: 'TESTCODE', vt_gid: '9021014001760000', vt_stop: 'Brunnsparken',
      place: 'Göteborg', lat: 57.71, lon: 11.97, created_by: USER.id, created_at: at(0) }],
    household_users: [{ household_id: HH, user_id: USER.id, role: 'owner' }],
    people: [
      { id: MIRALI, household_id: HH, name: 'Mirali', color: '#e4572e', sort: 0, goal_item: RI.lekland },
      { id: DAD, household_id: HH, name: 'Dad', color: '#2e86de', sort: 1, goal_item: null },
    ],
    items: [
      { id: 'i-swim', household_id: HH, type: 'event', title: 'Swimming', person_id: MIRALI, date: TODAY, time: '16:00:00', repeat: 'none', done: false, done_on: null, countdown: false },
      { id: 'i-grandma', household_id: HH, type: 'event', title: 'Grandma visits', person_id: null, date: '2026-11-21', time: null, repeat: 'none', done: false, done_on: null, countdown: true },
      { id: 'i-bed', household_id: HH, type: 'task', title: 'Make the bed', person_id: MIRALI, date: null, time: null, repeat: 'daily', done: false, done_on: null, countdown: false },
      { id: 'i-trash', household_id: HH, type: 'task', title: 'Take out the trash', person_id: DAD, date: null, time: null, repeat: 'none', done: false, done_on: null, countdown: false },
      { id: 'i-plants', household_id: HH, type: 'task', title: 'Water the plants', person_id: null, date: null, time: null, repeat: 'weekly', done: false, done_on: null, countdown: false },
      { id: 'i-gym', household_id: HH, type: 'reminder', title: 'Pack the gym bag', person_id: DAD, date: null, time: null, repeat: 'none', done: false, done_on: null, countdown: false },
    ],
    reward_items: [
      { id: RI.bed, household_id: HH, person_id: MIRALI, kind: 'earn', category: 'Chores', icon: '🛏️', title: 'Make your bed', notes: 1, per: 'day', sort: 0, created_at: at(1) },
      { id: RI.read, household_id: HH, person_id: MIRALI, kind: 'earn', category: 'Learning', icon: '📖', title: 'Read for 30 min', notes: 3, per: 'day', sort: 1, created_at: at(1) },
      { id: RI.tv, household_id: HH, person_id: MIRALI, kind: 'spend', category: 'Screen time', icon: '📺', title: '30 min TV', notes: 5, per: 'any', sort: 2, created_at: at(1) },
      { id: RI.lekland, household_id: HH, person_id: MIRALI, kind: 'spend', category: 'Treats', icon: '🦁', title: 'Trip to Leo’s Lekland', notes: 30, per: 'any', sort: 3, created_at: at(1) },
    ],
    reward_log: [
      { id: 'l-bonus', household_id: HH, person_id: MIRALI, item_id: null, title: 'Helped grandma', icon: '🌟', notes: 6, day: YESTERDAY, created_at: at(7) },
    ],
    trips: [
      { id: 't-school', household_id: HH, name: 'School', icon: '🏫', walk_min: 4, sort: 0, created_at: at(2),
        from_name: 'Brunnsparken', from_gid: '9021014001760000', from_lat: null, from_lon: null,
        to_name: 'Chalmers', to_gid: '9021014001960000', to_lat: null, to_lon: null },
    ],
  });
  return s;
}

export function vasttrafik() {
  return {
    departures: [
      { line: '6', dest: 'Kortedala', time: inMin(3), platform: 'A', bg: '#f39c12', fg: '#000000', cancelled: false },
      { line: '11', dest: 'Saltholmen', time: inMin(7), platform: 'B', bg: '#111111', fg: '#ffffff', cancelled: true },
      { line: '16', dest: 'Eketrägatan', time: inMin(12), platform: 'C', bg: '#2e86de', fg: '#ffffff', cancelled: false },
    ],
    journeys: {
      default: [
        { dep: inMin(10), depPlanned: inMin(8), arr: inMin(25), arrPlanned: inMin(23), cancelled: false,
          steps: [{ walk: 2 }, { line: '16', mode: 'tram', from: 'Brunnsparken', platform: 'C', dep: inMin(10), dir: 'Eketrägatan', bg: '#2e86de', fg: '#ffffff' }] },
        { dep: inMin(20), depPlanned: inMin(20), arr: inMin(34), arrPlanned: inMin(34), cancelled: true, steps: [] },
        { dep: inMin(30), depPlanned: inMin(30), arr: inMin(44), arrPlanned: inMin(44), cancelled: false,
          steps: [{ line: '6', mode: 'tram', from: 'Brunnsparken', platform: 'A', dep: inMin(30), dir: 'Kortedala' }] },
      ],
    },
    search: [{ name: 'Chalmers, Göteborg', gid: '9021014001960000', type: 'stoparea' }],
  };
}

// Open-Meteo forecast with timezone=auto: local times without an offset. Seven days, every day
// like the first: cloudy mornings, rain from midday. Feels 3° colder than it is.
// The 15-minute rain: dry until 08:15, rain 08:15–09:00, then dry again (each step is labelled
// with its end time and holds the rain of the 15 minutes before it).
export function weather() {
  const time = [], temperature_2m = [], apparent_temperature = [], weather_code = [], precipitation_probability = [], precipitation = [], wind_speed_10m = [], is_day = [];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    time.push(`2026-11-${18 + d}T${String(h).padStart(2, '0')}:00`);
    temperature_2m.push(2 + h / 4); apparent_temperature.push(-1 + h / 4); weather_code.push(h < 12 ? 3 : 61);
    precipitation_probability.push(h < 12 ? 10 : 60); precipitation.push(h < 12 ? 0 : 0.6); wind_speed_10m.push(5); is_day.push(h >= 8 && h < 16 ? 1 : 0);
  }
  const days = [...Array(7)].map((_, d) => `2026-11-${18 + d}`);
  const m15 = { time: [], precipitation: [], snowfall: [] };
  for (let q = 0; q < 12; q++) {
    const min = 7 * 60 + 15 + q * 15, t = `2026-11-18T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    m15.time.push(t); m15.precipitation.push(t >= '2026-11-18T08:30' && t <= '2026-11-18T09:00' ? 0.3 : 0); m15.snowfall.push(0);
  }
  return {
    current: { temperature_2m: 4.2, apparent_temperature: 1.1, weather_code: 3, wind_speed_10m: 5.4, is_day: 0 },
    hourly: { time, temperature_2m, apparent_temperature, weather_code, precipitation_probability, precipitation, wind_speed_10m, is_day },
    daily: { time: days, weather_code: [61, 0, 3, 61, 71, 2, 1], temperature_2m_max: [7.6, 5.2, 6, 8.4, 1.2, 3, 4], temperature_2m_min: [1.4, -1.0, 2, 4.1, -3.6, -2, 0],
      precipitation_probability_max: [70, 5, 10, 80, 60, 10, 0], precipitation_sum: [4.2, 0, 0, 9.6, 3, 0, 0],
      sunrise: days.map(d => d + 'T08:05'), sunset: days.map(d => d + 'T15:40') },
    minutely_15: m15,
  };
}

// SMHI's warnings feed. A box around Gothenburg as [lon, lat] rings (the family lives at 57.71, 11.97).
const box = (w, s, e, n) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } });
const area = (o) => ({ id: o.id, approximateStart: o.from, ...(o.to ? { approximateEnd: o.to } : {}), published: '2026-11-17T12:00:00.000Z',
  areaName: { sv: o.name, en: o.name }, warningLevel: { code: o.level, en: o.level }, eventDescription: { en: o.what, sv: o.what },
  affectedAreas: [], descriptions: [{ title: { code: 'INCIDENT', en: 'Description of incident' }, text: { en: o.text, sv: o.text } },
    { title: { code: 'AFFECT', en: 'What should I think about?' }, text: { en: 'Secure loose objects.', sv: '' } }],
  area: o.geo });
export function warnings() {
  const gbg = box(11.5, 57.4, 12.5, 58.0), sthlm = box(17.5, 59.0, 18.5, 59.6);
  return [
    { id: 1, event: { en: 'Wind', code: 'WIND' }, warningAreas: [
      area({ id: 11, level: 'YELLOW', what: 'Wind', name: 'Coast of Västra Götaland', from: '2026-11-18T05:00:00.000Z', to: '2026-11-19T11:00:00.000Z', text: 'Gusts of 25 m/s along the coast.', geo: gbg }),
      area({ id: 12, level: 'ORANGE', what: 'Snow', name: 'Stockholm', from: '2026-11-18T05:00:00.000Z', to: '2026-11-19T11:00:00.000Z', text: 'Heavy snow.', geo: sthlm }),
      area({ id: 13, level: 'YELLOW', what: 'Rain', name: 'Göteborg', from: '2026-11-17T05:00:00.000Z', to: '2026-11-18T05:00:00.000Z', text: 'Over already.', geo: gbg })] },
    { id: 2, event: { en: 'Risk for water shortage', code: 'WATER_SHORTAGE' }, warningAreas: [
      area({ id: 21, level: 'MESSAGE', what: 'Risk for water shortage', name: 'Västra Götalands län', from: '2026-05-01T00:00:00.000Z', text: 'Low groundwater.', geo: gbg })] },
  ];
}
