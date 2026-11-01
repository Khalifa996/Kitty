// First-run setup: from a few answers (pay, bills, savings, money now) to a ready-to-use Kitty.
// Mirrors finishSetup()/obPot() in the web prototype.
import { billDue, billWindowAt, cycleOf, isMonthly } from './budget';
import { addDays, diffDays, parse, ymd } from './dates';
import { blankState, DEFAULT_LIMITS } from './migrate';
import type { Bill, Settings, State } from './types';

export type DraftBill = { name: string; amt: number; day: number; type: Bill['type'] };
export type Draft = {
  payFreq: Settings['payFreq']; payday: number; payAnchor: string | null;
  income: number; savings: number; sideIncome: boolean;
  bills: DraftBill[];
  balance: number | null; // money now, only asked when starting part-way to payday
};

export const COMMON_BILLS: [string, Bill['type']][] = [
  ['Rent or mortgage', 'bill'], ['Council tax', 'bill'], ['Gas and electric', 'bill'], ['Water', 'bill'], ['Mobile phone', 'bill'],
  ['Broadband', 'bill'], ['TV and streaming', 'sub'], ['Insurance', 'bill'], ['Loan or credit card', 'debt'],
];

export const newDraft = (today: string): Draft => ({
  payFreq: 'monthly', payday: 28, payAnchor: today, income: 0, savings: 0, sideIncome: false, balance: null,
  bills: COMMON_BILLS.map(([name, type]) => ({ name, type, amt: 0, day: 1 })),
});

const asSettings = (d: Draft): Settings => ({ ...blankState().settings, payFreq: d.payFreq, payday: d.payday, payAnchor: d.payFreq === 'monthly' || d.payFreq === 'lastwd' ? null : d.payAnchor, income: d.income, savings: d.savings, sideIncome: d.sideIncome });

export type Preview = { start: string; end: string; next: string; days: number; daysLeft: number; mid: boolean; bills: number; left: number; rem: number; first: number | null };

/** What Kitty will work out from the answers so far. */
export function preview(d: Draft, today: string): Preview {
  const st = asSettings(d), c = cycleOf(today, st), monthly = isMonthly(st);
  const list = d.bills.filter((b) => b.amt > 0 && b.name.trim());
  const total = list.reduce((a, b) => a + b.amt, 0);
  const daysLeft = diffDays(today, c.end) + 1, mid = diffDays(c.start, today) > 0;
  // Bills still to come before payday: by due date for monthly pay, a fair share otherwise
  const rem = monthly ? list.filter((b) => billDue(b, c) >= today).reduce((a, b) => a + b.amt, 0) : Math.round((total * 12 * daysLeft) / 365);
  const bills = Math.round(total * (monthly ? 1 : (c.days * 12) / 365));
  return { start: c.start, end: c.end, next: ymd(addDays(parse(c.end), 1)), days: c.days, daysLeft, mid, bills, left: d.income - bills - d.savings, rem, first: d.balance == null ? null : d.balance - rem };
}

/** Category limits sized to what there is to spend. */
export function fitLimits(budget: number): Record<string, number> {
  const tot = Object.values(DEFAULT_LIMITS).reduce((a, v) => a + v, 0), f = Math.max(0, budget) / tot, o: Record<string, number> = {};
  for (const k in DEFAULT_LIMITS) o[k] = Math.floor((DEFAULT_LIMITS[k] * f) / 500) * 500;
  return o;
}

/** A fresh Kitty from the answers. Direct Debits are ticked off from today; bills due earlier this cycle count as already paid. */
export function applySetup(d: Draft, today: string, now: string, id: () => string): State {
  const S = blankState(), p = preview(d, today);
  S.settings = { ...asSettings(d), setupDone: true, limits: fitLimits(p.left) };
  S.bills = d.bills.filter((b) => b.amt > 0 && b.name.trim()).map((b) => ({
    id: 'b' + id(), name: b.name.trim(), amt: b.amt, day: b.day, type: b.type, biz: false, dd: true, ddFrom: today,
    sub: b.type === 'sub' ? 'Subscription' : b.type === 'debt' ? 'Debt repayment' : b.name.trim(),
  }));
  const w = billWindowAt(today, S.settings);
  S.settings.prepaid = {};
  for (const b of S.bills) if (billDue(b, w) < today) S.settings.prepaid[b.id] = w.start;
  S.settings.opening = p.mid && d.balance != null ? { start: p.start, date: today, pot: p.first as number } : null;
  if (d.balance != null) {
    const a = { id: 'a' + id(), name: 'Main account', type: 'current' as const };
    S.accounts = [a];
    S.checkins = [{ id: id(), at: `${today} ${now}`, bal: { [a.id]: d.balance }, net: d.balance, moved: 0 }];
  }
  return S;
}
