# Notifications — design (approved)

_Dev/user-facing on-screen notices. Built test-first against the gate._

## Goal
When the engine is asked to create an element that is NOT in the `<template>`
pool (the security allow-list), surface a **visible, non-dead-end** notice — not
just a `console.warn`. The notice links to the in-app FAQ (its technical table)
so the reader learns how the pool is extended.

## Trigger — reuse the existing allow-list check (NO new detection)
`inject.js` `poolClone()` already detects "a tag with no pool prototype and no
seed" and `console.warn`s the shortfall. On that SAME shortfall it now also calls
`notify()`. This is the one sanctioned JS touch for the notice (no listeners, no
click — a programmatic popover can only be opened from script; analogous to the
single sanctioned nav `dispatchEvent`).

`notify()`: materialize `<app-notice>` from the pool once (clone → append to
body), set `role="error"`, and `showPopover()` it (guarded against double-open).

## Element — one, in the pool
`<app-notice popover aria-live="assertive">` — a new pool prototype. ONE element
(no duplication). Severity via a `role` value the guard sets — `error` /
`warning` / `information` / `success` (our own, per project need). `role` is the
CSS + colour hook; `aria-live` keeps the message announced. It contains the FAQ
link:

```html
<app-notice popover aria-live="assertive">
  <label>FAQ<input type="radio" name="nav" value="faq" /></label>
</app-notice>
```

The `<label>` selects a `faq` nav radio → enters the `oninput` nav lifecycle →
the `faq` view (its technical table). SPA-native: no `href`, no JS, no click
handler. Resolves once each site ships a `faq` tab + data; until then it's a
no-op. The message text is CSS `content`, before the link — never a dead end.

## Presentation — CSS owns it (`notifications.css`, new `@layer`)
- Anchored popover: `app-container` declares `anchor-name`; the notice
  `position-anchor`es to it (canon: popovers use CSS anchor positioning, never
  JS math). `position-try-fallbacks` keeps it on-screen.
- Four `[role]` colour variants from the theme tokens; message via `content`
  (only the `error` message is authored — it's the only wired trigger).
- Open/close transition (`@starting-style` / `:popover-open`).

## Tokens — four status colours, light/dark, complementary to #66ccff
`--notice-information` (blue, the accent family) · `--notice-warning` (orange,
blue's complement) · `--notice-error` (red) · `--notice-success` (green). Names
declared in `color-scheme.css` (Part 1, `light-dark()` fallbacks); palette in
`color-theme-66ccff.css` (Part 2, oklch) — the files' own split. Reuse the
existing red/green hues where sensible; no duplication.

## Scope
Only the ERROR trigger (pool violation) is wired. The other three colours are
defined and ready; no triggers/messages invented for them. The FAQ **content**
(the `faq` tab's data) is the site's; here we build only the route/link to it.

## Test
Gate check: inject data with an un-pooled tag → `<app-notice>` materializes,
`role="error"`, popover open, error colour computed, the `faq` nav radio present.

## Deliverables
`assets/css/notifications.css` (new), `assets/pool.html` + `index.html` inline
`<template>` (the `<app-notice>` prototype, kept identical), `color-scheme.css`
+ `color-theme-66ccff.css` (tokens), `assets/js/inject.js` (`notify()`),
`index.html` `<link>` (+ consumers link it), `test/gate.js`.
