# cdn regression gate

Hermetic headless-Chromium gate. Proves from real browser evidence that an
engine/pool/CSS change doesn't alter what sites render. **"No errors" ≠ not
broken — diff the DOM** (that's how the pool-materialization regression shipped).

## Run

```sh
cd test
npm install        # playwright-core only; never downloads a browser
npm test           # gate.js + sw-offline.js
```

Needs a Playwright-locatable Chromium — set `PLAYWRIGHT_BROWSERS_PATH`. Harness
finds the binary; never downloads.

## Checks

`gate.js`:
1. **fixture DOM diff** (`fixture/` vs `fixture-baseline/`) — per-route
   `<app-container>` diff. Covers pool-materialization (an `li` array in a
   `<section>` seeding no `<li>` → must clone from pool). Empty `<template>` →
   pool fetched from cdn (App Shell).
2. **fixture-table DOM diff** (`fixture-table/` vs `fixture-table-baseline/`) —
   the `rows` contract: head labels (humanized from keys) + one body `<li>` per
   record (row-shell cloned from pool + cells `createElement`'d = Mechanism B).
3. **engine guard** — `poolClone()` WARNS, never silently drops, a tag neither
   seeded nor in the pool.
4. **table form + CSS state** — select a row → form built from THAT record,
   input type value-inferred (id/uuid + ISO date → readonly); assert (computed
   style) aside `none→grid` on select + selected row paints `var(--bg-selected)`.

`sw-offline.js`: the App Shell service worker. Serves the fixture under a
`/app/` **subpath** (mirrors Pages project hosting: `…github.io/<repo>/`), so
registration must be relative `./sw.js` — root-absolute `/sw.js` 404s there. Loads
online then cuts ALL network; must still render (network-first cache fallback) and
the SW must **control** the page in both. `node sw-offline.js <siteDir>` checks a
real consumer.

## Regenerate baselines

From a render you've confirmed correct only:

```sh
npm run baseline   # rewrites fixture-baseline/ AND fixture-table-baseline/
```

## Gotchas

- **Baselines include the `<template>` pool.** It serializes inside
  `<app-container>.outerHTML`, so ANY `assets/pool.html` edit shifts EVERY
  baseline — even when page content is unchanged. Re-baseline, then eyeball the
  git diff to confirm the only change is the pool.
- **`pool.html`'s unclosed `<cite>`** makes the serialized template nest later
  prototypes (incl. the row shell) *inside* `<cite>` — cosmetic, harmless;
  `querySelector` finds them regardless. Don't "fix" it (re-baselines everything).

## Ad-hoc cross-version diff (how the bible regression was found)

```sh
node render.js ../../bible /path/to/cdn-at-main out/before
node render.js ../../bible ..                   out/after
diff -r out/before out/after
```
