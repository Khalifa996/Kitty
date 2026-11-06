// Bills for the Plan screen: what's paid this period, what's due, and when debts clear. Mirrors the web prototype.
import { billDue, billWindowAt } from './budget';
import { parse, ymd } from './dates';
import type { Bill, Cycle, State, Tx } from './types';

export type BillPaid = { date: string; auto: boolean; pre: boolean; amt: number } | null;

/** Paid in this bill period: a payment linked to the bill, or due before you started using Kitty. `amt` is what was paid. */
export function paidIn(S: State, b: Bill, w: Cycle): BillPaid {
  const t = S.tx.find((x) => x.billId === b.id && x.date >= w.start && x.date <= w.end);
  if (t) return { date: t.date, auto: !!t.auto, pre: false, amt: t.amt };
  return (S.settings.prepaid || {})[b.id] === w.start ? { date: w.start, auto: false, pre: true, amt: b.amt } : null;
}

export type BillItem = { b: Bill; due: string; paid: BillPaid };
export function billItems(S: State, today: string): { w: Cycle; items: BillItem[]; total: number; paidTotal: number } {
  const w = billWindowAt(today, S.settings);
  const items = S.bills.map((b) => ({ b, due: billDue(b, w), paid: paidIn(S, b, w) }))
    .sort((x, y) => x.due.localeCompare(y.due) || x.b.name.localeCompare(y.b.name));
  // Paid bills count at what was really paid, the rest at what's set aside for them
  const total = items.reduce((a, i) => a + (i.paid ? i.paid.amt : i.b.amt), 0), paidTotal = items.reduce((a, i) => a + (i.paid ? i.paid.amt : 0), 0);
  return { w, items, total, paidTotal };
}

/** A payment for a bill, dated today. */
export const payTx = (b: Bill, id: string, date: string, time: string): Tx =>
  ({ id, kind: 'out', amt: b.amt, cat: 'bills', sub: b.sub || b.name, merchant: b.name, note: '', date, time, biz: !!b.biz, billId: b.id, planned: b.amt });

/** A yearly interest rate as a monthly one. UK APR and EAR already include compounding, so this is exact for both. */
export const monthlyRate = (rate?: number | null) => (rate && rate > 0 ? Math.pow(1 + rate / 100, 1 / 12) - 1 : 0);

/** What's left on a debt: the balance you gave, then for each repayment since a month's interest added and the payment taken off,
 *  plus anything borrowed on it since. Without a rate this is simply balance less repayments. */
export function debtLeft(S: State, b: Bill): number | null {
  if (!b.balance) return null;
  const at = b.balanceAt || '', after = (t: Tx) => `${t.date} ${t.time}` > at, m = monthlyRate(b.rate);
  const moves = S.tx.filter((t) => after(t) && (t.billId === b.id || (t.kind === 'in' && t.cat === 'borrowed' && t.debtId === b.id)))
    .sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`));
  let left = b.balance;
  for (const t of moves) left = t.billId === b.id ? left * (1 + m) - t.amt : left + t.amt;
  return Math.max(0, Math.round(left));
}

/** Months to clear a balance at a monthly payment (plus an extra amount from a later month), with the interest paid.
 *  Null when it never clears (within 50 years). */
export function payoff(left: number, pay: number, m: number, extra = 0, extraFrom = 0): { months: number; interest: number } | null {
  let bal = left, months = 0, interest = 0;
  while (bal > 0) {
    if (months >= 600) return null;
    const i = bal * m;
    interest += i;
    bal = bal + i - pay - (months >= extraFrom ? extra : 0);
    months++;
  }
  return { months, interest: Math.round(interest) };
}

export type DebtPlan = { left: number; months: number; by: string | null; interest: number; monthlyInterest: number; never: boolean; first: string };

/** When a debt clears at its usual payment. With a rate, interest is included; without one it's a best case. */
export function debtFree(S: State, b: Bill, today: string): DebtPlan | null {
  const left = debtLeft(S, b);
  if (left === null) return null;
  const w = billWindowAt(today, S.settings), due = parse(billDue(b, w));
  const first = paidIn(S, b, w) ? new Date(due.getFullYear(), due.getMonth() + 1, 1, 12) : new Date(due.getFullYear(), due.getMonth(), 1, 12);
  const m = monthlyRate(b.rate), monthlyInterest = Math.round(left * m);
  if (left <= 0) return { left: 0, months: 0, by: null, interest: 0, monthlyInterest: 0, never: false, first: ymd(first) };
  const p = b.amt ? payoff(left, b.amt, m) : null;
  if (!p) return { left, months: 0, by: null, interest: 0, monthlyInterest, never: true, first: ymd(first) };
  return { left, months: p.months, by: ymd(new Date(first.getFullYear(), first.getMonth() + p.months - 1, 1, 12)), interest: p.interest, monthlyInterest, never: false, first: ymd(first) };
}

export type DebtTip =
  | { kind: 'move'; from: Bill; fromBy: string; to: Bill; extra: number; by: string; saved: number | null }
  | { kind: 'needs'; to: Bill; pay: number; years: number };

/** One useful move for the dearest debt: when another debt is about to finish, what its payment would do here.
 *  If nothing finishes soon and the dearest debt never clears, what it would take to clear it in two years. */
export function debtTip(S: State, today: string): DebtTip | null {
  const plans = S.bills.filter((b) => b.type === 'debt').map((b) => ({ b, f: debtFree(S, b, today) })).filter((x) => x.f && x.f.left > 0) as { b: Bill; f: DebtPlan }[];
  const dear = plans.filter((x) => x.b.rate).sort((x, y) => (y.b.rate || 0) - (x.b.rate || 0))[0];
  if (!dear) return null;
  const m = monthlyRate(dear.b.rate);
  const soon = plans.filter((x) => x !== dear && !x.f.never && x.f.months > 0 && x.f.months <= 3).sort((x, y) => x.f.months - y.f.months)[0];
  if (soon) {
    // Months from the dearest debt's first payment until the other one's payment is free
    const offset = (parse(soon.f.first).getFullYear() - parse(dear.f.first).getFullYear()) * 12 + parse(soon.f.first).getMonth() - parse(dear.f.first).getMonth();
    const p = payoff(dear.f.left, dear.b.amt, m, soon.b.amt, Math.max(0, offset + soon.f.months));
    if (p) {
      const first = parse(dear.f.first);
      return { kind: 'move', from: soon.b, fromBy: soon.f.by as string, to: dear.b, extra: soon.b.amt, by: ymd(new Date(first.getFullYear(), first.getMonth() + p.months - 1, 1, 12)),
        saved: dear.f.never ? null : Math.max(0, dear.f.interest - p.interest) };
    }
  }
  if (dear.f.never) {
    const n = 24, pay = Math.ceil((dear.f.left * m) / (1 - Math.pow(1 + m, -n)) / 100) * 100;
    return { kind: 'needs', to: dear.b, pay, years: 2 };
  }
  return null;
}
