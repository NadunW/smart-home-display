# Changelog

Changes to the family display, newest first. The version is the one shown in the
footer (see *Version number* in the README). Changes that don't touch the page
(Android app, server, workflows) are listed under the version that was current
when they were merged.

## 1.0.5 — 2026-11-20

### Display
- The reward chart grows to fill the Rewards tab: the fewer things on it, the bigger the rows. Settings → Display → *Reward chart size* can set it to Small, Medium or Large on each screen instead (#19).

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
