// Proves the App Shell service worker: a SW-enabled site, once loaded online,
// still renders after ALL network is cut (offline) — served from the SW cache.
// Hermetic: cdn requests are fulfilled from this checkout (with CORS, like the
// real cdn); flipping `offline` aborts every request so only the cache remains.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { chromium } = require("playwright-core");
const { findChromium, MIME } = require("./lib");

const CDN = path.join(__dirname, "..");
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
  html = html.replace("</body>", `  <script>navigator.serviceWorker && navigator.serviceWorker.register("/sw.js");</script>\n</body>`);
  fs.writeFileSync(path.join(tmp, "index.html"), html);

  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/favicon.ico") { res.writeHead(204).end(); return; }
    const f = path.join(tmp, u === "/" ? "/index.html" : u);
    fs.readFile(f, (e, b) => e ? res.writeHead(404).end("404 " + u)
      : (res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }), res.end(b)));
  });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;

  let offline = false;
  const browser = await chromium.launch({ executablePath: findChromium(), args: ["--no-sandbox"] });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    // Keep real script errors; drop URL-less "Failed to load resource" echoes —
    // those duplicate the requestfailed events (which carry a URL we can classify).
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
        nav: await page.$$eval('nav input[name="nav"]', (e) => e.length),
        li: await page.$$eval('main section li', (e) => e.map((x) => x.textContent).filter((t) => /note/.test(t)).length),
        h1: await page.$eval("main h1", (e) => e.textContent).catch(() => ""),
        mainLen: (await page.$eval("main", (e) => e.textContent).catch(() => "")).replace(/\s+/g, " ").trim().length,
      };
    };

    // 1) online load -> register + activate SW
    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    // 2) reload so the SW controls the page and populates the cache
    await page.reload({ waitUntil: "domcontentloaded" });
    const online = await render();

    // 3) cut ALL network, reload -> must render from the SW cache
    offline = true;
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    const off = await render();

    // Decorative image/favicon misses are not functional failures (browsers fetch
    // favicons outside SW scope; a missing tab icon never breaks a page render).
    const funcErrors = errors.filter((e) => !/(favicon|\.(svg|png|jpe?g|ico|webp|gif))/i.test(e));
    const pass = STRICT
      ? (online.nav === 2 && online.li === 3 && /Page One/.test(online.h1) &&
         off.nav === 2 && off.li === 3 && /Page One/.test(off.h1) && funcErrors.length === 0)
      // Generic (any consumer): rendered (nav + real content), and offline matches online.
      : (online.nav >= 1 && online.mainLen > 100 &&
         off.nav === online.nav && off.mainLen === online.mainLen && funcErrors.length === 0);

    console.log(JSON.stringify({ online, offline: off, functionalErrors: funcErrors, cosmeticErrors: errors.filter((e) => !funcErrors.includes(e)), PASS: pass }, null, 2));
    await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(pass ? 0 : 1);
  } catch (e) {
    console.error("SW-OFFLINE FAIL:", e.stack || e.message);
    await browser.close(); srv.close(); process.exit(1);
  }
})();
