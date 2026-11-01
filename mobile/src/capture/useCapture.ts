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
    return { spotted: K.getCandidates().map(name), watched: K.getExtraApps().map(name) };
  } catch {
    return { spotted: [], watched: [] };
  }
}

export function useCapture() {
  const [raw, setRaw] = useState<RawAlert[]>(readRaw);
  const [apps, setApps] = useState(readApps);
  const refresh = useCallback(() => { setRaw(readRaw()); setApps(readApps()); }, []);

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

  /** Start or stop reading alerts from another app (a bank Kitty doesn't know yet). Only the person can turn this on. */
  const watchApp = useCallback((pkg: string, on: boolean) => {
    const K = KittyNotifications;
    if (!K) return;
    const cur = K.getExtraApps().filter((p) => p !== pkg);
    K.setExtraApps(on ? [...cur, pkg] : cur);
    refresh();
  }, [refresh]);

  const enabled = KittyNotifications ? KittyNotifications.isEnabled() : null;
  return { raw, parsed, refresh, done, enabled, native: !!KittyNotifications, spotted: apps.spotted, watched: apps.watched, watchApp };
}

export type Capture = ReturnType<typeof useCapture>;
