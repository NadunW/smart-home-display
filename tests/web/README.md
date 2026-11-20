# Behaviour tests for the display

These tests open the real `web/index.html` in a browser and use it the way the family does:
sign in, switch tabs, tick tasks, earn and spend reward notes. They check what's on the
screen and what got saved. They don't look inside the page's code, so they keep passing
when the code is reorganised, as long as the display behaves the same.

Nothing goes to the internet:

- **Supabase** is replaced by `fake/supabase.js`, which keeps the family's data in memory
  and answers the same calls (tables, `reward_earn`/`reward_spend` and the other database
  functions, sign-in, realtime, the `vasttrafik` function).
- **Open-Meteo**, **SMHI's warnings** and the web font are answered from `harness.js` (no warnings unless a test passes `warnings`).
- **The clock** is set to Wednesday 18 November 2026, 07:30 in Europe/Stockholm, so bus
  times, "Leave in 6 min" and the daily tasks read the same on every run.

The starting data (the family, Mirali's chart, bus times, a trip to school, the forecast)
is in `fixtures.js`.

## Run them

```bash
cd tests/web
npm ci
npx playwright install chromium     # once
npx playwright test                 # all of them
npx playwright test --ui            # watch them run, step through
npx playwright test -g "Undo"       # just the ones with "Undo" in the name
```

There are two screen sizes: `tablet` (1280×800, like the wall tablet) runs everything;
`phone` runs only tests with `@phone` in the name.

To use a Chrome you already have instead of downloading Playwright's: `PW_CHANNEL=chrome npx playwright test`.

CI runs them on every pull request that touches `web/` or `tests/web/` (the *Web app checks*
job). When one fails, the run keeps a report with a screenshot and a trace of the failing
test under *Artifacts → web-test-report*.

## Writing a test

```js
import { test, expect } from '../harness.js';
import { seed } from '../fixtures.js';

test('ticking a task counts it as done', async ({ page, display }) => {
  await display.open({ storage: { 'fhd.tab': 'tasks' } });   // start on the Tasks tab
  await page.getByRole('button', { name: 'Mark Make the bed done' }).click();
  await expect(display.box('tasks').locator('.big')).toHaveText('1 of 3done today');
});
```

- `display.open({ state, storage })`: `state` is the backend's starting data (change a copy
  of `seed()`); `storage` sets this device's settings (`fhd.tab`, `fhd.theme`, `fhd.rotate`…).
- `display.state()` is what the fake backend holds now; `display.calls({ kind: 'rpc' })` lists
  what the page asked it.
- `display.set(s => { s.fail['items.insert'] = 'message' })` makes the next call of that kind
  fail, to test the error messages.
- `display.sync()` does what a realtime change or the 5-minute refresh does.
- `page.clock.runFor(21_000)` moves time on, for the slideshow and countdowns.

Find things the way a person would (button names, labels, text) where you can. Element ids
are fine when there's nothing better.

## Known bugs

A test marked `test.fail()` describes a bug that's still there. It passes while the bug
exists. When the bug is fixed, the test fails as a reminder to remove `test.fail()`.

- *A reason being typed survives a sync* (`specs/rewards.spec.js`): a sync redraws the open
  reward screen and clears the bonus reason, so the note is saved as "Bonus".
