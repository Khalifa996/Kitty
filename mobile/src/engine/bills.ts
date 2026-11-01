// Bills for the Plan screen: what's paid this period, what's due, and when debts clear. Mirrors the web prototype.
import { billDue, billWindowAt } from './budget';
import { parse, ymd } from './dates';
import type { Bill, Cycle, State, Tx } from './types';

export type BillPaid = { date: string; auto: boolean; pre: boolean } | null;

/** Paid in this bill period: a payment linked to the bill, or due before you started using Kitty. */
export function paidIn(S: State, b: Bill, w: Cycle): BillPaid {
  const t = S.tx.find((x) => x.billId === b.id && x.date >= w.start && x.date <= w.end);
  if (t) return { date: t.date, auto: !!t.auto, pre: false };
  return (S.settings.prepaid || {})[b.id] === w.start ? { date: w.start, auto: false, pre: true } : null;
}

export type BillItem = { b: Bill; due: string; paid: BillPaid };
export function billItems(S: State, today: string): { w: Cycle; items: BillItem[]; total: number; paidTotal: number } {
  const w = billWindowAt(today, S.settings);
  const items = S.bills.map((b) => ({ b, due: billDue(b, w), paid: paidIn(S, b, w) }))
    .sort((x, y) => x.due.localeCompare(y.due) || x.b.name.localeCompare(y.b.name));
  const total = items.reduce((a, i) => a + i.b.amt, 0), paidTotal = items.filter((i) => i.paid).reduce((a, i) => a + i.b.amt, 0);
  return { w, items, total, paidTotal };
}

/** A payment for a bill, dated today. */
export const payTx = (b: Bill, id: string, date: string, time: string): Tx =>
  ({ id, kind: 'out', amt: b.amt, cat: 'bills', sub: b.sub || b.name, merchant: b.name, note: '', date, time, biz: !!b.biz, billId: b.id });

/** What's left on a debt: the balance you gave, less repayments since, plus anything borrowed on it since. */
export function debtLeft(S: State, b: Bill): number | null {
  if (!b.balance) return null;
  const at = b.balanceAt || '', after = (t: Tx) => `${t.date} ${t.time}` > at;
  const paid = S.tx.filter((t) => t.billId === b.id && after(t)).reduce((a, t) => a + t.amt, 0);
  const borrowed = S.tx.filter((t) => t.kind === 'in' && t.cat === 'borrowed' && t.debtId === b.id && after(t)).reduce((a, t) => a + t.amt, 0);
  return Math.max(0, b.balance - paid + borrowed);
}

/** When a debt clears at its usual payment, ignoring interest (a best case). */
export function debtFree(S: State, b: Bill, today: string): { left: number; months: number; by: string | null } | null {
  const left = debtLeft(S, b);
  if (left === null) return null;
  if (left <= 0 || !b.amt) return { left: 0, months: 0, by: null };
  const w = billWindowAt(today, S.settings), months = Math.ceil(left / b.amt), due = parse(billDue(b, w));
  const first = paidIn(S, b, w) ? new Date(due.getFullYear(), due.getMonth() + 1, 1, 12) : new Date(due.getFullYear(), due.getMonth(), 1, 12);
  return { left, months, by: ymd(new Date(first.getFullYear(), first.getMonth() + months - 1, 1, 12)) };
}
