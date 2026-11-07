// Gentle checks that help anyone keep their numbers honest, without Kitty tracking every move.
import { diffDays } from './dates';
import type { State, Tx } from './types';

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(100, Math.round(Math.max(a, b) * 0.02));

/**
 * Something you added by hand that a bank alert also added: same direction, about the same amount, a day apart at most.
 * Bills are left out (Kitty ticks those off itself). Pairs the person said to keep are skipped.
 */
export function likelyDuplicates(S: State, today: string, days = 60): [Tx, Tx][] {
  const recent = S.tx.filter((t) => !t.billId && Math.abs(diffDays(t.date, today)) <= days);
  const alerts = recent.filter((t) => t.source === 'alert');
  const used = new Set<string>(), pairs: [Tx, Tx][] = [];
  for (const h of recent.filter((t) => t.source !== 'alert')) {
    const a = alerts.find((x) => !used.has(x.id) && x.kind === h.kind && near(x.amt, h.amt) && Math.abs(diffDays(x.date, h.date)) <= 1 &&
      !S.settings.dismissed?.[`dup:${h.id}:${x.id}`]);
    if (a) { used.add(a.id); pairs.push([h, a]); }
  }
  return pairs;
}

/**
 * Banks that usually send alerts (on five or more days in the last three weeks) but have gone quiet for three days.
 * Usually the bank's notifications were switched off, or the phone put Kitty to sleep.
 */
export function quietBanks(S: State, today: string, heardToday: string[] = []): { bank: string; last: string }[] {
  const days = new Map<string, Set<string>>();
  for (const t of S.tx) {
    if (t.source !== 'alert' || !t.bank || t.bank === 'Google Wallet' || diffDays(t.date, today) > 21) continue;
    if (!days.has(t.bank)) days.set(t.bank, new Set());
    days.get(t.bank)!.add(t.date);
  }
  const out: { bank: string; last: string }[] = [];
  for (const [bank, set] of days) {
    const last = [...set].sort().pop() as string;
    if (set.size >= 5 && diffDays(last, today) >= 3 && !heardToday.includes(bank) && !S.settings.dismissed?.[`quiet:${bank}:${last}`]) out.push({ bank, last });
  }
  return out;
}
