// Captured bank alerts: read from the phone (or demo data in the browser preview), parsed and ready to review.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { KittyNotifications } from '../../modules/kitty-notifications';
import { parseAll, type ParsedAlert, type RawAlert } from '../parse/bankAlerts';
import { getItem, setItem } from '../store/kv';
import { logAlerts } from '../store/storage';

const DEMO = 'kitty.demoAlerts';

function readRaw(): RawAlert[] {
  try {
    if (KittyNotifications) return JSON.parse(KittyNotifications.getCaptured()) as RawAlert[];
    return JSON.parse(getItem(DEMO) || '[]') as RawAlert[];
  } catch {
    return [];
  }
}

function removeRaw(keys: string[]) {
  if (KittyNotifications) KittyNotifications.removeCaptured(keys);
  else setItem(DEMO, JSON.stringify(readRaw().filter((r) => !keys.includes(r.key))));
}

/** The alert's own key plus any copies or other halves that should go with it. */
export const keysFor = (p: ParsedAlert, all: ParsedAlert[]) =>
  [p.key, ...(p.pairedWith ? [p.pairedWith] : []), ...all.filter((q) => q.duplicateOf === p.key).map((q) => q.key)];

export function useCapture() {
  const [raw, setRaw] = useState<RawAlert[]>(readRaw);
  const refresh = useCallback(() => setRaw(readRaw()), []);

  useEffect(() => {
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    const live = KittyNotifications?.addListener('onCapture', refresh);
    return () => { app.remove(); live?.remove(); };
  }, [refresh]);

  const parsed = useMemo(() => parseAll(raw).sort((a, b) => b.time - a.time), [raw]);

  /** Finished with these alerts: keep a copy in the log, then remove them from the queue. */
  const done = useCallback((keys: string[]) => {
    const set = new Set(keys);
    logAlerts(raw.filter((r) => set.has(r.key)).map(({ pkg, title, text, time }) => ({ pkg, title, text, time })));
    removeRaw(keys);
    refresh();
  }, [raw, refresh]);

  const enabled = KittyNotifications ? KittyNotifications.isEnabled() : null;
  return { raw, parsed, refresh, done, enabled, native: !!KittyNotifications };
}

export type Capture = ReturnType<typeof useCapture>;
