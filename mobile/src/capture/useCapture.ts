// Captured bank alerts: read from the phone (or demo data in the browser preview), parsed and ready to review.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { KittyNotifications } from '../../modules/kitty-notifications';
import { neverRead, parseAll, type RawAlert } from '../parse/bankAlerts';
import { onBrainRan } from '../store/store';
import { pruneLog } from '../store/storage';
import { finish, keysFor, readRaw, removeRaw } from './queue';

export { keysFor };

export type OtherApp = { pkg: string; label: string };
// Only offer to read apps that look like banks, cards or wallets (not shops, marketplaces or app stores)
const MONEY_APP = /bank|banking|money|pay\b|paypal|card|credit|finance|wallet|cash|building society|savings|loan|klarna|clearpay|monzo|starling|revolut|chase|amex|curve|kroo|zopa|tide|wise/i;
const NOT_A_BANK = /vinted|ebay|depop|amazon|store|shop|market|deliveroo|uber|just ?eat|game|play/i;
export const isMoneyApp = (a: OtherApp) => MONEY_APP.test(`${a.label} ${a.pkg}`) && !NOT_A_BANK.test(a.label);
function readApps(): { spotted: OtherApp[]; watched: OtherApp[] } {
  const K = KittyNotifications;
  if (!K) return { spotted: [], watched: [] };
  try {
    const name = (pkg: string) => ({ pkg, label: K.getAppLabel ? K.getAppLabel(pkg) : pkg });
    const ok = (pkg: string) => !neverRead(pkg);
    return { spotted: K.getCandidates().filter(ok).map(name), watched: K.getExtraApps().filter(ok).map(name) };
  } catch {
    return { spotted: [], watched: [] };
  }
}

/** Stop reading chat, email and similar apps if they were ever turned on, and delete what was kept from them. */
function forgetNeverRead() {
  const K = KittyNotifications;
  try {
    if (K) {
      const extra = K.getExtraApps();
      const ok = extra.filter((p) => !neverRead(p));
      if (ok.length !== extra.length) K.setExtraApps(ok);
    }
    const bad = readRaw().filter((r) => neverRead(r.pkg)).map((r) => r.key);
    if (bad.length) removeRaw(bad);
    pruneLog((r) => !neverRead(r.pkg || ''));
  } catch { /* best effort */ }
}

export function useCapture() {
  const [raw, setRaw] = useState<RawAlert[]>(() => {
    forgetNeverRead();
    // If Android dropped Crest's listener (after an update, or to save battery), ask for it back
    try { if (KittyNotifications?.isEnabled()) KittyNotifications.rebind?.(); } catch { /* best effort */ }
    return readRaw();
  });
  const [apps, setApps] = useState(readApps);
  const refresh = useCallback(() => {
    const next = readRaw();
    setRaw((cur) => (cur.length === next.length && cur.every((r, i) => r.key === next[i].key) ? cur : next));
    setApps(readApps());
  }, []);

  useEffect(() => {
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    const live = KittyNotifications?.addListener('onCapture', refresh);
    const brain = onBrainRan(refresh); // the background brain added or finished some
    return () => { app.remove(); live?.remove(); brain(); };
  }, [refresh]);

  const parsed = useMemo(() => parseAll(raw).sort((a, b) => b.time - a.time), [raw]);

  /** Finished with these alerts: keep a copy in the log, then remove them from the queue. */
  const done = useCallback((keys: string[]) => {
    finish(keys, raw);
    refresh();
  }, [raw, refresh]);

  /** Start or stop reading alerts from another app (a bank Crest doesn't know yet). Only the person can turn this on. */
  const watchApp = useCallback((pkg: string, on: boolean) => {
    const K = KittyNotifications;
    if (!K || (on && neverRead(pkg))) return;
    const cur = K.getExtraApps().filter((p) => p !== pkg);
    K.setExtraApps(on ? [...cur, pkg] : cur);
    refresh();
  }, [refresh]);

  const enabled = KittyNotifications ? KittyNotifications.isEnabled() : null;
  return { raw, parsed, refresh, done, enabled, native: !!KittyNotifications, spotted: apps.spotted, watched: apps.watched, watchApp };
}

export type Capture = ReturnType<typeof useCapture>;
