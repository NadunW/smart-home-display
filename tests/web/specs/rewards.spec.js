// Reward notes: Mirali earns notes for things on her chart and spends them on rewards.
// She starts with 6 notes (a bonus yesterday) and is saving for Leo's Lekland (30).
import { test, expect } from '../harness.js';
import { seed, TODAY, MIRALI, RI } from '../fixtures.js';

const balance = async display => (await display.state()).db.reward_log.filter(l => l.person_id === MIRALI).reduce((s, l) => s + l.notes, 0);

test.describe('Rewards tab', () => {
  test.beforeEach(async ({ display }) => { await display.open({ storage: { 'fhd.tab': 'rw' } }); });

  test('shows each child with their balance, goal and chart', async ({ display }) => {
    const box = display.box('rw');
    await expect(box.locator('.rwk')).toHaveCount(1);  // Dad has no chart
    await expect(box.locator('.rwk .bal')).toHaveText('6 notes');
    await expect(box.locator('.rwp > .goal')).toHaveText('🦁 Saving for Trip to Leo’s Lekland6 / 30');
    await expect(box.locator('.rwg h4')).toHaveText(['Chores', 'Learning', '🎁 Screen time', '🎁 Treats']);
  });

  test('tapping a chore earns its notes, and it can’t be earned twice a day', async ({ page, display }) => {
    const bed = page.getByRole('button', { name: 'Make your bed: earn 1 notes' });
    await bed.click();
    await expect(display.box('rw').locator('.rwk .bal')).toHaveText('7 notes');
    await expect(display.toast).toContainText('+1 notes for Mirali 🎉');
    const done = page.getByRole('button', { name: 'Make your bed: done today' });
    await expect(done).toHaveClass(/done/);
    await expect.poll(() => balance(display)).toBe(7);
    expect((await display.calls({ kind: 'rpc', name: 'reward_earn' }))[0].args).toEqual({ p_item: RI.bed, p_person: MIRALI, p_day: TODAY });

    await done.click();
    await expect(display.toast).toContainText('Already done today. Well done!');
    expect(await display.calls({ kind: 'rpc', name: 'reward_earn' })).toHaveLength(1);
  });

  test('Undo in the message takes the notes back', async ({ page, display }) => {
    await page.getByRole('button', { name: 'Read for 30 min: earn 3 notes' }).click();
    await expect(display.box('rw').locator('.rwk .bal')).toHaveText('9 notes');
    await display.toast.getByRole('button', { name: 'Undo' }).click();
    await expect(display.box('rw').locator('.rwk .bal')).toHaveText('6 notes');
    await expect(page.getByRole('button', { name: 'Read for 30 min: earn 3 notes' })).toBeVisible();
    await expect.poll(() => balance(display)).toBe(6);
  });

  test('a reward she can’t afford is greyed out and says how many notes to go', async ({ page, display }) => {
    const lekland = page.getByRole('button', { name: 'Trip to Leo’s Lekland: costs 30 notes' });
    await expect(lekland).toHaveClass(/cant/);
    await expect(lekland).toHaveClass(/goal/);
    await lekland.click();
    await expect(display.toast).toContainText('24 more notes to go. Keep going!');
    await expect(page.locator('#ovRw')).not.toHaveClass(/\bon\b/);
  });

  test('spending asks first, then takes the notes', async ({ page, display }) => {
    // Tapping a reward on the board opens the reward screen and asks there.
    await page.getByRole('button', { name: '30 min TV: costs 5 notes' }).click();
    await expect(page.locator('#ovRw')).toHaveClass(/\bon\b/);
    const confirm = page.locator('#rwConfirm');
    await expect(confirm).toContainText('Spend 5 notes on 📺 30 min TV?');
    await confirm.getByRole('button', { name: 'Not now' }).click();
    await expect(confirm).toBeHidden();
    expect(await display.calls({ kind: 'rpc', name: 'reward_spend' })).toHaveLength(0);

    await page.locator('#ovRw .tile', { hasText: '30 min TV' }).click();
    await confirm.getByRole('button', { name: 'Yes, spend' }).click();
    await expect(display.toast).toContainText('Enjoy! 📺 30 min TV');
    await expect(page.locator('#rwBal')).toHaveText('1 notes');
    await expect.poll(() => balance(display)).toBe(1);
  });

  test('a refusal from the server is shown and nothing changes', async ({ page, display }) => {
    await display.set(s => { s.fail['rpc.reward_earn'] = 'Already earned today'; });
    await page.getByRole('button', { name: 'Make your bed: earn 1 notes' }).click();
    await expect(display.toast).toContainText('Already earned today');
    await expect(display.box('rw').locator('.rwk .bal')).toHaveText('6 notes');
  });
});

test.describe('reward screen (tap the name)', () => {
  test.beforeEach(async ({ page, display }) => {
    await display.open({ storage: { 'fhd.tab': 'rw' } });
    await page.locator('.rwk').click();
    await expect(page.locator('#ovRw')).toHaveClass(/\bon\b/);
  });

  test('History lists recent notes, and a bonus can be given', async ({ page, display }) => {
    const ov = page.locator('#ovRw');
    await ov.getByRole('button', { name: 'History' }).click();
    await expect(ov.locator('.hist')).toHaveCount(1);
    await expect(ov.locator('.hist').first()).toContainText('Helped grandmaYesterday+6');
    await ov.getByLabel('Reason').fill('Tidied the hall');
    await ov.getByLabel('Notes', { exact: true }).fill('2');
    await ov.getByRole('button', { name: '+ Give' }).click();
    await expect(ov.locator('.hist').first()).toContainText('Tidied the hallToday+2');
    await expect(page.locator('#rwBal')).toHaveText('8 notes');
    await expect.poll(() => balance(display)).toBe(8);
  });

  // Known bug: a sync redraws the open reward screen and wipes what's being typed, so the
  // note is saved as "Bonus". Marked as expected to fail; remove test.fail once it's fixed.
  test('a reason being typed survives a sync', async ({ page, display }) => {
    test.fail();
    const ov = page.locator('#ovRw');
    await ov.getByRole('button', { name: 'History' }).click();
    await ov.getByLabel('Reason').fill('Tidied the hall');
    await display.sync();
    await expect(ov.getByLabel('Reason')).toHaveValue('Tidied the hall', { timeout: 2000 });
  });

  test('☆ picks the reward she is saving for', async ({ page, display }) => {
    const ov = page.locator('#ovRw');
    await ov.getByRole('button', { name: 'Spend notes' }).click();
    await ov.getByRole('button', { name: 'Save up for 30 min TV' }).click();
    await expect(ov.getByRole('button', { name: 'Stop saving for 30 min TV' })).toHaveAttribute('aria-pressed', 'true');
    await expect(display.box('rw').locator('.rwp > .goal')).toContainText('Saving for 30 min TV');
    await expect.poll(async () => (await display.state()).db.people.find(p => p.id === MIRALI).goal_item).toBe(RI.tv);
  });

  test('Edit chart adds a new way to earn', async ({ page, display }) => {
    const ov = page.locator('#ovRw');
    await ov.getByRole('button', { name: 'Edit chart' }).click();
    await ov.getByRole('button', { name: 'Add a way to earn' }).click();
    const form = page.locator('#ovRi');
    await form.getByLabel('What').fill('Feed the cat');
    await form.getByLabel('Notes earned').fill('2');
    await form.getByLabel('Group').fill('Chores');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form).not.toHaveClass(/\bon\b/);
    await expect(ov.locator('.tile', { hasText: 'Feed the cat' })).toBeVisible();
    const row = (await display.state()).db.reward_items.find(i => i.title === 'Feed the cat');
    expect(row).toMatchObject({ kind: 'earn', notes: 2, per: 'day', category: 'Chores', person_id: MIRALI });
  });
});

test('a family without a chart can start with the example chart', async ({ page, display }) => {
  const s = seed();
  s.db.reward_items = []; s.db.reward_log = []; s.db.people[0].goal_item = null;
  await display.open({ state: s, storage: { 'fhd.tab': 'rw' } });
  await expect(display.box('rw')).toContainText('Kids earn notes for chores and good habits');
  await page.getByLabel('Who the chart is for').selectOption({ label: 'Mirali' });
  await page.getByRole('button', { name: 'Start with the example chart' }).click();
  await expect(page.locator('#ovRw')).toHaveClass(/\bon\b/);
  const st = await display.state();
  expect(st.db.reward_items.length).toBe(37);
  const goal = st.db.reward_items.find(i => /Lekland/.test(i.title));
  expect(st.db.people.find(p => p.id === MIRALI).goal_item).toBe(goal.id);
  await page.locator('#ovRw [data-close]').click();
  await expect(display.box('rw').locator('.rwp > .goal')).toContainText('Saving for Trip to Leo’s Lekland');
});

test('if the reward tables aren’t set up, the Rewards tab is hidden', async ({ display }) => {
  const s = seed();
  s.fail['reward_items.select'] = { message: 'relation does not exist', code: '42P01' };
  await display.open({ state: s });
  await expect(display.tab('Today')).toBeVisible();
  await expect(display.tab('Rewards')).toBeHidden();
});
