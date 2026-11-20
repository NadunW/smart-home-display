// Opens the real web/index.html in the browser with everything outside the page faked:
// Supabase (fake/supabase.js), the Västtrafik function, Open-Meteo, and the clock.
// The page is served from http://display.test/, so nothing goes out to the internet.
import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NOW, seed, weather } from './fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(here, '../../web');
export const ORIGIN = 'http://display.test';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

class Display {
  constructor(page) { this.page = page; }

  // state: the fake backend's starting data (see fixtures.seed). storage: localStorage
  // entries for this device, e.g. { 'fhd.tab': 'bus' }. Both are set once, before the
  // first load; a reload keeps whatever the page changed.
  async open({ state = seed(), storage = {}, time = NOW, weatherData = weather() } = {}) {
    const { page } = this;
    await page.clock.install({ time });
    await page.addInitScript(({ state, storage }) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      window.__FAKE_SEED = state;
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }, { state, storage });

    // Anything not handled below would leave the test machine: block it.
    await page.route('**/*', r => r.abort('blockedbyclient'));
    await page.route(`${ORIGIN}/**`, async r => {
      const p = new URL(r.request().url()).pathname;
      if (p === '/version.txt') return r.fulfill({ status: 404, body: '' });
      const file = path.join(WEB, p === '/' ? 'index.html' : p);
      if (!file.startsWith(WEB)) return r.fulfill({ status: 404 });
      try { r.fulfill({ body: await readFile(file), contentType: TYPES[path.extname(file)] || 'application/octet-stream' }); }
      catch { r.fulfill({ status: 404, body: '' }); }
    });
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@*/**', r =>
      r.fulfill({ path: path.join(here, 'fake/supabase.js'), contentType: 'text/javascript' }));
    await page.route('https://api.open-meteo.com/**', r =>
      weatherData ? r.fulfill({ json: weatherData }) : r.fulfill({ status: 503, body: '' }));
    // The Outfit web font: an empty stylesheet, so the page falls back to the system font.
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
    await page.route('https://geocoding-api.open-meteo.com/**', r =>
      r.fulfill({ json: { results: [{ name: 'Mölndal', latitude: 57.65, longitude: 12.01, admin1: 'Västra Götaland', country: 'Sverige' }] } }));

    await page.goto(ORIGIN + '/');
    await this.settled();
    return this;
  }

  // Wait until the page has stopped talking to the fake backend (first load, then the
  // reload realtime does once it connects), so a test doesn't race the first sync.
  async settled() {
    await this.page.locator('#vAuth:not([hidden]), #vReset:not([hidden]), #vSetup:not([hidden]), #vBoard:not([hidden])').waitFor();
    let n = -1;
    for (let i = 0; i < 40; i++) {
      const m = await this.page.evaluate(() => window.__fake?.calls.length ?? 0);
      if (m === n) return;
      n = m; await this.page.waitForTimeout(400);  // longer than the 300 ms the page waits before a refetch
    }
  }

  // What the page does when a sync comes in (realtime change, the 5-minute refresh, or
  // the tablet waking up): reload everything and redraw.
  async sync() {
    await this.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await this.settled();
  }

  // The fake backend's data and the calls the page made.
  state() { return this.page.evaluate(() => window.__fake.state); }
  calls(filter = {}) { return this.page.evaluate(f => window.__fake.calls.filter(c => Object.entries(f).every(([k, v]) => c[k] === v)), filter); }
  // Change the fake backend while the page is open, e.g. to make the next call fail.
  set(fn, arg) { return this.page.evaluate(([src, arg]) => { new Function('state', 'arg', src)(window.__fake.state, arg); window.__fake.save(); }, [`(${fn})(state, arg)`, arg]); }

  // Handy places on the screen.
  get board() { return this.page.locator('#vBoard'); }
  tab(name) { return this.page.getByRole('tab', { name, exact: true }); }
  box(id) { return this.page.locator(`.wgt[data-w="${id}"]`); }
  get toast() { return this.page.locator('#toast'); }
}

export const test = base.extend({
  display: async ({ page }, use) => {
    // Any uncaught error in the page fails the test, even if the screen looked right
    // (for example a script that stops halfway while loading).
    const errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message));
    await use(new Display(page));
    expect(errors, 'errors in the page').toEqual([]);
  },
});
export { expect };
