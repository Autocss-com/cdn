# cdn — the shared AutoCSS front-end

The single front-end that every AutoCSS content site renders through: HTML shell
+ CSS + JavaScript + self-hosted fonts, served as static files.

**Zero third-party dependencies. No framework. No build step.**

Live: https://autocss-com.github.io/cdn/

## What lives here
- `index.html` — the page shell and a `<template>` element pool (the injector's allow-list)
- `assets/css/` — one concern per file, each in its own `@layer`; the `<link>` order is the cascade order
- `assets/js/` — data-transport modules only (fetch JSON → clone from the pool → inject; the `oninput` lifecycle)
- `assets/fonts/oxanium/` — self-hosted Oxanium via `fonts.css` `@font-face`
- `assets/images/brand/` — shared brand assets

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
cross-origin stylesheets, ES modules, and fonts all load.

Consumers: [`Autocss-com/bible`](https://github.com/Autocss-com/bible), [`Autocss-com/id`](https://github.com/Autocss-com/id).

## Data contract
JSON key = element tag name; JSON shape = destination. string → text; array →
one element per entry (cloned from the `<template>` pool when data outruns the
DOM); object → recurse. Only `src` and `alt` are written as attributes.

## Rules
Canonical architecture laws live in [`Autocss-com/ai`](https://github.com/Autocss-com/ai) `AGENTS.md`.
