# Stage 2c — contract-driven data-table + form (design)

_Design-first. No code until this is approved. Build test-first against the gate._

## Goal
Bring DHCP's **data-table** (head + body) and **edit form** into the cdn, driven
entirely by the JSON contract. **No separate schema** — the contract is the
single source of truth for both content and (inferred) field types.

## Markup — skeleton fixtures, lifted from DHCP
The head and body are **two separate `<ul>` elements**, distinct roles,
distinguished by an aria attribute (not wrapped in a custom element; subgrid may
align them visually later without changing this):

```html
<main> … 
  <ul aria-hidden="true"><li></li></ul>   <!-- table HEAD (its own element) -->
  <ul></ul>                                <!-- table BODY (its own element) -->
</main>
<aside>
  <form><fieldset></fieldset> … Save / Reset / Delete</form>
</aside>
```

One table + one form per page (the singular fixtures DHCP has). CSS `:empty`
hides them when a page carries no table/form.

## Contract — one key drives the table; the form reuses it
```json
{ "rows": [ { "name": "Widget", "created": "2026-01-15T08:00:00Z" }, … ] }
```
- **Body `<ul>`** ← one `<li>` per record; each cell is a `toTagName(key)` custom
  element holding the value — **Mechanism B** (DHCP `createListItem`).
- **Head `<ul>`** ← column labels **derived from the record keys** (humanized).
  Auto-derived; no schema.
- **Form** ← built from a record's own key/value pairs. Selecting a row populates
  the form from that record. Input type **inferred from the value** (id/dates →
  readonly; `datetime` pattern → `datetime-local`; else text) — DHCP's inference,
  minus the `fieldRules`/schema. A hint a value can't imply (e.g. a `<select>`'s
  options) would live **inline in the contract**, never a separate file. First
  build: inferred text/datetime/readonly only.

## Engine — lift from DHCP `inject.js`, adapted to the cdn
- `createListItem(record)` → body `<li>` + cells (keeps the hidden row-select
  checkbox + radio — selection **visual** state is CSS `:checked`; copying the
  selected record's values into the form inputs is **data**, so JS).
- header-cell loop → head `<ul>` labels from keys.
- `createInputFromKey(key, value)` → form inputs by value-inference (no schema).
- Targets: head = `ul[aria-hidden="true"]`, body = the adjacent `<ul>`, form =
  `aside form fieldset`. `poolClone` + the silent-drop guard still cover row
  growth from the pool's row `<li>` prototype.

## What we drop
The separate **schema** concept: `ai` `data-flow/references/schema.md` and the
"schema-driven visibility/ordering" note. The contract is the schema. Docs
updated in the same change.

## Mechanisms (unchanged, kept separate)
- **A — pool-materialization:** clone the allow-listed `<template>` prototype;
  warn, never silently drop.
- **B — table cells:** custom elements generated from JSON keys via `toTagName`.

## Test-first + docs
- New fixture page: a `rows` table (head-derived labels + body rows) + a form
  populated from a selected record. Extend `cdn/test/`, re-baseline the gate.
- Update `ai` `json/shape.md` (+ retire `schema.md`) and `data-flow` alongside.

## Guardrails
Dev branch only; golden-baseline gate before/after; `main` untouched until the
deploy order (cdn first) is satisfied. Least power: no new custom element for the
table, no schema file, reuse the existing pool/engine.
