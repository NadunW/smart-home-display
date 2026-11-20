# Notes for working on this repo

## Changelog
Every pull request adds a line to `CHANGELOG.md`, in the same PR, written for the family
(what changed on the display, not how), ending with the PR number, e.g. `(#13)`.

- Put it under the version the change will become. A PR that changes `web/` adds 1 to the
  patch number: if the newest heading is `## 1.0.0`, add `## 1.0.1 — YYYY-MM-DD` above it.
  If several PRs are open at once, the one merged second must renumber its heading.
- If the PR also edits `VERSION` (e.g. to `1.1`), the heading is `## 1.1.0`.
- A PR that doesn't touch `web/` (Android app, server, workflows, docs) adds its line under
  the newest existing version, in the matching section (Display, Android app, Server, Hosting).
- Pure docs/README changes need no entry.
