// Signing in, creating an account, setting up or joining a family, and signing out.
import { test, expect } from '../harness.js';
import { seed, USER } from '../fixtures.js';

test.describe('signed out', () => {
  test.beforeEach(async ({ display }) => { await display.open({ state: seed({ signedIn: false }) }); });

  test('shows the sign-in screen with the clock', async ({ page, display }) => {
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('#vAuth [data-clock]')).toHaveText('07:30');
    await expect(display.board).toBeHidden();
  });

  test('a wrong password is explained and the board stays hidden', async ({ page, display }) => {
    await page.getByLabel('Email').fill(USER.email);
    await page.locator('#vAuth').getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#aMsg')).toHaveText('Invalid login credentials');
    await expect(display.board).toBeHidden();
  });

  test('the right password opens the family board', async ({ page, display }) => {
    await page.getByLabel('Email').fill(USER.email);
    await page.locator('#vAuth').getByLabel('Password').fill(USER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(display.board).toBeVisible();
    await expect(page.locator('#status')).toHaveText('Synced · 07:30');
  });

  test('creating an account that needs email confirmation says to check the email', async ({ page, display }) => {
    await display.set(s => { s.confirmEmail = true; });
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
    await page.getByLabel('Email').fill('new@example.com');
    await page.locator('#vAuth').getByLabel('Password').fill('a-long-password');
    await page.locator('#aGo').click();
    await expect(page.locator('#aMsg')).toContainText('Check your email');
    await expect(display.board).toBeHidden();
  });

  test('forgot password needs an email first, then sends the link', async ({ page, display }) => {
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.locator('#aMsg')).toHaveText('Type your email first.');
    await page.getByLabel('Email').fill(USER.email);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.locator('#aMsg')).toContainText('reset link is on its way');
    expect(await display.calls({ kind: 'auth', op: 'reset' })).toHaveLength(1);
  });
});

test.describe('signed in without a family', () => {
  test.beforeEach(async ({ display }) => { await display.open({ state: seed({ family: false }) }); });

  test('creating a family opens Settings with a welcome', async ({ page, display }) => {
    await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
    await page.locator('#vSetup').getByLabel('Family name').fill('Familjen Ny');
    await page.getByRole('button', { name: 'Create family' }).click();
    await expect(display.board).toBeVisible();
    await expect(page.locator('#ovSet')).toHaveClass(/\bon\b/);
    await expect(page.locator('#setWelcome')).toBeVisible();
    await expect(page.locator('#sCode')).toHaveText('NEWCODE1');
  });

  test('a join code that matches no family is explained', async ({ page, display }) => {
    await page.getByPlaceholder('8-letter code').fill('NOPENOPE');
    await page.getByRole('button', { name: 'Join family' }).click();
    await expect(page.locator('#sMsg')).toHaveText('That code doesn’t match a family. Check it and try again.');
    await expect(display.board).toBeHidden();
  });
});

test('signing out from Settings goes back to the sign-in screen', async ({ page, display }) => {
  await display.open();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#ovSet [data-signout]').click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(display.board).toBeHidden();
});
