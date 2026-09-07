// MARK: TABLE
// Contract-driven data table + edit form. ONE dataset (`rows`) drives the
// table; the form REUSES it — selecting a row copies that record into the form.
// Two separate concerns, one data hand-off (the row's list-item radio):
//   HEAD  — column labels DERIVED (humanized) from the record keys.
//   BODY  — one <li> per record: the fixed row shell (label + hidden row-toggle
//           checkbox + hidden list-item radio) is CLONED from the <template>
//           pool; each cell <key> element is generated from the record keys via
//           createElement (Mechanism B — cell tags are data-defined, not
//           allow-listed). No schema: the contract is the single source.
//   FORM  — built from the SELECTED row's own cells; input type INFERRED from
//           the value (id/uuid + dates → readonly). Selection visual is CSS
//           :checked; copying values into the form is data, so JS.
//
// Interaction is delegated from the global document.oninput (handleTableInput):
// pool-cloned nodes can't carry property handlers, and the cdn already routes
// every input through one handler. handleRowToggle is DHCP's logic, unchanged.

import { toTagName } from "./to-tag-name.js";

// DOM targets — queried fresh (the SPA re-renders the region per route).
const headUl = () => document.querySelector('main ul[aria-hidden="true"]');
const bodyUl = () => document.querySelector('main ul[aria-hidden="true"] + ul');
const fieldset = () => document.querySelector("aside form fieldset");

// The row shell prototype: the ONLY pool <li> with a direct <label> child, so
// this never collides with generic list-materialization (which clones the bare
// <li>). :has() is the same native selector the presentation layer relies on.
const rowProto = () =>
  document.querySelector("template")?.content?.querySelector("li:has(> label)");

// element tag -> key (inverse of toTagName): "created-at" -> "createdAt".
const toCamel = (s = "") => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// key -> humanized column label: "createdAt" -> "Created At".
const humanize = (key = "") =>
  toTagName(key).replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ISO string -> the value a datetime-local input expects ("YYYY-MM-DDTHH:mm").
const formatDateForInput = (str = "") => {
  const d = new Date(str);
  return Number.isNaN(+d) ? "" : d.toISOString().slice(0, 16);
};

// Clone the pool row shell, then fill cells from the record (Mechanism B).
function createListItem(record = {}) {
  const proto = rowProto();
  if (!proto) {
    console.warn("[table] no row shell (<li><label>) in the <template> pool — row not rendered.");
    return null;
  }
  const li = proto.cloneNode(true);
  const label = li.querySelector("label");
  for (const [key, value] of Object.entries(record)) {
    const cell = document.createElement(toTagName(key));
    cell.textContent = value ?? "";
    label.appendChild(cell);
  }
  return li;
}

// Form field for one cell, TYPE INFERRED FROM THE VALUE (no schema):
//   id / 36-char uuid          -> readonly text
//   ISO datetime               -> readonly datetime-local
//   author|created|modified|updated key -> readonly text
//   everything else            -> text, required when non-empty
function createInputFromKey(key, value = "") {
  const val = String(value ?? "").trim();
  const input = document.createElement("input");
  input.name = key;
  input.type = "text";
  input.value = val;

  if (key === "id" || /^[a-f0-9-]{36}$/i.test(val)) {
    input.readOnly = true;
    input.tabIndex = -1;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    input.type = "datetime-local";
    input.value = formatDateForInput(val);
    input.readOnly = true;
    input.tabIndex = -1;
  } else if (/author|created|modified|updated/i.test(key)) {
    input.readOnly = true;
    input.tabIndex = -1;
  } else {
    input.required = val !== "";
  }
  return input;
}

// The selected row's cells -> the form. Deselecting leaves it empty (the aside
// hides itself via :empty). This is the "form reuses the row" hand-off.
function updateFormFromSelectedRow() {
  const fs = fieldset();
  if (!fs) return;
  fs.replaceChildren();

  const row = document
    .querySelector('main ul li input[name="list-item"]:checked')
    ?.closest("li");
  if (!row) return;

  row.querySelectorAll("label > *:not(input)").forEach((cell) => {
    const key = toCamel(cell.tagName.toLowerCase());
    const label = document.createElement("label");
    label.textContent = humanize(key) + ": ";
    label.appendChild(createInputFromKey(key, cell.textContent));
    fs.appendChild(label);
  });
}

// DHCP handleRowToggle, unchanged: single-select among the row checkboxes,
// mirror the row's list-item radio, and fire it so the form updates.
function handleRowToggle(checkbox) {
  if (checkbox.checked) {
    bodyUl()
      ?.querySelectorAll('input[name="row-toggle"]')
      .forEach((cb) => cb !== checkbox && (cb.checked = false));
  }
  const radio = checkbox.closest("li")?.querySelector('input[name="list-item"]');
  if (!radio) return;
  radio.checked = checkbox.checked;
  radio.dispatchEvent(new Event("input", { bubbles: true }));
}

// Delegated from the global document.oninput for any non-nav input.
export function handleTableInput(event) {
  const el = event.target;
  if (el.name === "row-toggle") handleRowToggle(el);
  else if (el.name === "list-item") updateFormFromSelectedRow();
}

// Render the table from the `rows` contract. Always clears the region first, so
// navigating from a table page to a non-table page empties it (CSS :empty hides).
export function renderTable(rows) {
  const head = headUl();
  const body = bodyUl();
  if (!head && !body) return; // this page has no table region

  head?.querySelector("li")?.replaceChildren();
  body?.replaceChildren();
  fieldset()?.replaceChildren();
  if (!Array.isArray(rows) || rows.length === 0) return;

  const headLi = head?.querySelector("li");
  if (headLi) {
    for (const key of Object.keys(rows[0])) {
      const cell = document.createElement(toTagName(key));
      cell.textContent = humanize(key);
      headLi.appendChild(cell);
    }
  }

  for (const record of rows) {
    const li = createListItem(record);
    if (li) body?.appendChild(li);
  }
}
