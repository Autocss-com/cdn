// MARK: WRITE-STORAGE
// Save one state machine's current selection. Silent on failure —
// storage is unavailable in some privacy modes and must never break the UI.
// Area is "localStorage" (default — kept across sessions) or
// "sessionStorage" (this browser session only).

export function writeStorage(key = "", value = "", area = "localStorage") {
  if (!key) return;

  try {
    globalThis[area].setItem(key, value);
  } catch {}
}
