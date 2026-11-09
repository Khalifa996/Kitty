// Quick picks on the Log screen. Bank alerts already catch card payments, so the keypad is mostly
// for cash and anything the bank doesn't tell Crest about. Picks come from what you log by hand,
// favouring things you log often, lately and around this time of day. One-offs fade out.
import { diffDays } from './dates';
import type { State } from './types';

export type Pick = { name: string; cat: string; score: number; amt?: number };
const norm = (s: string) => s.trim().toLowerCase();
const HALF_LIFE = 21;  // days for a past entry to count half as much
const WINDOW = 60;     // days looked back

export function quickPicks(S: State, kind: 'out' | 'in', today: string, hour: number, max = 6): Pick[] {
  const m = new Map<string, { name: string; cat: string; score: number; n: number; last: number; amts: number[] }>();
  const list = S.tx.filter((t) => t.kind === kind && t.merchant && !t.billId && !t.checkin && !t.potIn && t.source !== 'alert' && t.date <= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  for (const t of list) {
    const age = diffDays(t.date, today);
    if (age > WINDOW) continue;
    const k = norm(t.merchant), e = m.get(k) || { name: t.merchant.trim(), cat: t.cat, score: 0, n: 0, last: age, amts: [] };
    const h = Number((t.time || '12:00').slice(0, 2));
    e.score += Math.pow(0.5, age / HALF_LIFE) * (Math.abs(h - hour) <= 2 ? 1.5 : 1);
    e.cat = t.cat; e.n++; e.last = age; e.amts.push(t.amt);
    m.set(k, e);
  }
  return [...m.values()]
    // Logged once, more than two weeks ago: probably a one-off
    .filter((e) => e.n >= 2 || e.last <= 14)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((e) => {
      const last3 = e.amts.slice(-3);
      // Same amount the last three times (a bus fare, a usual lunch): offer it
      const amt = last3.length === 3 && last3.every((a) => a === last3[0]) ? last3[0] : undefined;
      return { name: e.name, cat: e.cat, score: e.score, amt };
    });
}

/** Every place you've logged (by hand or from alerts), most used first, for matching what you type. */
export function places(S: State, kind: 'out' | 'in'): { name: string; cat: string; n: number }[] {
  const m = new Map<string, { name: string; cat: string; n: number }>();
  for (const t of S.tx) {
    if (t.kind !== kind || !t.merchant || t.billId || t.checkin || t.potIn) continue;
    const k = norm(t.merchant), e = m.get(k) || { name: t.merchant.trim(), cat: t.cat, n: 0 };
    e.cat = t.cat; e.n++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}
