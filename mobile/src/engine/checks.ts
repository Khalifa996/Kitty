// Gentle checks that help anyone keep their numbers honest, without Crest tracking every move.
import { isTopUp } from '../capture/toEntry';
import { diffDays } from './dates';
import type { State, Tx } from './types';

const mins = (t: Tx) => { const [h, m] = (t.time || '12:00').split(':').map(Number); return h * 60 + m; };

const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(100, Math.round(Math.max(a, b) * 0.02));

/**
 * Something you added by hand that a bank alert also added: same direction, about the same amount, a day apart at most.
 * Bills are left out (Crest ticks those off itself). Pairs the person said to keep are skipped.
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
 * Two entries from bank alerts that look like one payment told twice: same bank, name and amount, a few minutes apart.
 * Sometimes it really was charged twice, so Crest asks rather than removing one.
 */
export function alertTwins(S: State, today: string, days = 30): [Tx, Tx][] {
  const L = S.tx.filter((t) => t.source === 'alert' && !t.billId && Math.abs(diffDays(t.date, today)) <= days)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const used = new Set<string>(), pairs: [Tx, Tx][] = [];
  for (let i = 0; i < L.length; i++) {
    const a = L[i];
    if (used.has(a.id)) continue;
    for (let j = i + 1; j < L.length && L[j].date === a.date && mins(L[j]) - mins(a) <= 3; j++) {
      const b = L[j];
      if (used.has(b.id) || b.kind !== a.kind || b.amt !== a.amt || (b.bank || '') !== (a.bank || '') ||
        (b.merchant || '').toLowerCase() !== (a.merchant || '').toLowerCase() || S.settings.dismissed?.[`twin:${a.id}:${b.id}`]) continue;
      used.add(a.id); used.add(b.id); pairs.push([a, b]);
      break;
    }
  }
  return pairs;
}

/**
 * Card payments to your own Revolut, Monzo and the like that went in as spending before Crest knew them as top-ups.
 * Moving your own money isn't spending.
 */
export function topUpsCounted(S: State, today: string, days = 60): Tx[] {
  return S.tx.filter((t) => t.kind === 'out' && !t.billId && !t.potId && t.source === 'alert' && isTopUp(t.merchant) &&
    Math.abs(diffDays(t.date, today)) <= days && !S.settings.dismissed?.[`move:${t.id}`]);
}

/**
 * Banks that usually send alerts (on five or more days in the last three weeks) but have gone quiet for three days.
 * Usually the bank's notifications were switched off, or the phone put Crest to sleep.
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
