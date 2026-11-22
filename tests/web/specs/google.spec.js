// Google Calendar: connecting accounts in Settings, and appointments going to and from Google.
import { test, expect } from '../harness.js';
import { seed, HH, DAD, USER, TODAY } from '../fixtures.js';

const ACC = 'g-dad';
function withGoogle() {
  const s = seed();
  s.db.google_accounts = [{
    id: ACC, household_id: HH, user_id: USER.id, person_id: DAD, google_sub: '123', email: 'dad@gmail.com',
    calendars: [
      { id: 'dad@gmail.com', name: 'Dad', color: '#2e86de', primary: true, write: true, show: true },
      { id: 'family#cal', name: 'Family', color: '#16a085', primary: false, write: true, show: false },
    ],
    write_cal: 'dad@gmail.com', tz: 'Europe/Stockholm', synced_at: '2026-11-18T06:20:00.000Z', sync_error: null, created_at: '2026-11-17T08:00:00.000Z',
  }];
  // An appointment that came from Dad's Google Calendar.
  s.db.items.push({ id: 'i-dentist', household_id: HH, type: 'event', title: 'Dentist', person_id: DAD, date: TODAY, time: '11:00:00', repeat: 'none',
    done: false, done_on: null, countdown: false, created_by: null, gcal_account: ACC, gcal_cal: 'dad@gmail.com', gcal_event: 'ev1', gcal_key: 'uid1', dur_min: 30 });
  return s;
}
const openSettings = async page => { await page.getByRole('button', { name: 'Settings' }).click(); return page.locator('#ovSet'); };

test('the board asks the server to read the Google calendars when it opens', async ({ display }) => {
  await display.open({ state: withGoogle() });
  const sync = (await display.calls({ kind: 'fn', name: 'google' })).filter(c => c.body.action === 'sync');
  expect(sync.length).toBeGreaterThan(0);
  expect(sync[0].body).toMatchObject({ household: HH, tz: 'Europe/Stockholm' });
  await expect(display.box('today')).toContainText('Dentist');
});

test('without any connected account, nothing is sent to the google function', async ({ display }) => {
  await display.open();
  expect(await display.calls({ kind: 'fn', name: 'google' })).toEqual([]);
});

test('Settings lists the connected account and its calendars', async ({ page, display }) => {
  await display.open({ state: withGoogle() });
  const set = await openSettings(page);
  const acc = set.locator('.gacc');
  await expect(acc).toContainText('dad@gmail.com');
  await expect(acc.getByLabel('Their appointments show as')).toHaveValue(DAD);
  await expect(acc.getByLabel('Dad', { exact: true })).toBeChecked();
  await expect(acc.getByLabel('Family', { exact: true })).not.toBeChecked();

  await acc.getByLabel('Family', { exact: true }).check();
  await expect(set.locator('#gMsg')).toContainText('appear in a moment');
  const st = await display.state();
  expect(st.db.google_accounts[0].calendars[1].show).toBe(true);
  const sync = (await display.calls({ kind: 'fn', name: 'google' })).filter(c => c.body.action === 'sync' && c.body.force);
  expect(sync.length).toBeGreaterThan(0);
});

test('Connect Google Calendar sends the browser to Google’s sign-in', async ({ page, display }) => {
  await display.open();
  const set = await openSettings(page);
  await set.getByLabel('Whose Google account').selectOption({ label: 'Mirali' });
  // Answer Google's page with "No Content", so the browser stays on the display.
  await page.route('https://accounts.google.test/**', r => r.fulfill({ status: 204, body: '' }));
  const req = page.waitForRequest(r => r.url().startsWith('https://accounts.google.test/'));
  await set.getByRole('button', { name: 'Connect Google Calendar' }).click();
  expect((await req).url()).toContain('person=p-mirali');
  const c = (await display.calls({ kind: 'fn', name: 'google' })).find(x => x.body.action === 'connect');
  expect(c.body).toMatchObject({ household: HH, person_id: 'p-mirali', return_to: 'http://display.test/' });
});

test('an appointment added for Dad is sent to his Google Calendar', async ({ page, display }) => {
  await display.open({ state: withGoogle() });
  await page.getByRole('button', { name: '+ Add' }).click();
  const dlg = page.locator('#ovAdd');
  await dlg.getByRole('button', { name: 'Appointment' }).click();
  await dlg.getByLabel('What').fill('Haircut');
  await dlg.getByLabel('Who').selectOption({ label: 'Dad' });
  await dlg.getByLabel('Time').fill('17:30');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await display.settled();
  const st = await display.state(), it = st.db.items.find(i => i.title === 'Haircut');
  const push = (await display.calls({ kind: 'fn', name: 'google' })).filter(c => c.body.action === 'push');
  expect(push.map(c => c.body.item)).toEqual([it.id]);
});

test('a task or someone without Google stays on the display only', async ({ page, display }) => {
  await display.open({ state: withGoogle() });
  await page.getByRole('button', { name: '+ Add' }).click();
  const dlg = page.locator('#ovAdd');
  await dlg.getByRole('button', { name: 'Appointment' }).click();
  await dlg.getByLabel('What').fill('Football');
  await dlg.getByLabel('Who').selectOption({ label: 'Mirali' });
  await dlg.getByRole('button', { name: 'Save' }).click();
  await display.settled();
  expect((await display.calls({ kind: 'fn', name: 'google' })).filter(c => c.body.action === 'push')).toEqual([]);
});

test('deleting an appointment from Google deletes it there too, and the dialog says so', async ({ page, display }) => {
  await display.open({ state: withGoogle() });
  const b = display.box('today').getByRole('button', { name: /Dentist/ });
  await b.hover(); await page.mouse.down(); await page.clock.runFor(600); await page.mouse.up();
  const dlg = page.locator('#ovAdd');
  await expect(dlg.locator('#fGNote')).toHaveText(/dad@gmail\.com’s Google Calendar/);
  await dlg.getByRole('button', { name: 'Delete' }).click();
  await display.settled();
  const rm = (await display.calls({ kind: 'fn', name: 'google' })).find(c => c.body.action === 'remove');
  expect(rm.body).toMatchObject({ household: HH, account: ACC, cal: 'dad@gmail.com', event: 'ev1' });
  await expect(display.box('today')).not.toContainText('Dentist');
});

test('disconnecting takes two taps and removes what came from Google', async ({ page, display }) => {
  await display.open({ state: withGoogle() });
  const set = await openSettings(page);
  const b = set.locator('.gacc').getByRole('button', { name: 'Disconnect' });
  await b.click();
  await expect(set.locator('.gacc').getByRole('button', { name: 'Tap again to disconnect' })).toBeVisible();
  expect((await display.calls({ kind: 'fn', name: 'google' })).some(c => c.body.action === 'disconnect')).toBe(false);
  await set.locator('.gacc').getByRole('button', { name: 'Tap again to disconnect' }).click();
  await expect(set.locator('#gMsg')).toContainText('Disconnected');
  await expect(set.locator('.gacc')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await display.sync();
  await expect(display.box('today')).not.toContainText('Dentist');
});

test('coming back from Google says it worked and syncs straight away', async ({ page, display }) => {
  await display.open({ state: withGoogle() });
  await page.goto('http://display.test/?gcal=ok');
  await display.settled();
  await page.clock.runFor(1500);
  await expect(display.toast).toContainText('Google Calendar connected');
  expect(new URL(page.url()).search).toBe('');
  const sync = (await display.calls({ kind: 'fn', name: 'google' })).filter(c => c.body.action === 'sync' && c.body.force);
  expect(sync.length).toBeGreaterThan(0);
});
