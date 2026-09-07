// The regression gate (npm test). Browser-evidence checks — "renders without
// errors" is never enough, so every check diffs the DOM or asserts real state:
//   1. Fixture DOM diff — render each fixture against this cdn and diff every
//      route's <app-container> vs the committed golden baseline. Covers pool-
//      materialization (an `li` array in a section that seeds no <li>) and the
//      contract-driven table (head labels + body rows from `rows`).
//   2. Engine guard — poolClone() WARNS (never silently drops) an element that
//      is neither seeded nor in the <template> pool.
//   3. Table form — selecting a row copies THAT record into the aside form, with
//      the input type inferred from the value (uuid/date → readonly).
// Exit 0 = all pass, 1 = any fail.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");
const { renderSite, findChromium, MIME } = require("./lib");

const CDN = path.join(__dirname, "..");

async function diffFixture(site, baselineDir) {
  const BASE = path.join(__dirname, baselineDir);
  const { routes, errors, failed, snapshots } = await renderSite({
    siteRoot: path.join(__dirname, site), cdnRoot: CDN,
  });
  const results = routes.map((route) => {
    const golden = path.join(BASE, route + ".html");
    if (!fs.existsSync(golden)) return { route: `${site}/${route}`, ok: false, why: "no baseline (run: npm run baseline)" };
    const ok = fs.readFileSync(golden, "utf8").trim() === (snapshots[route] || "").trim();
    return { route: `${site}/${route}`, ok, why: ok ? "identical" : "DOM differs from golden baseline" };
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

// Select the first table row and assert the aside form is built from THAT record
// with value-inferred types (id/uuid + date → readonly; name → editable text).
async function tableFormCheck() {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/favicon.ico") { res.writeHead(204).end(); return; }
    const f = path.join(__dirname, "fixture-table", u === "/" ? "/index.html" : u);
    fs.readFile(f, (e, b) => e ? res.writeHead(404).end("404 " + u)
      : (res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }), res.end(b)));
  });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.includes("autocss-com.github.io/cdn/")) {
        const p = new URL(url).pathname.replace(/^\/cdn\//, "/");
        const f = path.join(CDN, p);
        try { return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) }); }
        catch { return route.fulfill({ status: 404, body: "cdn miss " + p }); }
      }
      if (url.startsWith(`http://localhost:${port}`)) return route.continue();
      return route.abort();
    });
    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelectorAll('main ul[aria-hidden="true"] + ul li').length >= 1, { timeout: 15000 }).catch(() => {});
    // Select the first body row (programmatic input event = a row click).
    await page.evaluate(() => {
      const cb = document.querySelector('main ul[aria-hidden="true"] + ul li input[name="row-toggle"]');
      cb.checked = true;
      cb.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForTimeout(200);
    const fields = await page.$$eval("aside form fieldset > label", (labels) =>
      labels.map((l) => {
        const i = l.querySelector("input");
        return { label: l.textContent.trim(), name: i && i.name, type: i && i.type, value: i && i.value, readOnly: i && i.readOnly };
      }));
    const by = (n) => fields.find((f) => f.name === n);
    const ok =
      fields.length === 3 &&
      by("id") && by("id").type === "text" && by("id").readOnly === true &&
      by("id").value === "11111111-2222-3333-4444-555555555555" && by("id").label === "Id:" &&
      by("name") && by("name").type === "text" && by("name").readOnly === false &&
      by("name").value === "Widget" && by("name").label === "Name:" &&
      by("created") && by("created").type === "datetime-local" && by("created").readOnly === true &&
      by("created").value === "2026-01-15T08:00" && by("created").label === "Created:" &&
      errors.length === 0;
    return { ok, fields, errorCount: errors.length };
  } finally { await browser.close(); srv.close(); }
}

(async () => {
  const fx = await diffFixture("fixture", "fixture-baseline");
  const tbl = await diffFixture("fixture-table", "fixture-table-baseline");
  const gd = await guardCheck();
  const form = await tableFormCheck();

  console.log("=== fixture DOM diff vs golden baseline ===");
  for (const r of [...fx.results, ...tbl.results]) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.route}: ${r.why}`);
  const errors = [...fx.errors, ...tbl.errors], failed = [...fx.failed, ...tbl.failed];
  if (errors.length) console.log("  console errors:", errors);
  if (failed.length) console.log("  failed requests:", failed);
  console.log("=== engine guard (poolClone warns, never silent) ===");
  console.log(`  ${gd.ok ? "PASS" : "FAIL"}  p=${gd.pCount} widget=${gd.widgetCount} warns=${gd.warnCount} errors=${gd.errorCount}`);
  console.log("=== table form (row select -> value-inferred form) ===");
  console.log(`  ${form.ok ? "PASS" : "FAIL"}  fields=${JSON.stringify(form.fields)}`);

  const diffs = [...fx.results, ...tbl.results];
  const pass = diffs.length > 0 && diffs.every((r) => r.ok) && errors.length === 0 && failed.length === 0 && gd.ok && form.ok;
  console.log(pass ? "\nALL PASS" : "\nFAIL");
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
