// Proves the App Shell service worker under PROJECT-PAGE hosting: the fixture is
// served under a SUBPATH (/app/), exactly like autocss-com.github.io/<repo>/, so
// the registration MUST be relative (`./sw.js` -> /app/sw.js, scope /app/). A
// root-absolute "/sw.js" would fetch /sw.js at the site root, 404, and the SW
// would never control the page — which this test now catches (it did not before,
// because it served the fixture at the root where "/sw.js" happened to resolve).
//
// Strategy proven: NETWORK-FIRST. Online the page renders fresh from the network;
// cut ALL network and it still renders from the SW's offline-fallback cache. In
// both states the SW must be CONTROLLING the page (navigator.serviceWorker.controller).
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");
const { findChromium, MIME } = require("./lib");

const CDN = path.join(__dirname, "..");
const SUB = "/app"; // a GitHub Pages project subpath (never the site root)
// Default: the committed fixture (strict assertions). Optional arg: any consumer
// checkout (generic assertions — proves a real site renders online AND offline).
const SITE_ARG = process.argv[2];
const FIX = SITE_ARG ? path.resolve(SITE_ARG) : path.join(__dirname, "fixture");
const STRICT = !SITE_ARG;

(async () => {
  // Build a SW-enabled copy of the fixture in a temp dir.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "autocss-sw-"));
  fs.cpSync(FIX, tmp, { recursive: true });
  // Consumer /sw.js is the canonical cdn/sw.js, verbatim (same-origin requirement).
  fs.copyFileSync(path.join(CDN, "sw.js"), path.join(tmp, "sw.js"));
  let html = fs.readFileSync(path.join(tmp, "index.html"), "utf8");
  // Register RELATIVE so the SW scopes to the subpath — the whole point of this
  // test. (A real consumer already registers its own; don't double-inject.)
  if (!/serviceWorker/.test(html)) {
    html = html.replace("</body>", `  <script>navigator.serviceWorker && navigator.serviceWorker.register("./sw.js");</script>\n</body>`);
  }
  fs.writeFileSync(path.join(tmp, "index.html"), html);

  // Serve the fixture UNDER /app/ (a project subpath), not at the root.
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/favicon.ico") { res.writeHead(204).end(); return; }
    if (u === SUB) u = SUB + "/";
    if (!u.startsWith(SUB + "/")) { res.writeHead(404).end("outside " + SUB + ": " + u); return; }
    const rel = u.slice(SUB.length); // strip the subpath prefix
    const f = path.join(tmp, rel === "/" ? "/index.html" : rel);
    fs.readFile(f, (e, b) => e ? res.writeHead(404).end("404 " + u)
      : (res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }), res.end(b)));
  });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const homeUrl = `http://localhost:${port}${SUB}/index.html`;

  let offline = false;
  const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    // Keep real script errors; drop URL-less "Failed to load resource" echoes.
    page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/Failed to load resource/i.test(t)) errors.push("console: " + t); });
    page.on("requestfailed", (r) => errors.push("reqfail: " + r.url() + " :: " + (r.failure() && r.failure().errorText)));
    // Route at the CONTEXT level so the service worker's own fetches are intercepted too.
    await ctx.route("**/*", (route) => {
      if (offline) return route.abort("internetdisconnected");
      const url = route.request().url();
      if (url.includes("autocss-com.github.io/cdn/")) {
        const p = new URL(url).pathname.replace(/^\/cdn\//, "/");
        const f = path.join(CDN, p);
        try { return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: MIME[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) }); }
        catch { return route.fulfill({ status: 404, body: "cdn miss " + p }); }
      }
      if (url.startsWith(`http://localhost:${port}`)) return route.continue();
      return route.abort();
    });

    const render = async () => {
      await page.waitForFunction(() => document.querySelectorAll('nav input[name="nav"]').length >= 1, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      return {
        controlled: await page.evaluate(() => !!navigator.serviceWorker.controller),
        nav: await page.$$eval('nav input[name="nav"]', (e) => e.length),
        li: await page.$$eval('main section li', (e) => e.map((x) => x.textContent).filter((t) => /note/.test(t)).length),
        h1: await page.$eval("main h1", (e) => e.textContent).catch(() => ""),
        mainLen: (await page.$eval("main", (e) => e.textContent).catch(() => "")).replace(/\s+/g, " ").trim().length,
      };
    };

    // 1) online load -> register + activate the SW (relative to the subpath)
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
    // Wait for activation, but NEVER block forever: a failed registration (e.g. a
    // root-absolute "/sw.js" at a subpath) never resolves `ready`, so cap the wait
    // and let the `controlled` assertion below fail fast instead of hanging.
    await page.evaluate(() => Promise.race([
      navigator.serviceWorker.ready,
      new Promise((r) => setTimeout(r, 4000)),
    ]));
    // 2) reload so the SW controls the page and populates the offline-fallback cache
    await page.reload({ waitUntil: "domcontentloaded" });
    const online = await render();

    // 3) cut ALL network, reload -> must still render, from the SW cache
    offline = true;
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    const off = await render();

    // Decorative image/favicon misses are not functional failures.
    const funcErrors = errors.filter((e) => !/(favicon|\.(svg|png|jpe?g|ico|webp|gif))/i.test(e));
    const pass = STRICT
      ? (online.controlled && online.nav === 2 && online.li === 3 && /Page One/.test(online.h1) &&
         off.controlled && off.nav === 2 && off.li === 3 && /Page One/.test(off.h1) && funcErrors.length === 0)
      // Generic (any consumer): SW-controlled, rendered, and offline matches online.
      : (online.controlled && online.nav >= 1 && online.mainLen > 100 &&
         off.controlled && off.nav === online.nav && off.mainLen === online.mainLen && funcErrors.length === 0);

    console.log(JSON.stringify({ servedUnder: SUB, online, offline: off, functionalErrors: funcErrors, cosmeticErrors: errors.filter((e) => !funcErrors.includes(e)), PASS: pass }, null, 2));
    await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error("SW-OFFLINE FAIL:", e.stack || e.message);
    await browser.close(); srv.close(); process.exit(1);
  }
})();
