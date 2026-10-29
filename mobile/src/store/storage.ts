// Saves Kitty's data on the phone as one JSON document, the same shape as the web app's backup.
import { blankState, migrate } from '../engine/migrate';
import type { State } from '../engine/types';
import { getItem, setItem } from './kv';

const KEY = 'kitty.v1';

export function loadState(): State {
  try {
    const raw = getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : blankState();
  } catch {
    return blankState();
  }
}

export const saveState = (S: State) => setItem(KEY, JSON.stringify(S));

/** Read a backup pasted from the web app. Throws a readable error if it isn't one. */
export function parseBackup(text: string): State {
  let data: unknown;
  try { data = JSON.parse(text.trim()); } catch { throw new Error("That doesn't look like a Kitty backup. Copy it again and paste the whole thing"); }
  return migrate(data);
}

// A rolling log of raw alerts, kept for "Copy for Claude" after they've been handled
const LOG = 'kitty.alertlog';
export function logAlerts(items: unknown[]): void {
  if (!items.length) return;
  let list: unknown[] = [];
  try { list = JSON.parse(getItem(LOG) || '[]'); } catch { list = []; }
  setItem(LOG, JSON.stringify([...list, ...items].slice(-200)));
}
export function alertLog(): unknown[] {
  try { return JSON.parse(getItem(LOG) || '[]'); } catch { return []; }
}
