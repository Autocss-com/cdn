# cdn — the shared AutoCSS front-end

The single front-end that every AutoCSS content site renders through: HTML shell
+ CSS + JavaScript + self-hosted fonts + a component pool, served as static files.

**Zero third-party dependencies. No framework. No build step.**

Live: https://autocss-com.github.io/cdn/

## What lives here
- `index.html` — the page shell (the semantic regions every site shares)
- `assets/pool.html` — the component pool: the injector's allow-list and the
  prototypes it clones (list rows, the data-table row, form fields). Served to
  consumers, so a content site can ship an **empty** `<template>` and pull the
  pool from here ("called, not copied")
- `assets/css/` — one concern per file, each in its own `@layer`; the `<link>` order is the cascade order
- `assets/js/` — data-transport modules only (fetch JSON → clone from the pool → inject; the `oninput` lifecycle)
- `sw.js` — App Shell service worker (network-first: always fresh online, cache
  as offline fallback). Each consumer ships this file verbatim + registers it with
  a relative path (`./sw.js`)
- `assets/fonts/oxanium/` — self-hosted Oxanium via `fonts.css` `@font-face`
- `assets/images/brand/` — shared brand assets
- `test/` — a hermetic headless-Chromium regression gate (`npm install && npm test`)

## One front-end, many backends
A content site ships only its own `index.html` + `assets/data/*.json` and links
these assets by absolute URL:

```html
<link rel="stylesheet" href="https://autocss-com.github.io/cdn/assets/css/reset.css" />
<script type="module" src="https://autocss-com.github.io/cdn/assets/js/app.js"></script>
```

The JS fetches `assets/data/*.json` **relative to the page**, so it resolves to
the site's own origin — the front-end comes from here, the content from there.
GitHub Pages serves these assets with `Access-Control-Allow-Origin: *`, so the
cross-origin stylesheets, ES modules, fonts, and pool all load.

Consumers: [`Autocss-com/bible`](https://github.com/Autocss-com/bible), [`Autocss-com/id`](https://github.com/Autocss-com/id).

## Data contract
JSON key = element tag name; JSON shape = destination. string → text; array →
one element per entry (cloned from the pool when data outruns the DOM); object →
recurse. Only `src` and `alt` are written as attributes.

A page whose content is a table carries a `rows` array — one record per row. The
record's keys become the column labels (humanized) and the per-cell custom
elements; selecting a row builds the edit form from **that** record, each field's
input type inferred from its value (ids and dates read-only). One dataset drives
the table; the form reuses it. No schema — the contract is the source.

## Rules
Canonical architecture laws live in [`Autocss-com/ai`](https://github.com/Autocss-com/ai) `AGENTS.md`.
