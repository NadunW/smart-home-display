// Press and hold an appointment, task or reminder to change it; a quick tap doesn't open the dialog.
import { test, expect } from '../harness.js';

const hold = async (page, loc, ms = 600) => { await loc.hover(); await page.mouse.down(); await page.clock.runFor(ms); await page.mouse.up(); };

test.beforeEach(async ({ display }) => { await display.open(); });

test('a quick tap on an appointment only says to hold it', async ({ page, display }) => {
  await display.box('today').getByRole('button', { name: /Swimming/ }).click();
  await expect(display.toast).toContainText('Hold to change or delete it');
  await expect(page.locator('#ovAdd')).not.toHaveClass(/\bon\b/);
});

test('holding an appointment opens it to change', async ({ page, display }) => {
  await hold(page, display.box('today').getByRole('button', { name: /Swimming/ }));
  await expect(page.locator('#ovAdd')).toHaveClass(/\bon\b/);
  await expect(page.locator('#ovAdd').getByLabel('What')).toHaveValue('Swimming');
});

test('letting go too early doesn’t open it', async ({ page, display }) => {
  await hold(page, display.box('today').getByRole('button', { name: /Swimming/ }), 200);
  await expect(page.locator('#ovAdd')).not.toHaveClass(/\bon\b/);
});

test('holding a reminder opens it, and tapping its name doesn’t dismiss it', async ({ page, display }) => {
  const name = display.box('rems').getByRole('button', { name: /Pack the gym bag/ });
  await name.click();
  await expect(display.box('rems')).toContainText('Pack the gym bag');
  await hold(page, name);
  await expect(page.locator('#ovAdd').getByLabel('What')).toHaveValue('Pack the gym bag');
});

test('a tap on a task’s name ticks it; holding opens it', async ({ page, display }) => {
  await page.getByRole('tab', { name: 'Tasks' }).click();
  await page.getByRole('button', { name: 'Make the bed', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark Make the bed not done' })).toBeVisible();
  await hold(page, page.getByRole('button', { name: 'Make the bed', exact: true }));
  await expect(page.locator('#ovAdd').getByLabel('What')).toHaveValue('Make the bed');
});

test('Enter on a focused appointment still opens it', async ({ page, display }) => {
  await display.box('today').getByRole('button', { name: /Swimming/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ovAdd')).toHaveClass(/\bon\b/);
});
