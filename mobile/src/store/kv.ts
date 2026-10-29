// Key-value storage, web version (used by the browser preview). Android uses kv.native.ts.
export function getItem(key: string): string | null {
  try { return globalThis.localStorage ? globalThis.localStorage.getItem(key) : null; } catch { return null; }
}
export function setItem(key: string, value: string): void {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* storage full or blocked */ }
}
