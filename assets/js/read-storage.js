// MARK: READ-STORAGE
// Read one state machine's last selection. Returns "" when absent.
// Key is the state machine's group name ("nav", "color-scheme", ...).
// Area is "localStorage" (default — kept across sessions) or
// "sessionStorage" (this browser session only).

export function readStorage(key = "", area = "localStorage") {
  if (!key) return "";

  try {
    return globalThis[area].getItem(key) ?? "";
  } catch {
    return "";
  }
}
