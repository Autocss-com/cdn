// Regenerate the golden baselines: render each fixture against THIS cdn checkout
// and write every route's normalized <app-container> HTML to its baseline dir.
// Run this only from a known-good state (the render you are declaring correct).
const fs = require("fs");
const path = require("path");
const { renderSite } = require("./lib");

const CDN = path.join(__dirname, "..");
const FIXTURES = [
  { site: "fixture", out: "fixture-baseline" },
  { site: "fixture-table", out: "fixture-table-baseline" },
];

(async () => {
  for (const { site, out } of FIXTURES) {
    const { routes, errors, failed, snapshots } = await renderSite({
      siteRoot: path.join(__dirname, site), cdnRoot: CDN,
    });
    if (errors.length || failed.length) {
      console.error(`refusing to capture ${site} with errors/failed requests:`, { errors, failed });
      process.exit(1);
    }
    const dir = path.join(__dirname, out);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const [route, html] of Object.entries(snapshots)) fs.writeFileSync(path.join(dir, route + ".html"), html + "\n");
    console.log(`captured ${site} baseline for routes:`, routes.join(", "));
  }
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
