// MARK: INJECT
// JSON → DOM. The JSON key is the element tag. The JSON shape is the
// destination. This file names no element and knows no route.
//   string        → text of every matching element
//   array         → one entry per matching element, in order
//   object        → recurse, scoped to that element
//   allow-listed key → attribute on the current element
// One of each element is seeded in the HTML; an array longer than the seed
// duplicates that seed element in place. Surplus is emptied, never removed:
// CSS :empty hides it.

import { toTagName } from "./to-tag-name.js";

// The ONLY attributes data may write. Every other key is a tag name.
const ATTRIBUTES = ["src", "alt"];

// Set visible text without disturbing nested elements — state-machine
// inputs live inside labels and must survive every injection.
function setText(el, text = "") {
  for (const node of [...el.childNodes]) {
    node.nodeType === Node.TEXT_NODE ? el.removeChild(node) : null;
  }
  text ? el.prepend(document.createTextNode(text)) : null;
}

export function inject(data, scope = document) {
  if (!data || typeof data !== "object" || !scope) return;

  for (const [key, value] of Object.entries(data)) {
    if (ATTRIBUTES.includes(key)) {
      scope.setAttribute(key, value ?? "");
      continue;
    }

    const tag = toTagName(key);

    if (Array.isArray(value)) {
      // Duplicate the in-HTML seed element to match the data length.
      const targets = [...scope.querySelectorAll(tag)];
      const seed = targets.at(-1);
      const parent = seed?.parentNode ?? scope;

      while (seed && targets.length < value.length) {
        targets.push(parent.appendChild(seed.cloneNode(true)));
      }

      targets.forEach((el, i) => {
        const entry = value[i];
        entry !== null && typeof entry === "object"
          ? inject(entry, el)
          : setText(el, entry ?? "");
      });

      [...scope.querySelectorAll(tag)]
        .slice(value.length)
        .forEach((el) => setText(el, ""));

      continue;
    }

    if (value !== null && typeof value === "object") {
      const el = scope.querySelector(tag);
      el ? inject(value, el) : null;
      continue;
    }

    scope.querySelectorAll(tag).forEach((el) => setText(el, value ?? ""));
  }
}
