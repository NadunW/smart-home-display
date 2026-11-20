// Quality checks for the web app (run by .github/workflows/ci.yml).
// - every inline <script> in web/index.html and web/config.js must parse
// - the version placeholder the Pages deploy rewrites must still be there
// - tags that must be balanced for the page to render
import { readFileSync } from "node:fs";
import vm from "node:vm";

const errors = [];
const html = readFileSync("web/index.html", "utf8");

const lineAt = (i) => html.slice(0, i).split("\n").length;
const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let m, n = 0;
while ((m = re.exec(html))) {
  const attrs = m[1] || "";
  if (/\ssrc=/.test(attrs) || /type=["'](?!module|text\/javascript)/.test(attrs) || !m[2].trim()) continue;
  n++;
  const start = lineAt(m.index + m[0].indexOf(">") + 1);
  try {
    new vm.Script(m[2], { filename: "web/index.html" });
  } catch (e) {
    const rel = e.stack?.match(/web\/index\.html:(\d+)/)?.[1];
    const line = rel ? start + Number(rel) - 1 : start;
    errors.push({ file: "web/index.html", line, msg: `JavaScript syntax error: ${e.message}` });
  }
}
console.log(`Checked ${n} inline script(s) in web/index.html`);

try { new vm.Script(readFileSync("web/config.js", "utf8"), { filename: "web/config.js" }); }
catch (e) { errors.push({ file: "web/config.js", line: 1, msg: `JavaScript syntax error: ${e.message}` }); }

if (!html.includes("const BUILD='__BUILD__',VER='__VER__',BUILT='__BUILT__'"))
  errors.push({ file: "web/index.html", line: 1, msg: "The line const BUILD='__BUILD__',VER='__VER__',BUILT='__BUILT__' is missing; the Pages deploy needs it to stamp the version." });

for (const tag of ["script", "style", "body", "html"]) {
  const open = (html.match(new RegExp(`<${tag}[\\s>]`, "gi")) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, "gi")) || []).length;
  if (open !== close) errors.push({ file: "web/index.html", line: 1, msg: `<${tag}> opened ${open} time(s) but closed ${close}` });
}

for (const e of errors) console.log(`::error file=${e.file},line=${e.line}::${e.msg}`);
if (errors.length) process.exit(1);
console.log("Web checks passed");
