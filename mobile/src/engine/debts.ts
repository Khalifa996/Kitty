// Everything owed in one place: cards and loans (debt bills with a balance) and overdrafts, and how the total has moved.
import { debtFree, debtLeft, monthlyRate, type DebtPlan } from './bills';
import { cycleOf } from './budget';
import { prevDay } from './dates';
import type { Bill, Overdraft, State, Tx } from './types';

const stamp = (t: Tx) => `${t.date} ${t.time}`;

/** A debt's balance at the end of a day: from the last balance entered on or before it, less payments and plus interest since. Null before any balance was entered. */
export function debtLeftAt(S: State, b: Bill, date: string): number | null {
  const end = `${date} 23:59`;
  const pts = [...(b.history || []), ...(b.balance && b.balanceAt ? [{ at: b.balanceAt, left: b.balance }] : [])]
    .filter((p) => p.at <= end).sort((x, y) => x.at.localeCompare(y.at));
  const p = pts[pts.length - 1];
  if (!p) return null;
  const m = monthlyRate(b.rate);
  const moves = S.tx.filter((t) => stamp(t) > p.at && stamp(t) <= end && (t.billId === b.id || (t.kind === 'in' && t.cat === 'borrowed' && t.debtId === b.id)))
    .sort((x, y) => stamp(x).localeCompare(stamp(y)));
  let left = p.left;
  for (const t of moves) left = t.billId === b.id ? left * (1 + m) - t.amt : left + t.amt;
  return Math.max(0, Math.round(left));
}

/** How much of an overdraft was in use at the end of a day, from the last figure entered on or before it. */
export function overdraftAt(o: Overdraft, date: string): number | null {
  const end = `${date} 23:59`;
  const pts = o.history.filter((p) => p.at <= end).sort((x, y) => x.at.localeCompare(y.at));
  return pts.length ? pts[pts.length - 1].used : null;
}

export type Owed =
  | { kind: 'debt'; id: string; name: string; left: number | null; bill: Bill; plan: DebtPlan | null }
  | { kind: 'overdraft'; id: string; name: string; left: number; od: Overdraft; monthlyInterest: number };

export type OwedNow = { items: Owed[]; total: number; missing: number; by: string | null; never: string[] };

/** What's owed today. `by` is when the cards and loans would all be cleared at their current payments (overdrafts have no plan). */
export function owedNow(S: State, today: string): OwedNow {
  const debts: Owed[] = S.bills.filter((b) => b.type === 'debt').map((b) => ({ kind: 'debt', id: b.id, name: b.name, left: debtLeft(S, b), bill: b, plan: debtFree(S, b, today) }));
  const ods: Owed[] = (S.overdrafts || []).map((o) => ({ kind: 'overdraft', id: o.id, name: o.name, left: o.used, od: o, monthlyInterest: Math.round(o.used * monthlyRate(o.rate)) }));
  const items = [...debts, ...ods];
  const plans = debts.map((d) => (d.kind === 'debt' ? d.plan : null)).filter((p): p is DebtPlan => !!p && p.left > 0);
  const never = debts.filter((d) => d.kind === 'debt' && d.plan?.never).map((d) => d.name);
  const by = plans.length && !never.length ? plans.map((p) => p.by as string).sort().pop() as string : null;
  return {
    items,
    total: items.reduce((a, x) => a + (x.left || 0), 0),
    missing: debts.filter((d) => d.left === null).length,
    by, never,
  };
}

/** The total owed at the start of each recent pay month and today, oldest first. A point is left out if anything owed now has no figure for it yet. */
export function owedHistory(S: State, today: string, months = 6): { date: string; total: number }[] {
  const debts = S.bills.filter((b) => b.type === 'debt' && debtLeft(S, b) !== null), ods = S.overdrafts || [];
  if (!debts.length && !ods.length) return [];
  const dates: string[] = [today];
  let c = cycleOf(today, S.settings);
  for (let k = 0; k < months; k++) { if (c.start !== today) dates.unshift(c.start); c = cycleOf(prevDay(c.start), S.settings); }
  const out: { date: string; total: number }[] = [];
  for (const d of dates) {
    const vals = [...debts.map((b) => debtLeftAt(S, b, d)), ...ods.map((o) => overdraftAt(o, d))];
    if (vals.some((v) => v === null)) continue;
    out.push({ date: d, total: (vals as number[]).reduce((a, v) => a + v, 0) });
  }
  return out;
}
