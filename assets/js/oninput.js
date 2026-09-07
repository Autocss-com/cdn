import { fetchJson } from "./fetch-json.js";
import { inject } from "./inject.js";
import { writeStorage } from "./write-storage.js";
import { renderTable, handleTableInput } from "./table.js";

// The count of <section>s the page SEEDS in `main article` (captured on the first
// route). A page that seeds one empty section and materializes the rest from the
// pool (array-driven content) grows to many sections on a big route; a page that
// seeds several anchor sections (string-driven content) never materializes past
// its seeds. The region-clear below removes only the pool-materialized surplus
// (beyond the seed count), so neither style leaves stale sections behind.
let seedSectionCount = null;

// The single global input handler (document.oninput). Nav radios drive routing;
// every other input (row select) is the table's, delegated to handleTableInput.
export async function oninput(event) {
  const control = event.target;
  if (!control || control.name !== "nav") {
    handleTableInput(event);
    return;
  }

  const route = control.closest("label")?.textContent.trim().toLowerCase();
  if (!route) return;

  writeStorage("nav", route);

  const data = await fetchJson(`assets/data/${route}.json`);
  // `rows` is the table contract; everything else is generic shell content.
  const { rows, ...content } = data ?? {};

  // Region-clear on route switch (DHCP/autocss parity): nothing may bleed across
  // routes, and the shell's seeded placeholders must not leak on a page that
  // doesn't fill them. Scoped to `main article` — the table region (renderTable)
  // and its skeleton manage themselves.
  const article = document.querySelector("main article");
  if (article) {
    const sections = article.querySelectorAll(":scope > section");
    if (seedSectionCount === null) seedSectionCount = sections.length;
    // Drop pool-materialized surplus sections from a previous (larger) route;
    // keep the original seeds so string-driven pages retain their anchors.
    [...sections].slice(seedSectionCount).forEach((s) => s.remove());
    // Wipe stale leaf text in the sections that remain; inject() refills the
    // referenced elements below, and layout.css hides whatever stays :empty.
    article
      .querySelectorAll("section *:not(:has(*))")
      .forEach((el) => (el.textContent = ""));
  }

  inject(content, document.querySelector("main"));
  renderTable(rows);
}
