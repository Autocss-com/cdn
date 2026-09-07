// Regenerate the golden baseline: render the fixture against THIS cdn checkout
// and write each route's normalized <app-container> HTML to fixture-baseline/.
// Run this only from a known-good state (the render you are declaring correct).
const fs = require("fs");
const path = require("path");
const { renderSite } = require("./lib");

const CDN = path.join(__dirname, "..");
const OUT = path.join(__dirname, "fixture-baseline");

(async () => {
  const { routes, errors, failed, snapshots } = await renderSite({
    siteRoot: path.join(__dirname, "fixture"), cdnRoot: CDN,
  });
  if (errors.length || failed.length) {
    console.error("refusing to capture a baseline with errors/failed requests:", { errors, failed });
    process.exit(1);
  }
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [route, html] of Object.entries(snapshots)) fs.writeFileSync(path.join(OUT, route + ".html"), html + "\n");
  console.log("captured baseline for routes:", routes.join(", "));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
