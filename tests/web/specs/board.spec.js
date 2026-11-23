// The family board: header, tabs, the Today/Bus/Tasks/Weather boxes and the slideshow.
import { test, expect } from '../harness.js';
import { NOW, TODAY, HH, seed, warnings } from '../fixtures.js';

test.describe('header and footer', () => {
  test.beforeEach(async ({ display }) => { await display.open(); });

  test('shows the time, date and week', async ({ page }) => {
    await expect(page.locator('header [data-clock]')).toHaveText('07:30');
    await expect(page.locator('#date')).toHaveText('Wednesday18 November · week 47');
  });

  test('shows the weather now and today’s high, low and rain', async ({ page }) => {
    const wx = page.locator('#wx');
    await expect(wx).toContainText('4°');
    await expect(wx).toContainText('Cloudy');
    await expect(wx).toContainText('Feels 1° · 5 m/s');
    await expect(wx).toContainText('8° / 1° · 💧70%');
  });

  test('counts down to the next countdown appointment', async ({ page }) => {
    await expect(page.locator('#count')).toHaveText('3 daysGrandma visits');
  });

  test('the header lists the next departures that aren’t cancelled; tapping it opens the Bus tab', async ({ page, display }) => {
    const chip = page.locator('#busChip');
    await expect(chip).toHaveAccessibleName('Next bus: 6 to Kortedala, 3 min. Then 16 to Eketrägatan, 12 min. Show all departures.');
    await expect(chip.locator('.tkr').first()).toHaveText(/6\s*Kortedala\s*3 min\s*16\s*Eketrägatan\s*12 min/);
    await expect(chip).not.toContainText('Saltholmen');
    await chip.click();
    await expect(display.tab('Bus')).toHaveAttribute('aria-selected', 'true');
  });

  test('says when it last synced', async ({ page }) => {
    await expect(page.locator('#status')).toHaveText('Synced · 07:30');
  });

  test('turns dark before sunrise when the theme is automatic', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the sun button switches to always light and remembers it', async ({ page }) => {
    await page.locator('#thBtn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => localStorage.getItem('fhd.theme'))).toBe('light');
  });
});

test.describe('tabs', () => {
  const BOXES = { Today: ['today', 'tmrw', 'soon', 'rems'], Bus: ['bus', 'trips'], Tasks: ['tasks'], Rewards: ['rw'], Weather: ['wxw', 'rain', 'wear', 'week', 'warn'] };
  const ALL = Object.values(BOXES).flat();

  test('each tab shows only its own boxes', async ({ display }) => {
    await display.open();
    for (const [name, mine] of Object.entries(BOXES)) {
      await display.tab(name).click();
      await expect(display.tab(name)).toHaveAttribute('aria-selected', 'true');
      for (const id of ALL) await (mine.includes(id) ? expect(display.box(id)).toBeVisible() : expect(display.box(id)).toBeHidden());
    }
  });

  test('the chosen tab is kept on this device after a reload', async ({ page, display }) => {
    await display.open();
    await display.tab('Tasks').click();
    await page.reload();
    await expect(display.tab('Tasks')).toHaveAttribute('aria-selected', 'true');
    await expect(display.box('tasks')).toBeVisible();
  });

  test('left and right arrow keys move between tabs', async ({ page, display }) => {
    await display.open();
    await display.tab('Today').focus();
    await page.keyboard.press('ArrowRight');
    await expect(display.tab('Bus')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(display.tab('Weather')).toHaveAttribute('aria-selected', 'true');
  });

  test('tabs switched off in Settings leave the tab bar', async ({ display }) => {
    await display.open({ storage: { 'fhd.rotate': { tabs: { wx: { on: false, s: 10 } } } } });
    await expect(display.tab('Today')).toBeVisible();
    await expect(display.tab('Weather')).toBeHidden();
  });
});

test.describe('Today', () => {
  test.beforeEach(async ({ display }) => { await display.open(); });

  test('lists today’s appointments, what’s coming up and reminders', async ({ display }) => {
    await expect(display.box('today')).toContainText('16:00Swimming');
    await expect(display.box('today')).toContainText('Mirali');
    await expect(display.box('soon')).toContainText('Grandma visits');
    await expect(display.box('soon')).toContainText('Everyone · Sat 21');
    await expect(display.box('rems')).toContainText('Pack the gym bag');
  });

  test('Tomorrow says so when nothing is planned', async ({ display }) => {
    await expect(display.box('tmrw')).toContainText('Nothing planned tomorrow.');
  });

  test('Add puts a new appointment on today’s list and saves it', async ({ page, display }) => {
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const dlg = page.locator('#ovAdd');
    await dlg.getByRole('button', { name: 'Appointment' }).click();
    await dlg.getByLabel('What').fill('Dentist');
    await dlg.getByLabel('Who').selectOption({ label: 'Dad' });
    await dlg.getByLabel('Time').fill('09:15');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await expect(display.box('today').locator('.ev').first()).toContainText('09:15Dentist');
    await expect.poll(async () => (await display.state()).db.items.find(i => i.title === 'Dentist'))
      .toMatchObject({ type: 'event', date: TODAY, time: '09:15', person_id: 'p-dad' });
  });

  test('ticking a reminder dismisses it', async ({ page, display }) => {
    await page.getByRole('button', { name: 'Dismiss reminder' }).click();
    await expect(display.box('rems')).toContainText('No reminders.');
    await expect.poll(async () => (await display.state()).db.items.some(i => i.id === 'i-gym')).toBe(false);
  });
});

test.describe('Bus', () => {
  test.beforeEach(async ({ display }) => { await display.open({ storage: { 'fhd.tab': 'bus' } }); });

  test('lists departures in minutes, leaving out cancelled ones', async ({ display }) => {
    const deps = display.box('bus').locator('.dep');
    await expect(display.box('bus').locator('h2')).toHaveText('Next departures · Brunnsparken');
    await expect(deps).toHaveCount(2);
    await expect(deps.nth(0)).toContainText('6Kortedala · A3 min');
    await expect(deps.nth(0).locator('.m')).toHaveClass(/soon/);
    await expect(deps.nth(1)).toContainText('16Eketrägatan · C12 min');
  });

  test('says so when live times are unavailable', async ({ page, display }) => {
    await display.set(s => { s.fail['vasttrafik.departures'] = 'down'; });
    await page.reload();
    await expect(display.box('bus')).toContainText('Live times unavailable right now.');
  });

  test('a saved trip says when to leave, with delays and cancellations', async ({ display }) => {
    const trip = display.box('trips').locator('.trip');
    await expect(trip.locator('.tn')).toHaveAccessibleName('Edit trip School');
    await expect(trip).toContainText('Brunnsparken → Chalmers');
    // Leaves in 10 min, minus 4 min to walk.
    await expect(trip.locator('.lv')).toHaveText('Leave in 6 min');
    const rows = trip.locator('.jr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('.jt')).toHaveText('07:40 – 07:5507:38 – 07:53');
    await expect(rows.nth(0).locator('.jt b').first()).toHaveClass('lt');
    await expect(rows.nth(0)).toContainText('Leave home 07:36 · Tram 16 from Brunnsparken, platform C at 07:40 towards Eketrägatan');
    await expect(rows.nth(1)).toHaveClass(/gone/);
    await expect(rows.nth(1)).toContainText('Cancelled');
    await expect(rows.nth(2)).toContainText('14 min');
  });
});

test.describe('Tasks', () => {
  test.beforeEach(async ({ display }) => { await display.open({ storage: { 'fhd.tab': 'tasks' } }); });

  test('groups tasks by person with progress', async ({ display }) => {
    const box = display.box('tasks');
    await expect(box.locator('.big')).toHaveText('0 of 3done today');
    await expect(box.locator('.who-h')).toHaveText(['MMirali0/1', 'DDad0/1', 'EEveryone0/1']);
  });

  test('ticking a daily task marks it done for today', async ({ page, display }) => {
    await page.getByRole('button', { name: 'Mark Make the bed done' }).click();
    await expect(display.box('tasks').locator('.big')).toHaveText('1 of 3done today');
    await expect(page.getByRole('button', { name: 'Mark Make the bed not done' })).toBeVisible();
    await expect.poll(async () => (await display.state()).db.items.find(i => i.id === 'i-bed').done_on).toBe(TODAY);
  });

  test('a weekly task counts for the ISO week', async ({ page, display }) => {
    await page.getByRole('button', { name: 'Mark Water the plants done' }).click();
    await expect.poll(async () => (await display.state()).db.items.find(i => i.id === 'i-plants').done_on).toBe('2026-W47');
  });

  test('a daily task ticked yesterday shows as not done today', async ({ display }) => {
    await display.set(s => { s.db.items.find(i => i.id === 'i-bed').done_on = '2026-11-17'; });
    await display.page.reload();
    await expect(display.box('tasks').locator('.big')).toHaveText('0 of 3done today');
  });
});

test.describe('Weather tab', () => {
  test('shows the hours ahead', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' } });
    const box = display.box('wxw');
    await expect(box.locator('h2')).toHaveText('Weather · Göteborg');
    // 07:30, so the strip starts at 08 and runs to the end of the day, every 2 hours.
    await expect(box.locator('.fc > div').first()).toContainText('08');
    await expect(box.locator('.fc > div')).toHaveCount(8);
    await expect(display.page.getByText('Tomorrow ·')).toHaveCount(0);
  });

  test('says when the rain starts and stops in the next 2 hours', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' } });
    const box = display.box('rain');
    await expect(box.locator('.rh')).toHaveText('Rain from around 08:15, until about 09:00');
    await expect(box.locator('.rbars i')).toHaveCount(8);
    await expect(box.locator('.rx')).toHaveText(/Now\s*08:30\s*09:30/);
  });

  test('says when it stays dry', async ({ display }) => {
    const { weather } = await import('../fixtures.js');
    const w = weather(); w.minutely_15.precipitation = w.minutely_15.precipitation.map(() => 0);
    await display.open({ storage: { 'fhd.tab': 'wx' }, weatherData: w });
    await expect(display.box('rain').locator('.rh')).toHaveText('Dry for the next 2 hours');
  });

  test('suggests what to wear for the school day', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' } });
    const box = display.box('wear');
    await expect(box.locator('.wh')).toHaveText('Today 07–17 · feels 1° · rain likely');
    await expect(box.locator('li')).toHaveText(['🧥Lined rain jacket and trousers', 'Thin hat', '🧤Gloves', '👢Lined rubber boots']);
    await expect(box.locator('li').nth(1).locator('svg.beanie')).toBeVisible();
  });

  test('after 17:00 what to wear is for tomorrow', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' }, time: new Date('2026-11-18T18:00:00+01:00') });
    await expect(display.box('wear').locator('.wh')).toHaveText(/^Tomorrow 07–17/);
  });

  test('shows the next 7 days with lows, highs and rain', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' } });
    const rows = display.box('week').locator('.dayrow');
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(0)).toHaveText(/Today[\s\S]*70%\s*4 mm\s*1°\s*8°/);
    await expect(rows.nth(1)).toHaveText(/Thu 19[\s\S]*-1°\s*5°/);
    await expect(rows.nth(4)).toHaveText(/Sun 22[\s\S]*60%\s*3 mm\s*-4°\s*1°/);
  });

  test('shows SMHI warnings that cover home, in English, and leaves out the rest', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' }, warnings: warnings() });
    const box = display.box('warn');
    const items = box.locator('.wn');
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('Wind');
    await expect(items).toContainText('Yellow warning · Coast of Västra Götaland');
    await expect(items).toContainText('Now until tomorrow 12:00');
    await expect(items).toContainText('Gusts of 25 m/s along the coast.');
    await expect(box).toHaveClass(/wy/);
    for (const t of ['Stockholm', 'Over already', 'water shortage']) await expect(box).not.toContainText(t);
  });

  test('says when there are no warnings', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' } });
    await expect(display.box('warn')).toContainText('No weather warnings for Göteborg');
  });

  test('says when SMHI can’t be reached', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' }, warnings: null });
    await expect(display.box('warn')).toContainText('Couldn’t reach SMHI just now.');
  });

  test('a layout saved before these boxes gets the new Weather tab layout', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx', 'fhd.layout2': [{ id: 'wxw', x: 0, y: 0, w: 12, h: 5 }] } });
    const a = await display.box('wxw').boundingBox(), b = await display.box('rain').boundingBox();
    expect(b.x).toBeGreaterThan(a.x + a.width - 1);
    expect(Math.abs(b.y - a.y)).toBeLessThan(2);
  });

  test('the boxes stack on a phone @phone', async ({ display }) => {
    await display.open({ storage: { 'fhd.tab': 'wx' }, warnings: warnings() });
    for (const id of ['wxw', 'rain', 'wear', 'week', 'warn']) await expect(display.box(id)).toBeVisible();
    await expect(display.box('rain').locator('.rbars')).toHaveCSS('height', '70px');
  });
});

test.describe('slideshow', () => {
  test('moves to the next tab after its time and skips tabs with nothing on them', async ({ page, display }) => {
    await display.open({ state: (() => { const s = seed(); s.db.items = s.db.items.filter(i => i.type !== 'task'); return s; })() });
    await expect(display.tab('Today')).toHaveAttribute('aria-selected', 'true');
    await page.clock.runFor(21_000);
    await expect(display.tab('Bus')).toHaveAttribute('aria-selected', 'true');
    await page.clock.runFor(21_000);  // Tasks is empty, so straight to Rewards
    await expect(display.tab('Rewards')).toHaveAttribute('aria-selected', 'true');
  });

  test('a tap holds the current tab', async ({ page, display }) => {
    await display.open();
    await page.locator('#status').click();
    await page.clock.runFor(45_000);
    await expect(display.tab('Today')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#rotBtn')).toHaveAttribute('aria-label', 'Resume');
  });

  test('Pause stops it until Play', async ({ page, display }) => {
    await display.open();
    await page.locator('#rotBtn').click();
    await expect(page.locator('#rotBtn')).toHaveAttribute('aria-label', 'Play');
    await page.clock.runFor(120_000);
    await expect(display.tab('Today')).toHaveAttribute('aria-selected', 'true');
  });
});

test('phones never change tabs by themselves @phone', async ({ page, display }) => {
  await display.open();
  await page.clock.runFor(60_000);
  await expect(display.tab('Today')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#rotBar')).toHaveClass(/off/);
});

test('with more departures than fit, the header ticker scrolls through them', async ({ page, display }) => {
  const state = seed();
  const dep = (line, dest, m) => ({ line, dest, time: new Date(NOW.getTime() + m * 6e4).toISOString(), platform: 'A', bg: '#2e86de', fg: '#ffffff', cancelled: false });
  state.vt.departures = [dep('6', 'Kortedala', 3), dep('16', 'Eketrägatan', 5), dep('11', 'Saltholmen', 8), dep('7', 'Bergsjön', 11), dep('25', 'Länsmansgården', 14), dep('19', 'Fredriksdal', 17)];
  await display.open({ state });
  const chip = page.locator('#busChip');
  await expect(chip).toHaveAccessibleName(/^Next bus: 6 to Kortedala, 3 min\. Then 16 to Eketrägatan, 5 min; .*19 to Fredriksdal, 17 min\. Show all departures\.$/);
  const first = chip.locator('.tki').first();
  const x0 = (await first.boundingBox()).x;
  await page.waitForTimeout(600);
  expect((await first.boundingBox()).x).toBeLessThan(x0);
});

test('on a phone the departures sit above the tabs, full width @phone', async ({ page, display }) => {
  await display.open();
  const chip = page.locator('#busChip'), tabs = page.getByRole('tablist');
  await expect(chip).toContainText('Kortedala');
  const c = await chip.boundingBox(), t = await tabs.boundingBox();
  expect(c.y + c.height).toBeLessThanOrEqual(t.y + 1);
  expect(c.width).toBeGreaterThan(t.width * 0.9);
  await page.screenshot({ path: test.info().outputPath('phone.png') });
});

test('Tomorrow shows tomorrow’s appointments, and Coming up starts after it', async ({ display }) => {
  const st = seed();
  st.db.items.push({ id: 'i-dentist', household_id: HH, type: 'event', title: 'Dentist', person_id: null, date: '2026-11-19', time: '09:30:00',
    repeat: 'none', done: false, done_on: null, countdown: false });
  await display.open({ state: st });
  await expect(display.box('tmrw').locator('h2')).toHaveText(/Tomorrow\s*Thursday 19/);
  await expect(display.box('tmrw')).toContainText('09:30Dentist');
  await expect(display.box('soon')).not.toContainText('Dentist');
  await expect(display.box('soon')).toContainText('Grandma visits');
});

const iconsCentred = async ({ page, display }) => {
  await display.open({ storage: { 'fhd.tab': 'bus' } });
  for (const name of ['Add', 'Light/dark', 'Settings', 'Add a trip']) {
    const btn = name === 'Light/dark' ? page.locator('#thBtn') : page.getByRole('button', { name, exact: true });
    const b = await btn.boundingBox(), i = await btn.locator('svg:visible').boundingBox();
    expect(Math.abs(i.x + i.width / 2 - (b.x + b.width / 2)), name).toBeLessThan(1.5);
    expect(Math.abs(i.y + i.height / 2 - (b.y + b.height / 2)), name).toBeLessThan(1.5);
  }
};
test('the icon buttons have their icon in the middle', iconsCentred);
test('the icon buttons have their icon in the middle on a phone @phone', iconsCentred);
