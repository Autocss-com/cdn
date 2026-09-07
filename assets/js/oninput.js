import { fetchJson } from "./fetch-json.js";
import { inject } from "./inject.js";
import { writeStorage } from "./write-storage.js";
import { renderTable, handleTableInput } from "./table.js";

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

  // Region-clear on route switch (DHCP/autocss parity): wipe stale leaf text in
  // the content region so nothing bleeds across routes and the shell's seeded
  // placeholders don't leak on a page that doesn't fill them. Scoped to
  // `article section` leaves — the table region (renderTable) and its skeleton
  // manage themselves. inject() refills the referenced elements below; CSS
  // (layout.css) hides whatever stays :empty.
  document
    .querySelectorAll("main article section *:not(:has(*))")
    .forEach((el) => (el.textContent = ""));

  inject(content, document.querySelector("main"));
  renderTable(rows);
}
