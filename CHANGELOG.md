# Changelog

Changes to the family display, newest first. The version is the one shown in the
footer (see *Version number* in the README). Changes that don't touch the page
(Android app, server, workflows) are listed under the version that was current
when they were merged.

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
