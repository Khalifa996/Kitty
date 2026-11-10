// The queue of captured bank alerts, without React, so the background brain can use it too.
import { KittyNotifications } from '../../modules/kitty-notifications';
import type { RawAlert } from '../parse/bankAlerts';
import { getItem, setItem } from '../store/kv';
import { logAlerts } from '../store/storage';

const DEMO = 'kitty.demoAlerts';

export function readRaw(): RawAlert[] {
  try {
    if (KittyNotifications) return JSON.parse(KittyNotifications.getCaptured()) as RawAlert[];
    return JSON.parse(getItem(DEMO) || '[]') as RawAlert[];
  } catch {
    return [];
  }
}

export function removeRaw(keys: string[]) {
  if (KittyNotifications) KittyNotifications.removeCaptured(keys);
  else setItem(DEMO, JSON.stringify(readRaw().filter((r) => !keys.includes(r.key))));
}

/** Finished with these alerts: keep a copy in the log, then remove them from the queue. */
export function finish(keys: string[], raw: RawAlert[] = readRaw()) {
  if (!keys.length) return;
  const set = new Set(keys);
  logAlerts(raw.filter((r) => set.has(r.key)).map(({ pkg, title, text, time }) => ({ pkg, title, text, time })));
  removeRaw(keys);
}

export { keysFor } from './toEntry';
