import { fetchJson } from "./fetch-json.js";
import { inject } from "./inject.js";
import { readStorage } from "./read-storage.js";

// Populate the <template> pool from the cdn when the page ships it empty
// (the pool is "called, not copied" — one source, served from the cdn). A page
// that still carries an inline pool is left untouched. Resolved from this
// module's own cdn URL, so it always fetches the pool beside the JS.
async function ensurePool() {
  const tpl = document.querySelector("template");
  if (!tpl || tpl.content.children.length) return;
  const res = await fetch(new URL("../pool.html", import.meta.url)).catch(() => null);
  if (res && res.ok) tpl.innerHTML = await res.text();
}

export async function onload() {
  await ensurePool();
  inject(await fetchJson("assets/data/shell.json"), document.body);

  const group = "nav";
  const saved = readStorage(group);

  const controls = [...document.querySelectorAll(`input[name="${group}"]`)];
  const control =
    controls.find(
      (input) =>
        input.closest("label")?.textContent.trim().toLowerCase() === saved
    ) ?? controls[0];

  control ? (control.checked = true) : null;
  control?.dispatchEvent(new Event("input", { bubbles: true }));
}
