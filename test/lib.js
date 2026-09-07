// Shared harness helpers: locate the pre-installed Chromium, serve a dir, and
// render a consuming site against a local cdn checkout, capturing per-route DOM.
// Hermetic: cdn asset URLs are fulfilled from a local cdn dir; all other network
// is aborted, so a run depends on nothing external.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".png": "image/png", ".webmanifest": "application/manifest+json",
};
const norm = (s) => s.replace(/\s+/g, " ").replace(/> </g, "><").trim();

// Find the browser binary without downloading one (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD).
function findChromium() {
  const bases = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers"].filter(Boolean);
  const subs = ["chrome-linux/chrome", "chrome-linux64/chrome",
    "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe"];
  for (const base of bases) {
    let dirs = [];
    try { dirs = fs.readdirSync(base).filter((n) => n.startsWith("chromium-")).sort().reverse(); } catch { /* ignore */ }
    for (const d of dirs) for (const s of subs) {
      const p = path.join(base, d, s);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("Chromium not found. Set PLAYWRIGHT_BROWSERS_PATH to a Playwright browsers dir.");
}

function serve(root) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    if (u === "/favicon.ico") { res.writeHead(204).end(); return; }
    const f = path.join(root, u === "/" ? "/index.html" : u);
    if (!path.resolve(f).startsWith(path.resolve(root))) { res.writeHead(403).end(); return; }
    fs.readFile(f, (e, buf) => e ? res.writeHead(404).end("404 " + u)
      : (res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }), res.end(buf)));
  });
  return new Promise((r) => srv.listen(0, () => r({ srv, port: srv.address().port })));
}

// Render every nav route of `siteRoot`; cdn requests are fulfilled from `cdnRoot`.
// Returns { routes, errors, failed, snapshots: {route -> normalized <app-container> HTML} }.
async function renderSite({ siteRoot, cdnRoot }) {
  const { srv, port } = await serve(siteRoot);
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-background-networking", "--disable-component-update",
      "--no-first-run", "--disable-features=Translate,OptimizationHints", "--no-default-browser-check"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (url.includes("autocss-com.github.io/cdn/")) {
        const p = new URL(url).pathname.replace(/^\/cdn\//, "/");
        const f = path.join(cdnRoot, p);
        try { return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) }); }
        catch { return route.fulfill({ status: 404, body: "local cdn miss: " + p }); }
      }
      if (url.startsWith("http://localhost:")) return route.continue();
      return route.abort();
    });
    const errors = [], failed = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("requestfailed", (r) => failed.push(r.url() + " :: " + (r.failure() && r.failure().errorText)));

    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('nav input[name="nav"]').length >= 1, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);

    const routes = await page.$$eval('nav input[name="nav"]', (els) =>
      els.map((el) => (el.closest("label")?.textContent || "").trim()));
    const snapshots = {};
    const snap = async (name) => {
      await page.waitForTimeout(250);
      snapshots[name] = norm(await page.$eval("app-container", (el) => el.outerHTML).catch(() => "NO app-container"));
    };
    for (let i = 0; i < routes.length; i++) {
      await page.evaluate((idx) => {
        const r = document.querySelectorAll('nav input[name="nav"]')[idx];
        if (r) { r.checked = true; r.dispatchEvent(new Event("input", { bubbles: true })); }
      }, i);
      await snap(routes[i] || `route${i}`);
    }
    return { routes, errors, failed, snapshots };
  } finally {
    await browser.close();
    srv.close();
  }
}

module.exports = { MIME, norm, findChromium, serve, renderSite };
