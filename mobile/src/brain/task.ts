// Runs the brain: when a bank alert arrives (even with the app closed), when a notification button is tapped,
// when a waiting alert has settled, and whenever the app is open. Android starts it through CrestBrainService.
import { AppState } from 'react-native';
import { KittyNotifications } from '../../modules/kitty-notifications';
import { finish, readRaw } from '../capture/queue';
import { ymd } from '../engine/dates';
import { morningMessage, nextMorning } from '../engine/morning';
import type { State } from '../engine/types';
import { parseAll } from '../parse/bankAlerts';
import { getItem, setItem } from '../store/kv';
import { brainRan, getState, setState, tickDirectDebits, updateState } from '../store/store';
import { moneyS } from '../ui/theme';
import { addAll, applyAct, assess, nextSettle, noticeFor, projected, settledAdds, snapshot, type Act } from './brain';

const NOTIFIED = 'kitty.notified';
const fmtFor = (S: State) => (p: number) => moneyS(p, S.settings.currency);

function notified(): string[] {
  try { return JSON.parse(getItem(NOTIFIED) || '[]'); } catch { return []; }
}

/** Hand the latest figure to the phone: widget, Quick Settings tile, status bar figure and tomorrow's morning message. */
export function refreshSurfaces(S: State, now = Date.now()): void {
  const K = KittyNotifications;
  if (!K || !S.settings.setupDone) return;
  const today = ymd(new Date(now)), fmt = fmtFor(S);
  try { K.setSurfaces?.(JSON.stringify({ ...snapshot(S, today, fmt, now), ongoing: !!S.settings.ongoing })); } catch { /* best effort */ }
  const m = S.settings.morning;
  try {
    if (!m?.on) K.morningOff?.();
    else {
      const day = nextMorning(new Date(now), m.hour);
      K.setMorning?.(JSON.stringify({ ...morningMessage(S, day, fmt), day, hour: m.hour, minute: 0, savedAt: now }));
    }
  } catch { /* best effort */ }
}

/** Taps on notification buttons, applied in the order they were made. */
export function applyActions(now = Date.now()): boolean {
  const K = KittyNotifications;
  if (!K?.takeActions) return false;
  let acts: Act[] = [];
  try { acts = JSON.parse(K.takeActions() || '[]').map((s: string) => JSON.parse(s)); } catch { return false; }
  if (!acts.length) return false;
  const today = ymd(new Date(now));
  for (const a of acts) {
    const raw = readRaw(), parsed = parseAll(raw);
    const S = getState(), r = applyAct(S, parsed, a, today, fmtFor(S), now);
    if (r.S !== S) setState(r.S);
    if (r.keys.length) finish(r.keys, raw);
    if (r.notice) try { K.notifyPayment?.(JSON.stringify(r.notice)); } catch { /* best effort */ }
  }
  return true;
}

/** One pass of the brain. `reason` is what woke it: 'alert', 'action', 'tick' or 'open'. */
export function runBrain(reason: string, now = Date.now()): void {
  const K = KittyNotifications;
  if (!K) return;
  const today = ymd(new Date(now));
  tickDirectDebits(today);
  if (!getState().settings.setupDone) return;

  applyActions(now);

  // Add what's sure and settled
  let raw = readRaw(), parsed = parseAll(raw);
  if (getState().settings.autoAdd !== false) {
    const { txs, keys } = settledAdds(assess(getState(), parsed, now), parsed, new Date(now).toISOString());
    if (txs.length) updateState((d) => addAll(d, txs));
    if (keys.length) { finish(keys, raw); raw = readRaw(); parsed = parseAll(raw); }
  }

  const S = getState(), items = assess(S, parsed, now), P = projected(S, items);

  // A message a few seconds after the bank's own, for alerts that just came in, unless Crest is open on screen
  if (reason === 'alert' && S.settings.afterPay !== false && AppState.currentState !== 'active') {
    const seen = new Set(notified());
    const fresh = items.filter((i) => !seen.has(i.p.key) && now - i.p.time < 2 * 3600 * 1000).sort((a, b) => b.p.time - a.p.time);
    for (const it of fresh.slice(0, 4)) {
      const n = noticeFor(P, it, today, fmtFor(S));
      if (n) try { K.notifyPayment?.(JSON.stringify(n)); } catch { /* best effort */ }
    }
    const all = [...seen, ...items.map((i) => i.p.key)];
    setItem(NOTIFIED, JSON.stringify(all.slice(-300)));
  }

  refreshSurfaces(P, now);
  // Run again when a waiting payment has settled, and in any case just after midnight, so the widget starts each day right
  const midnight = new Date(now); midnight.setHours(24, 1, 0, 0);
  const settle = nextSettle(items, now);
  try { K.scheduleBrain?.(Math.min(settle ? settle + 15 * 1000 : Infinity, midnight.getTime())); } catch { /* best effort */ }
  brainRan();
}

/** The headless task Android runs. Never throws: a failure here must not take the listener down with it. */
export async function brainTask(data?: { reason?: string }): Promise<void> {
  try { runBrain(data?.reason || 'alert'); } catch { /* the app will catch up when it opens */ }
}
