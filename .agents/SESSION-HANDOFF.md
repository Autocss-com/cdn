# Session Handoff — `Autocss-com/cdn` (the shared front-end)

_Last updated: 2026-09-07 — session: pool-materialization fix + App Shell Stage 2a._

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

## ⚠️ DEPLOY ORDER (load-bearing)
Merge **cdn Stage 2a → cdn `main` BEFORE** either consumer's emptied-`<template>`
reaches its own `main`. An empty pool with nothing on the live cdn renders
blank. Host first, then consumers. Everything is dev-branch-only now; nothing
live is at risk.

## Regression gate / harness
A hermetic headless-Chromium DOM diff against a **golden baseline** (all routes,
per site) gates every engine/pool change; "renders without errors" is never
sufficient — diff the DOM. Canonical gate case: the bible `li`-in-an-unseeded-
`<section>` (pool-materialization) — silent without a diff.
- Harness currently lives in the **session scratchpad only (ephemeral)**:
  a dependency-free static server + `playwright-core` (points at the pre-installed
  Chromium at `/opt/pw-browsers`), redirects `autocss-com.github.io/cdn/*` to a
  local cdn dir, aborts all other network. **NEXT: commit it into this repo** so
  the gate is durable and reusable.

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
Read first: `ai/AGENTS.md`, `ai` `data-flow/references/pool.md`, this file.
1. **Commit the test harness into the repo** (make the golden-baseline gate durable).
2. **Stage 2b — service-worker App Shell caching** (offline + instant). Per-site
   `sw.js` + registration (touches consumer repos). DECIDE the freshness strategy:
   stale-while-revalidate (fast, propagates on next-next load) vs. versioned
   cache-bust. Test offline render + propagation.
3. **Stage 2c — contract-driven instantiation** (Mechanism A, explicit). The JSON
   contract declares which components, in what order and frequency, instead of
   implicit key→tag matching. This **changes the data contract** → data migration
   + re-capture the golden baseline. Biggest/riskiest — design + approval first.

## Definition of done (each increment)
Build test-first against the golden-baseline gate; commit + push to the dev
branch only; report the diff result; never merge to `main` out of deploy order.
