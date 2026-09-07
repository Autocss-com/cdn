// The regression gate (npm test). Two checks, both from browser evidence:
//   1. Fixture DOM diff — render the fixture against this cdn and diff every
//      route's <app-container> against the committed golden baseline. Catches any
//      change that alters what a site renders (incl. the pool-materialization
//      regression: an `li` array in a section that seeds no <li>).
//   2. Engine guard — poolClone() WARNS (never silently drops) an element that is
//      neither seeded nor in the <template> pool.
// Exit 0 = all pass, 1 = any fail. "Renders without errors" is never enough — diff the DOM.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");
const { renderSite, findChromium, MIME } = require("./lib");

const CDN = path.join(__dirname, "..");
const BASE = path.join(__dirname, "fixture-baseline");

async function fixtureDiff() {
  const { routes, errors, failed, snapshots } = await renderSite({
    siteRoot: path.join(__dirname, "fixture"), cdnRoot: CDN,
  });
  const results = routes.map((route) => {
    const golden = path.join(BASE, route + ".html");
    if (!fs.existsSync(golden)) return { route, ok: false, why: "no baseline (run: npm run baseline)" };
    const ok = fs.readFileSync(golden, "utf8").trim() === (snapshots[route] || "").trim();
    return { route, ok, why: ok ? "identical" : "DOM differs from golden baseline" };
  });
  return { errors, failed, results };
}

async function guardCheck() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autocss-guard-"));
  fs.mkdirSync(path.join(tmp, "assets/js"), { recursive: true });
  const src = path.join(CDN, "assets/js");
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(tmp, "assets/js", f));
  fs.writeFileSync(path.join(tmp, "t.html"),
    `<!doctype html><meta charset=utf-8><main></main><template><p></p></template>
<script type="module">
  import { inject } from "./assets/js/inject.js";
  inject({ p: ["one","two","three"] }, document.querySelector("main"));  // from pool -> no warn
  inject({ widget: ["a","b","c"] }, document.querySelector("main"));      // un-materializable -> warn
  window.__done = true;
</script>`);
  const srv = http.createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.writeHead(204).end(); return; }
    const p = path.join(tmp, req.url === "/" ? "/t.html" : req.url.split("?")[0]);
    fs.readFile(p, (e, b) => e ? res.writeHead(404).end() : (res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "text/plain" }), res.end(b)));
  });
  await new Promise((r) => srv.listen(0, r));
  const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const warns = [], errors = [];
    page.on("console", (m) => { if (m.type() === "warning") warns.push(m.text()); if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://localhost:${srv.address().port}/t.html`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__done === true, { timeout: 5000 });
    const widgetCount = await page.$$eval("main widget", (e) => e.length);
    const pCount = await page.$$eval("main p", (e) => e.length);
    const ok = pCount === 3 && widgetCount === 0 &&
      warns.some((w) => w.includes("<widget>") && w.includes("not rendered")) &&
      !warns.some((w) => w.includes("<p>")) && errors.length === 0;
    return { ok, pCount, widgetCount, warnCount: warns.length, errorCount: errors.length };
  } finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
}

(async () => {
  const fx = await fixtureDiff();
  const gd = await guardCheck();
  console.log("=== fixture DOM diff vs golden baseline ===");
  for (const r of fx.results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.route}: ${r.why}`);
  if (fx.errors.length) console.log("  console errors:", fx.errors);
  if (fx.failed.length) console.log("  failed requests:", fx.failed);
  console.log("=== engine guard (poolClone warns, never silent) ===");
  console.log(`  ${gd.ok ? "PASS" : "FAIL"}  p=${gd.pCount} widget=${gd.widgetCount} warns=${gd.warnCount} errors=${gd.errorCount}`);
  const pass = fx.results.length > 0 && fx.results.every((r) => r.ok) && fx.errors.length === 0 && fx.failed.length === 0 && gd.ok;
  console.log(pass ? "\nALL PASS" : "\nFAIL");
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
