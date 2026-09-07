# Session Handoff — `Autocss-com/cdn` (the shared front-end)

_Last updated: 2026-09-07 — session: pool-materialization fix + App Shell Stage 2a/2b + Stage 2c (contract-driven data-table + form) + committed test gate._

## Repo role
`cdn` is the ONE shared front-end: HTML shell + CSS + JS + self-hosted fonts +
the `<template>` component pool + `assets/pool.html`. Consuming sites (bible,
id, …) ship only their own `index.html` (thin shell linking cdn assets by
absolute URL) + `assets/data/*.json`. Zero third-party deps, no build, semantic
HTML, GitHub Pages + CORS `*`. Canonical laws: `Autocss-com/ai` → `AGENTS.md`;
the pool/mechanism design: `ai` `data-flow/references/pool.md`.

## This session — all on dev branch `claude/accuracy-first-guidelines-r85dyc`; `main` UNTOUCHED
Engine (`assets/js/inject.js`):
- `79d6e39` removed `slots()` and cloned the in-HTML **seed** instead of the pool.
  **Browser-tested → regression:** an `li` array injected into a `<section>`
  that seeds no `<li>` rendered ZERO items (bible lost content on all 4 routes,
  **0 console errors**). id unaffected.
- `7cafe75` **reverted** that; verified 9/9 route-pages identical to golden.
- `24fc3f3` renamed `slots()` → **`poolClone()`** and added a **silent-drop
  guard** (`console.warn` when a tag is neither seeded nor in the pool). Verified
  9/9 identical + a focused guard test.

App Shell Stage 2a (pool "called, not copied"):
- `850f5f7` added `assets/pool.html` (pool extracted from the inline `<template>`)
  and `onload.js` `ensurePool()` — fetches the pool from the cdn (via
  `import.meta.url`) into an EMPTY `<template>` at boot; a page with an inline
  pool is left untouched. Verified: inline-pool consumers 9/9 identical; a
  scratch emptied-template site 5/5 identical, pulling the pool from the cdn.

Consumer migration (separate repos, same dev branch):
- `id` `bd1000f`, `bible` `b0941e5`: emptied their `<template>`; pool now comes
  from the cdn. Verified 5/5 and 4/4 identical to golden.

App Shell Stage 2b (`cdn` `19e39bc`, `id` `ff1b387`, `bible` `5fdcbfc`):
- `cdn/sw.js` — App Shell service worker (stale-while-revalidate for cdn static;
  network-first + cache fallback for nav/data). A SW must be same-origin and
  cross-origin `importScripts` of a shared worker FAILS (verified), so each
  consumer ships `sw.js` VERBATIM (copied like the skeleton, not fetched like the
  pool) + a one-line registration. Verified in-browser: renders online AND fully
  offline from cache; the offline test caught two real bugs (cross-origin
  importScripts; opaque no-cors CSS/fonts uncached) — both fixed.

Test gate committed (`cdn` `4d9bfd1`, extended in `19e39bc`): `cdn/test/` —
`npm install && npm test` runs the fixture DOM diff (covers pool-materialization),
the engine guard, and the SW offline proof. `npm run test:sw <siteDir>` checks a
real consumer offline.

Stage 2c — contract-driven data-table + form (this session):
- `assets/pool.html` — appended a **row-shell** prototype
  `<li tabindex="0"><label><input name="row-toggle" hidden><input name="list-item"
  hidden></label></li>`. The bare `<li>` stays FIRST, so generic list-
  materialization is untouched; the shell is the only `<li>` with a `<label>`
  child, so the table clones it via `li:has(> label)` with no collision.
- `assets/js/table.js` (NEW) — the data-table concern. `renderTable(rows)` builds
  the HEAD (labels humanized from the record keys) and BODY (one `<li>` per record:
  the pool row shell CLONED + cells `createElement(toTagName(key))`'d — Mechanism B,
  cell tags NOT allow-listed). `handleTableInput(event)` is delegated from the global
  `document.oninput`: `row-toggle` → **DHCP `handleRowToggle` (unchanged logic)**;
  `list-item` → `updateFormFromSelectedRow` (the selected row's cells → the aside
  form, input type INFERRED from the value — id/uuid + ISO date → readonly; no
  schema). Delegation (not per-element handlers) because pool-cloned nodes can't
  carry property handlers, and the cdn already routes all input through one handler.
- `assets/js/oninput.js` — nav-guard (`name !== "nav"` delegates to the table);
  splits `{ rows, ...content }`, generic-injects `content`, `renderTable(rows)`.
- `index.html` — `main`/`aside` replaced with the canonical table shell (head
  `ul[aria-hidden]` + body `ul` + aside `form > fieldset` + Save/Reset/Delete).
- **Browser-tested → ALL PASS.** New `test/fixture-table/` + `fixture-table-baseline/`
  (static head+body golden) and a live row-select→form interaction check in
  `test/gate.js`; `capture-baseline.js` now captures both fixtures. The existing
  ONE/TWO baselines were re-captured (the pool `<template>` snapshot gained ONLY the
  row shell — verified by diff, zero content change) and `sw-offline.js` still passes.
- `ai` docs updated (same dev branch): schema **retired as the default** (optional
  only) — `data-flow` SKILL (contract-driven ordering + value-inference + row→form
  reuse), `references/schema.md`, `json/shape.md` + `json` SKILL, `html/forms.md`,
  `data-flow/positional-mapping.md`.

## ⚠️ DEPLOY ORDER (load-bearing)
Merge **cdn (`pool.html` + `sw.js`) → cdn `main` BEFORE** either consumer's
emptied-`<template>` / SW registration reaches its own `main`. An empty pool with
nothing on the live cdn renders blank. Host first, then consumers. Everything is
dev-branch-only now; nothing live is at risk. **A service worker is sticky in
production** (it controls the origin until unregistered) — see the SW-deploy
policy in the next-phase prompt before shipping it.

## Regression gate / harness
A hermetic headless-Chromium DOM diff against a **golden baseline** (all routes,
per site) gates every engine/pool change; "renders without errors" is never
sufficient — diff the DOM. Canonical gate case: the bible `li`-in-an-unseeded-
`<section>` (pool-materialization) — silent without a diff.
- Harness now committed at **`cdn/test/`** (`npm install && npm test`): a
  dependency-free static server + `playwright-core` (locates the pre-installed
  Chromium; never downloads one), redirects `autocss-com.github.io/cdn/*` to this
  checkout, aborts all other network. Runs the fixture DOM diff, the engine guard,
  and the SW offline proof. SW tests need CONTEXT-level routing (page.route does
  not intercept a worker's own fetches). Regenerate the baseline only from a
  known-good render: `npm run baseline`.

## Constraint Lock — re-assert before ANY change
- **Accuracy > brevity.** Never guess/assume; stop and ask on ambiguity. Do
  exactly what is asked, no more, no less.
- **Test, don't declare.** Golden-baseline DOM diff gates every engine/pool change.
- **No `slots`** (banned); pool-materialization is `poolClone` + the guard.
- **Air-gap SoC:** HTML = structure (preloaded, JAMstack), CSS = UI runtime
  (`:empty`/`:has` watch content), JS = data transport only. Route/shape lives in
  the DATA, never in markup/CSS.
- **`main` stays untouched** until the deploy order above is satisfied.

## NEXT SESSION PROMPT — Stage 2 remainder
Read first: `ai/AGENTS.md`, `ai` `data-flow/references/pool.md`, this file. Run
the gate before AND after any change: `cd test && npm install && npm test`.
Done: harness committed; Stage 2a (pool from cdn) + consumer migration; Stage 2b
(service worker); **Stage 2c (contract-driven data-table + form)** — engine
(`table.js`), pool row shell, skeleton, gate, docs. Remaining:
1. **CSS for the table region (separate concern — `css` skill).** The new markup
   (head/body `<ul>`s, aside `form`, row-select `:checked`, `fieldset:not(:empty)`
   reveal) is DATA-layer only right now; the cdn CSS does not yet style it. Lift
   the DHCP `layout.css`/`forms.css` patterns (`li:has(input:checked)`,
   `aside:has(form fieldset:not(:empty))`) into the cdn's CSS. No JS.
2. **Save / Reset / Delete + form mirror-back (data layer).** The controls are
   static markup; wiring them to the api/storage write path (and mirroring form
   edits back to the selected row) is the next data increment. The gate covers
   render + row→form; extend it for write-back when built.
3. **Before any production SW deploy:** the worker is sticky. Decide a
   release/kill policy — bump `VERSION` in `sw.js` per release; keep a self-
   unregistering "kill-switch" `sw.js` on hand in case a bad worker ships. The
   shipped freshness strategy is stale-while-revalidate for cdn static assets.

## Definition of done (each increment)
Build test-first against the golden-baseline gate; commit + push to the dev
branch only; report the diff result; never merge to `main` out of deploy order.
