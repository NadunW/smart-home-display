// Settings: its sections are tabs (Family, Places, Display, Tabs, Calendar), one showing at a time.
import { test, expect } from '../harness.js';
import { seed } from '../fixtures.js';

const openSettings = async page => { await page.getByRole('button', { name: 'Settings' }).click(); return page.locator('#ovSet'); };
const stab = (set, name) => set.getByRole('tab', { name, exact: true });

test('Settings opens on Family and shows one section at a time', async ({ page, display }) => {
  await display.open();
  const set = await openSettings(page);
  for (const n of ['Family', 'Places', 'Display', 'Tabs', 'Calendar']) await expect(stab(set, n)).toBeVisible();
  await expect(stab(set, 'Family')).toHaveAttribute('aria-selected', 'true');
  await expect(set.getByLabel('Family name')).toHaveValue('Familjen Test');
  await expect(set.locator('#sCode')).toHaveText('TESTCODE');
  await expect(set.getByLabel('Search stop')).toBeHidden();

  await stab(set, 'Places').click();
  await expect(set.getByLabel('Search stop')).toBeVisible();
  await expect(set.getByLabel('Family name')).toBeHidden();
  await stab(set, 'Tabs').click();
  await expect(set.getByText('Change tabs by themselves, like a slideshow')).toBeVisible();
  // Save, Cancel and Sign out stay in reach on every section.
  await expect(set.getByRole('button', { name: 'Save' })).toBeVisible();
  await expect(set.getByRole('button', { name: 'Sign out' })).toBeVisible();
});

test('arrow keys move between the Settings sections', async ({ page, display }) => {
  await display.open();
  const set = await openSettings(page);
  await stab(set, 'Family').focus();
  await page.keyboard.press('ArrowDown');
  await expect(stab(set, 'Places')).toHaveAttribute('aria-selected', 'true');
  await expect(stab(set, 'Places')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(stab(set, 'Calendar')).toHaveAttribute('aria-selected', 'true');
});

test('changes on different sections are saved together', async ({ page, display }) => {
  await display.open();
  const set = await openSettings(page);
  await set.getByLabel('Family name').fill('Familjen Ändrad');
  await stab(set, 'Places').click();
  await set.getByLabel('Search stop').fill('Chalmers');
  await set.getByRole('button', { name: 'Search' }).first().click();
  await set.getByRole('button', { name: 'Chalmers, Göteborg' }).click();
  await expect(set.locator('#sStopCur')).toContainText('Chalmers, Göteborg');
  await set.getByRole('button', { name: 'Save' }).click();
  await expect(set).not.toHaveClass(/\bon\b/);
  const hh = (await display.state()).db.households[0];
  expect(hh.name).toBe('Familjen Ändrad');
  expect(hh.vt_stop).toBe('Chalmers, Göteborg');
});

test('Settings reopens on the section used last', async ({ page, display }) => {
  await display.open();
  let set = await openSettings(page);
  await stab(set, 'Display').click();
  await set.getByRole('button', { name: 'Cancel' }).click();
  set = await openSettings(page);
  await expect(stab(set, 'Display')).toHaveAttribute('aria-selected', 'true');
  await expect(set.getByLabel('Theme')).toBeVisible();
});

test('without Google Calendar set up, the Calendar section is left out', async ({ page, display }) => {
  const s = seed();
  s.fail['google_accounts.select'] = { message: 'relation does not exist', code: '42P01' };
  await display.open({ state: s });
  const set = await openSettings(page);
  await expect(stab(set, 'Family')).toBeVisible();
  await expect(stab(set, 'Calendar')).toBeHidden();
});

test('on a phone the sections sit in a row on top and the buttons stay on screen @phone', async ({ page, display }) => {
  await display.open();
  const set = await openSettings(page);
  const fam = await stab(set, 'Family').boundingBox(), pl = await stab(set, 'Places').boundingBox();
  expect(Math.abs(fam.y - pl.y)).toBeLessThan(2);
  expect(pl.x).toBeGreaterThan(fam.x);
  const save = await set.getByRole('button', { name: 'Save' }).boundingBox();
  expect(save.y + save.height).toBeLessThanOrEqual(page.viewportSize().height);
});
