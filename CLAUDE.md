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

## The page's code
- `web/index.html` is the markup; `web/styles.css` the styles; `web/js/*.js` the code, one file
  per part. The files are plain scripts (no build step, no modules) loaded in the order listed
  at the bottom of `index.html`. They share one global scope, so a file can use anything an
  earlier file defines; code that runs while loading must not call into a later file.
- A new file goes in `web/js/` and gets its own `<script src="js/name.js?v=dev">` line in that
  list. The Pages deploy turns `?v=dev` into the build id, so displays load fresh copies.
- Keep `const BUILD='__BUILD__',VER='__VER__',BUILT='__BUILT__'` inline in `index.html`: the
  deploy rewrites it there.
- Run the behaviour tests (`tests/web`, see its README) for any change to `web/`; CI runs them too.
