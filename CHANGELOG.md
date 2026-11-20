# Changelog

Changes to the family display, newest first. The version is the one shown in the
footer (see *Version number* in the README). Changes that don't touch the page
(Android app, server, workflows) are listed under the version that was current
when they were merged.

## 1.0.11 — 2026-11-21

### Display
- The Weather tab has four new boxes: rain in the next 2 hours (when it starts and stops, in 15-minute bars), what to wear for the school day (tomorrow's after 17:00), the next 7 days, and SMHI's weather warnings for our area, in English. Tomorrow's summary is gone, since the 7 days show it. The Weather tab now stays up for 20 seconds in the slideshow on a display that hasn't changed it (#27).

## 1.0.10 — 2026-11-21

### Display
- Behind the scenes: a small file that proves to Google the display's web address belongs to us, so Google can approve the Google Calendar connection. Nothing looks different (#26).

## 1.0.9 — 2026-11-20

### Display
- New public *About* and *Privacy policy* pages, linked from the sign-in screen. They explain what the display does and how it uses Google Calendar, which Google asks for before it lets everyone connect (#25).

## 1.0.8 — 2026-11-20

### Display
- Google Calendar: everyone can connect their own Google account in Settings → Google Calendar. Their appointments show on the display, and appointments and reminders added on the display for them go into their Google Calendar. Changes and deletions go both ways (#24).

### Server
- New `google` server function that signs in with Google, keeps everyone's calendars in step with the display and holds the Google keys, so they never reach the browser (#24).

## 1.0.7 — 2026-11-20

### Display
- The next bus moved from the top of the screen to the empty space next to the tabs and became a ticker: it shows the next few departures and slowly scrolls through them when they don't all fit. Tap it for the Bus tab, as before. On phones it sits just above the tabs (#23).

## 1.0.6 — 2026-11-20

### Display
- Behind the scenes: the page is now split into smaller files, so it's easier to change without breaking things. Nothing looks or works differently (#22).

## 1.0.5 — 2026-11-20

### Display
- The reward chart grows to fill the Rewards tab: the fewer things on it, the bigger the rows. Settings → Display → *Reward chart size* can set it to Small, Medium or Large on each screen instead (#19).

### Hosting
- Every change is now checked automatically before it can be merged: the page, the bus-time server, the database updates and the Android app are tested first, so a broken change can't reach the display (#20).
- Every change to the page is now also tried out in a test browser first: signing in, the tabs, bus times and trips, tasks and the reward chart are tapped through automatically, so a change that breaks one of them can't reach the display (#21).

## 1.0.4 — 2026-11-20

### Display
- The Rewards tab shows the whole chart: tap a chore or habit to earn its notes straight away (Undo in the message), tap a reward to spend (it asks first). Done ones get a ✓, rewards you can't afford yet are greyed out and the one being saved for has a ★. Tap the name for history, bonus and *Edit chart* (#18).

## 1.0.3 — 2026-11-20

### Display
- New *Trips* box on the Bus tab: save trips like Office, University or School and see when to leave, the next connections with arrival times, delays and the lines on the way, like the Västtrafik app (#16).

### Server
- The Västtrafik function can plan trips and find addresses and places, not just stops (#16).

### Hosting
- Updates to the display no longer fail when GitHub is slow to list the new version (#17).

## 1.0.2 — 2026-11-20

### Display
- Tabs change by themselves like a slideshow, with a bar showing when the next one comes. Empty tabs are skipped, a tap holds the current tab for a minute, and *Pause* stops it. Settings → Tabs chooses which tabs show, their order and how long each stays up (#15).

## 1.0.1 — 2026-11-20

### Display
- New layout: clock, weather, countdown, next bus and buttons in the header, *Synced* and the version in the footer, and the rest split into tabs (Today, Bus, Tasks, Rewards, Weather). Tap a tab to switch, or tap the bus in the header for all departures. Each tab has its own *Arrange* layout and fills the screen (#14).

## 1.0.0 — 2026-11-20

First numbered version. Everything built so far:

### Display
- Footer shows the version and when the page was last updated, right-aligned next to *Synced* (#11, #12).
- Preview the dimmed brightness while moving the slider in Settings (#10).
- Open displays reload themselves within a few minutes of a deploy; no restart needed (#9).
- Today's weather forecast in the header: feels like, wind, high/low, chance of rain and an hourly strip (#8).
- One-tap ☀/☾ button to switch between light and dark (#7).
- *Arrange* the board: drag boxes to move them, drag a corner to resize; layout saved per device (#6).
- Reward notes: kids earn notes for things on their chart and spend them on rewards, with a savings goal, history and undo (#5).
- Dark theme that switches at sunset, with Settings → Theme (#3).
- Clock, countdown, appointments, family tasks with progress, reminders and live Västtrafik departures; family accounts with a join code (first version).

### Android app
- Full-screen wall app that keeps the screen on and dims and wakes it on a schedule; hidden menu in the top-left corner (#4).

### Hosting
- The page is published to GitHub Pages automatically (#2).
- Database changes and the Västtrafik function deploy to Supabase with GitHub Actions (#1).
