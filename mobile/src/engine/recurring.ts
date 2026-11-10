// Payments that come round regularly but aren't bills yet (a subscription, a gym, a phone plan), spotted from history.
import { shopKey } from './spending';
import { diffDays } from './dates';
import type { State, Tx } from './types';

export type Recurring = { key: string; name: string; amt: number; day: number; count: number; last: string; cat: string; ids: string[] };

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(100, b * 0.1);
const STOP = new Set(['the', 'and', 'ltd', 'plc', 'pay', 'bill', 'bills', 'card', 'uk', 'com', 'online', 'payment', 'direct', 'debit']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));

/**
 * Monthly payments to the same place for about the same amount, 26 to 35 days apart, the last one in the past
 * 40 days, that don't match a bill already. Two in a row is enough to ask; the person decides.
 */
export function findRecurring(S: State, today: string): Recurring[] {
  const groups = new Map<string, Tx[]>();
  for (const t of S.tx) {
    if (t.kind !== 'out' || t.billId || t.potId || !t.merchant || diffDays(t.date, today) > 200) continue;
    const k = shopKey(t.merchant);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  const billWords = S.bills.flatMap((b) => words(b.name));
  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2 || S.settings.dismissed?.[`rec:${key}`]) continue;
    if (words(key).some((w) => billWords.includes(w))) continue;
    const xs = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // Take the latest run of payments that are a month apart and about the same amount
    const run = [xs[xs.length - 1]];
    for (let i = xs.length - 2; i >= 0; i--) {
      const gap = diffDays(xs[i].date, run[0].date);
      if (gap < 26) continue; // a second payment in the same month: not this pattern
      if (gap > 35 || !near(xs[i].amt, run[0].amt)) break;
      run.unshift(xs[i]);
    }
    if (run.length < 2) continue;
    const last = run[run.length - 1];
    if (diffDays(last.date, today) > 40) continue;
    out.push({ key, name: last.merchant, amt: median(run.map((t) => t.amt)), day: Number(last.date.slice(8)), count: run.length, last: last.date, cat: last.cat, ids: run.map((t) => t.id) });
  }
  return out.sort((a, b) => b.amt - a.amt);
}
