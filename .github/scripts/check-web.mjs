// Quality checks for the web app (run by .github/workflows/ci.yml).
// - every inline <script> in web/index.html and every .js file in web/ must parse
// - every local file index.html links to must exist, with ?v=dev so the deploy can stamp it
// - the version placeholder the Pages deploy rewrites must still be there
// - tags that must be balanced for the page to render
import { readFileSync, readdirSync, existsSync } from "node:fs";
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

const jsFiles = readdirSync("web", { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => `web/${f}`).sort();
for (const file of jsFiles) {
  try { new vm.Script(readFileSync(file, "utf8"), { filename: file }); }
  catch (e) {
    const line = Number(e.stack?.match(new RegExp(`${file.replace(/[.]/g, "[.]")}:(\\d+)`))?.[1]) || 1;
    errors.push({ file, line, msg: `JavaScript syntax error: ${e.message}` });
  }
}
console.log(`Checked ${jsFiles.length} .js file(s): ${jsFiles.join(", ")}`);

// Local files the page loads: they must exist, and styles/scripts must carry ?v=dev, which
// the Pages deploy turns into the build's id so displays don't keep an old cached copy.
for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
  const url = m[1];
  if (/^(https?:)?\/\//.test(url)) continue;
  const [file, query] = url.split("?");
  const line = lineAt(m.index);
  if (!existsSync(`web/${file}`)) errors.push({ file: "web/index.html", line, msg: `${file} is linked but doesn't exist in web/` });
  if (file !== "config.js" && query !== "v=dev") errors.push({ file: "web/index.html", line, msg: `Link ${file} as ${file}?v=dev so the deploy can stamp it` });
}
for (const file of jsFiles.filter((f) => f.startsWith("web/js/")))
  if (!html.includes(`src="${file.slice(4)}?`)) errors.push({ file, line: 1, msg: `${file} isn't loaded by index.html; add a <script> line for it` });

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
