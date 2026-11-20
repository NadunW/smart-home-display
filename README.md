# Family Home Display

A kitchen/wall display for the family: clock, weather, countdown, today's appointments, everyone's tasks with progress, reminders and live Västtrafik departures. Family members sign in with their own accounts; everything syncs live between the wall tablet and phones.

```
web/                         the app (static files: host anywhere)
  index.html
  config.js                  ← your Supabase URL + key go here
supabase/
  migrations/                database, access rules, create/join family (applied in order)
  functions/vasttrafik/      server function that holds the Västtrafik key
```

## How it works

- **Accounts**: email + password through Supabase Auth.
- **Families**: whoever signs up first creates the family and gets an 8-letter **join code** (shown in Settings). Others create their own account, choose *Join family* and enter the code. The creator can issue a new code anytime.
- **People on the display** (kids, grandparents) don't need accounts. They're just names and colours.
- **Privacy**: row-level security means a signed-in user only ever sees rows for families they belong to.
- **Bus times**: the app calls the `vasttrafik` server function, which logs in to Västtrafik with *your* key, looks up departures and caches them for 20 seconds. The key never reaches the browser, and only signed-in users can call it.
- **Weather**: Open-Meteo, free, no key.
- **Reward notes**: kids earn notes for things on their chart (chores, habits, learning) and spend them on rewards. Tap a child's balance on the display to earn or spend; each child can star one reward to save up for, and it shows as a progress bar. *Edit chart* changes what's on it; *History* shows recent notes, lets you undo one, and give a bonus or take notes away. Each thing to earn can be limited to once a day or once a week; the server checks the limit and that there are enough notes before anything is spent.
- **Arrange the board**: tap *Arrange* to move boxes around the 12-column grid and drag a box's corner to resize it (each box has a smallest size so its content stays readable). Boxes float up to fill gaps and push others aside. The layout is saved on each device, so the wall tablet and a laptop can differ; *Reset layout* goes back to the default. On phones the boxes stack in one column in the same order. Keyboard: arrow keys move the focused box, Shift+arrows resize.

## Setup (about 20 minutes)

### 1. Supabase project
1. Create a free project at supabase.com.
2. **SQL Editor** → New query → paste each file in `supabase/migrations/` in order → **Run**.
3. **Authentication → URL Configuration**: set **Site URL** to the address where you'll host the app (step 4), so the confirmation and password-reset emails link back to it.

### 2. Västtrafik key
1. Sign in at developer.vasttrafik.se and create an application.
2. Subscribe the application to **Planera Resa v4**.
3. Copy the application's key (client ID) and secret.

### 3. Deploy the server function
**Easiest, from the dashboard:** Edge Functions → *Deploy a new function* → *Via editor* → name it exactly `vasttrafik` → paste `supabase/functions/vasttrafik/index.ts` → Deploy. Then Edge Functions → **Secrets** → add `VT_CLIENT_ID` and `VT_CLIENT_SECRET`.

**Or with the CLI:**
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set VT_CLIENT_ID=xxxx VT_CLIENT_SECRET=yyyy
supabase functions deploy vasttrafik
```
Keep "Verify JWT" on (the default), so only signed-in users can use your key.

### 3b. Automatic deploys (GitHub Actions)
Instead of steps 1.2 and 3 by hand, `.github/workflows/deploy-supabase.yml` applies the database migrations and deploys the `vasttrafik` function every time `supabase/` changes on `main`. You can also run it by hand: **Actions → Deploy to Supabase → Run workflow**.

Add these under **Repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → Generate |
| `SUPABASE_PROJECT_REF` | the 20-letter id in your project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_DB_PASSWORD` | the database password you chose when creating the project |
| `VT_CLIENT_ID` / `VT_CLIENT_SECRET` | your Västtrafik app (optional; skip if you set them in the dashboard) |

If the migration step fails with an IPv6 error, add a `SUPABASE_DB_URL` secret instead, set to the **Session pooler** connection string from the project's **Connect** button. The workflow uses it when it's present.

Migration files are named by the version Supabase records (`<timestamp>_<name>.sql`), so the CLI can tell which ones a project already has. Add new database changes as new files with a later timestamp (e.g. `supabase migration new add_meals`); never edit one that has already been applied.

If you ran a migration by hand in the SQL Editor, tell the CLI once so it doesn't run it again:
`supabase migration repair --status applied <version> --remote=<ref> --password <db-password>`.

### 4. Host the app

**GitHub Pages (set up in this repo):** `.github/workflows/deploy-pages.yml` publishes the `web` folder on every change to `web/` on `main`. One-time setup:
1. The repo must be public (or on a paid GitHub plan). It contains no secrets: only the public Supabase key.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Run **Actions → Deploy app to GitHub Pages → Run workflow** (or push a change to `web/`).
4. The app is then at `https://<user>.github.io/<repo>/`. Put that address in Supabase's **Site URL** and **Redirect URLs** (Authentication → URL Configuration).

**Or any other static host:**
1. Edit `web/config.js` and fill in the Project URL and the publishable (or anon) key from **Project Settings → API**. That key is meant to be public.
2. Put the `web` folder online. Any static host works:
   - **Netlify Drop**: drag the `web` folder onto app.netlify.com/drop.
   - **GitHub Pages**: push the folder to a repo and enable Pages.
3. Put that address into Supabase's Site URL (step 1.3).

### 5. Wall tablet
- Open the address, create your account, create the family, add people, search for your stop and town in Settings.
- **Android**: Fully Kiosk Browser (or Chrome → *Add to home screen*) and keep the charger in.
- **iPad**: Safari → Share → *Add to Home Screen*, then Guided Access to lock it to the app. Set Auto-Lock to Never.
- The app also asks the browser to keep the screen awake after the first tap.

## Android wall app

`android/` is a small app that shows the page full screen, keeps the screen on and lets the page dim and wake the screen. GitHub builds it automatically (`.github/workflows/android.yml`); every build on `main` is published as the latest release.

**Install on the tablet**
1. On the tablet, open `https://github.com/NadunW/smart-home-display/releases/latest/download/family-display.apk`.
2. Allow installing from your browser when Android asks (Settings → Apps → Special access → Install unknown apps).
3. Open **Family Display**, sign in, and pick your screen rules in **Settings → Display → Wall screen**.
4. Optional, for a true kiosk: press Home, choose **Family Display** and *Always*. It then starts by itself after a reboot.

**Screen rules** (per device): bright during the daily bright hours, during bus time on weekday mornings, from a set number of minutes before any appointment or reminder with a time until 10 minutes after it, and for a few minutes after a tap. Otherwise dimmed, and darkest at night. A tap on a dimmed screen only wakes it, so you don't press a button by accident. Moving the *Dimmed brightness* slider shows that level for a couple of seconds, then the screen goes back to what the rules say.

**Hidden menu**: tap the top-left corner five times quickly → reload, Android settings, choose home app, close.

**Page updates are automatic**: every deploy to GitHub Pages writes a new `version.txt`. Open displays (the app, Fully Kiosk, a browser tab or a phone) check it every 2 minutes and reload themselves within a few minutes of a deploy, waiting while a dialog is open, *Arrange* is on or someone is typing. No restart needed.

**App updates**: install the new APK over the old one. All builds are signed with the key in `android/app/keystore/`, so they update in place. To use your own key instead, add `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` as repository secrets (changing keys means uninstalling once).

## Notes
- The free Supabase tier pauses a project after a week with no activity. A wall display that's always on keeps it active.
- Supabase's built-in email sender is rate-limited and meant for testing. For more than a handful of families, add your own SMTP under Authentication → Emails.
- **Theme**: by default the display turns dark at sunset and light at sunrise, using the sunrise and sunset times for the family's town. Each device can override it in Settings → Display (follow the device, always light, always dark).
- Daily and weekly tasks reset automatically: a daily task counts as done only on the day it was ticked, a weekly one only in that ISO week.
- The Västtrafik response fields were taken from their v4 API model (`estimatedOtherwisePlannedTime`, `serviceJourney.line`, …). If a field ever comes back empty, check the function logs in the Supabase dashboard.
