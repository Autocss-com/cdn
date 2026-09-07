# cdn regression gate

A hermetic, headless-Chromium test gate for the AutoCSS shared front-end. It
proves — from real browser evidence, not assertions — that a change to the
engine or the `<template>` pool does not alter what any site renders.

> Rule: "renders without errors" is **never** sufficient. The engine can drop
> content silently (that is exactly how the pool-materialization regression
> shipped). Always **diff the DOM** against a known-good baseline.

## Run it

```sh
cd test
npm install          # installs playwright-core only (no browser download)
npm test             # the gate: fixture DOM diff + engine guard
```

Requires a Chromium that Playwright can find — set `PLAYWRIGHT_BROWSERS_PATH`
to a Playwright browsers directory (the harness locates the binary itself; it
never downloads one).

## What it checks

1. **Fixture DOM diff** (`gate.js` + `fixture/`): renders `fixture/` against this
   cdn checkout and diffs every nav route's `<app-container>` HTML against the
   committed `fixture-baseline/`. The fixture's second `<section>` seeds **no
   `<li>`** but its data injects an `li` array there, so a working render must
   **materialize the `<li>` from the pool** — if pool-materialization breaks, the
   diff fails. The fixture ships an **empty `<template>`**, so it also exercises
   the pool being fetched from the cdn (App Shell).
2. **Engine guard**: `poolClone()` must `console.warn` (never silently drop) an
   element that is neither seeded nor in the pool.

## Regenerating the baseline

Only from a render you have confirmed correct:

```sh
npm run baseline     # rewrites fixture-baseline/ from the current cdn
```

## Ad-hoc cross-version diff (how the bible regression was found)

`render.js` renders any consumer checkout against any cdn checkout:

```sh
node render.js ../../bible /path/to/cdn-at-main out/before
node render.js ../../bible ..                   out/after
diff -r out/before out/after
```
