// Ad-hoc tool: render any consumer checkout against a cdn checkout and dump each
// route's normalized <app-container> HTML (this is what found the bible
// pool-materialization regression: diff the same site across two cdn versions).
//   node render.js <siteRoot> <cdnRoot> [outDir]
// e.g. baseline vs. a change:
//   node render.js ../../bible /path/to/cdn@main      out/before
//   node render.js ../../bible ..                     out/after
//   diff -r out/before out/after
const fs = require("fs");
const path = require("path");
const { renderSite } = require("./lib");

const [siteRoot, cdnRoot, outDir] = process.argv.slice(2);
if (!siteRoot || !cdnRoot) { console.error("usage: node render.js <siteRoot> <cdnRoot> [outDir]"); process.exit(2); }

(async () => {
  const { routes, errors, failed, snapshots } = await renderSite({ siteRoot, cdnRoot });
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    for (const [r, h] of Object.entries(snapshots)) fs.writeFileSync(path.join(outDir, r.replace(/[^\w.-]+/g, "_") + ".html"), h + "\n");
  }
  console.log(JSON.stringify({ routes, errorCount: errors.length, failedCount: failed.length,
    errors: errors.slice(0, 8), failed: failed.slice(0, 8) }, null, 2));
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
