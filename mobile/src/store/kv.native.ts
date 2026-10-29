// Key-value storage on the phone, backed by SQLite.
import Storage from 'expo-sqlite/kv-store';

export function getItem(key: string): string | null {
  try { return Storage.getItemSync(key); } catch { return null; }
}
export function setItem(key: string, value: string): void {
  Storage.setItemSync(key, value);
}
