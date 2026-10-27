// The money model. A straight port of the web prototype (index.html), kept pure so it can be tested.
// `today` is always passed in, never read from the clock, so tests can pick any date.
import { addDays, diffDays, dim, lastWorkingDay, nextDay, parse, prevDay, ymd } from './dates';
import type { Bill, Cycle, Settings, State, Tx } from './types';

const FREQ_DAYS: Record<string, number> = { weekly: 7, fortnightly: 14, fourweekly: 28 };
export const isMonthly = (st: Settings) => !FREQ_DAYS[st.payFreq || 'monthly'];
const sum = <T>(list: T[], f: (x: T) => number) => list.reduce((a, x) => a + f(x), 0);

// ---------- Pay cycles ----------
export function cycleOf(s: string, st: Settings): Cycle {
  const f = st.payFreq || 'monthly';
  if (FREQ_DAYS[f]) {
    const L = FREQ_DAYS[f], A = st.payAnchor || s;
    const start = addDays(parse(A), Math.floor(diffDays(A, s) / L) * L);
    return { start: ymd(start), end: ymd(addDays(start, L - 1)), days: L };
  }
  const d = parse(s), y = d.getFullYear(), m = d.getMonth();
  if (f === 'lastwd') {
    let a = lastWorkingDay(y, m);
    if (ymd(a) > s) a = lastWorkingDay(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1);
    const nm = a.getMonth() === 11 ? 0 : a.getMonth() + 1, ny = a.getMonth() === 11 ? a.getFullYear() + 1 : a.getFullYear();
    const end = prevDay(ymd(lastWorkingDay(ny, nm)));
    return { start: ymd(a), end, days: diffDays(ymd(a), end) + 1 };
  }
  const payday = st.payday || 1;
  let start: Date;
  if (d.getDate() >= Math.min(payday, dim(y, m))) start = new Date(y, m, Math.min(payday, dim(y, m)), 12);
  else { const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y; start = new Date(py, pm, Math.min(payday, dim(py, pm)), 12); }
  const nm = start.getMonth() === 11 ? 0 : start.getMonth() + 1, ny = start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear();
  const end = ymd(addDays(new Date(ny, nm, Math.min(payday, dim(ny, nm)), 12), -1));
  return { start: ymd(start), end, days: diffDays(ymd(start), end) + 1 };
}

/** Bills are tracked per pay cycle for monthly pay, per calendar month otherwise. */
export function billWindowAt(t: string, st: Settings): Cycle {
  if (isMonthly(st)) return cycleOf(t, st);
  const d = parse(t), y = d.getFullYear(), m = d.getMonth();
  return { start: ymd(new Date(y, m, 1, 12)), end: ymd(new Date(y, m, dim(y, m), 12)), days: dim(y, m) };
}

export function billDue(bill: Pick<Bill, 'day'>, c: Cycle): string {
  const s = parse(c.start);
  for (let k = 0; k < 2; k++) {
    const base = new Date(s.getFullYear(), s.getMonth() + k, 1, 12);
    const d = ymd(new Date(base.getFullYear(), base.getMonth(), Math.min(bill.day, dim(base.getFullYear(), base.getMonth())), 12));
    if (d >= c.start && d <= c.end) return d;
  }
  return c.end;
}

// ---------- What counts ----------
const IN_FX: Record<string, 'pay' | 'add' | 'refund' | 'none' | 'biz'> = {
  salary: 'pay', extra: 'add', borrowed: 'add', savings: 'add', refund: 'refund', gift: 'add', transfer: 'none', side: 'biz',
};
export const inEffect = (cat: string) => IN_FX[cat] || 'none';
export const addsIn = (t: Tx) => t.kind === 'in' && !t.biz && inEffect(t.cat) === 'add';
export const txIn = (S: State, c: Cycle) => S.tx.filter((t) => t.date >= c.start && t.date <= c.end);

/** Spending that counts against the daily budget. */
export function flexNet(list: Tx[]): number {
  let s = 0;
  for (const t of list) {
    if (t.biz || t.potId) continue;
    if (t.kind === 'out' && !t.billId) s += t.amt;
    else if (t.kind === 'in' && t.cat === 'refund') s -= t.amt;
  }
  return s;
}
export const extraIn = (list: Tx[]) => sum(list.filter(addsIn), (t) => t.amt);

// ---------- The pot for a cycle ----------
export const fixedTotal = (S: State) => sum(S.bills, (b) => b.amt);
export const billShare = (S: State, c: Cycle) => (isMonthly(S.settings) ? 1 : (c.days * 12) / 365);
export const fixedFor = (S: State, c: Cycle) => Math.round(fixedTotal(S) * billShare(S, c));

export function incomeFor(S: State, c: Cycle): number {
  const got = sum(txIn(S, c).filter((t) => t.kind === 'in' && t.cat === 'salary' && !t.biz), (t) => t.amt);
  return got > 0 ? got : S.settings.income;
}
export const openingFor = (S: State, c: Cycle) => { const o = S.settings.opening; return o && o.start === c.start ? o : null; };
export const potsAside = (S: State, c: Cycle) => sum(S.pots.filter((p) => p.start <= c.start && (!p.end || c.start < p.end)), (p) => p.perPay);

export function pot(S: State, c: Cycle): number {
  const o = openingFor(S, c);
  const base = o ? o.pot : incomeFor(S, c) - fixedFor(S, c) - S.settings.savings;
  return base + extraIn(txIn(S, c)) - potsAside(S, c);
}
export const savingsFor = (S: State, c: Cycle) => (openingFor(S, c) ? 0 : S.settings.savings);
export const planDays = (S: State, c: Cycle) => { const o = openingFor(S, c); return o ? diffDays(o.date, c.end) + 1 : c.days; };

// ---------- Today's number ----------
export type SafeInfo = { c: Cycle; P: number; daysLeft: number; dayN: number; allowance: number; todaySpent: number; safe: number; left: number; tomorrow: number | null };

export function safeInfo(S: State, today: string): SafeInfo {
  const c = cycleOf(today, S.settings), L = txIn(S, c), P = pot(S, c);
  const before = flexNet(L.filter((x) => x.date < today)), todaySpent = flexNet(L.filter((x) => x.date === today));
  const daysLeft = diffDays(today, c.end) + 1;
  const allowance = Math.round((P - before) / daysLeft);
  const left = P - before - todaySpent;
  const tomorrow = daysLeft > 1 ? Math.round(left / (daysLeft - 1)) : null;
  return { c, P, daysLeft, dayN: diffDays(c.start, today) + 1, allowance, todaySpent, safe: allowance - todaySpent, left, tomorrow };
}

// ---------- Pots ----------
export function cyclesSince(S: State, start: string, today: string): number {
  const cur = cycleOf(today, S.settings).start;
  let n = 0, s = start;
  while (s <= cur && n < 600) { n++; s = nextDay(cycleOf(s, S.settings).end); }
  return n;
}
export function potBalance(S: State, id: string, today: string): number {
  const p = S.pots.find((x) => x.id === id); if (!p) return 0;
  const n = p.end ? cyclesSince(S, p.start, today) - cyclesSince(S, p.end, today) : cyclesSince(S, p.start, today);
  return (p.opening || 0) + p.perPay * n
    + sum(S.tx.filter((t) => t.potIn === p.id), (t) => t.amt)
    - sum(S.tx.filter((t) => t.potId === p.id && t.kind === 'out'), (t) => t.amt)
    - sum(S.tx.filter((t) => t.potOut === p.id), (t) => t.amt);
}

// ---------- Balance check-ins ----------
const stamp = (t: Tx) => `${t.date} ${t.time}`;
/** Money Kitty knows moved since a moment (+ in, − out), leaving out moves between your own tracked accounts. */
export function loggedSince(S: State, at: string): number {
  const linked = new Set(S.accounts.filter((a) => a.type === 'credit' && a.debtId).map((a) => a.debtId as string));
  let d = 0;
  for (const t of S.tx) {
    if (stamp(t) <= at || t.potIn || t.potOut || t.checkin) continue;
    if (t.kind === 'in') {
      if (t.cat === 'transfer') continue;
      if (t.cat === 'borrowed' && t.debtId && linked.has(t.debtId)) continue;
      d += t.amt;
    } else {
      if (t.billId && linked.has(t.billId)) continue;
      d -= t.amt;
    }
  }
  return d;
}
export const netOf = (S: State, bal: Record<string, number>) => S.accounts.reduce((a, x) => a + (x.type === 'credit' ? -(bal[x.id] || 0) : bal[x.id] || 0), 0);

/** Positive: spending you didn't log. Negative: more money than expected. */
export function checkinGap(S: State, bal: Record<string, number>, moved = 0): number | null {
  const last = S.checkins.length ? S.checkins[S.checkins.length - 1] : null;
  if (!last || last.reset || last.net == null) return null;
  const expected = last.net + loggedSince(S, last.at) - moved;
  return expected - netOf(S, bal);
}

// ---------- Direct Debits ----------
/** Payments to add for Direct Debit bills that have come due. Does not change S. */
export function dueDirectDebits(S: State, today: string, now = '06:00'): Tx[] {
  const skip = S.settings.ddSkip || {}, w = billWindowAt(today, S.settings);
  const wins = [w, billWindowAt(prevDay(w.start), S.settings)];
  const pre = S.settings.prepaid || {};
  const out: Tx[] = [];
  for (const b of S.bills) {
    if (!b.dd) continue;
    for (const win of wins) {
      const due = billDue(b, win);
      const paid = S.tx.some((x) => x.billId === b.id && x.date >= win.start && x.date <= win.end) || pre[b.id] === win.start || out.some((x) => x.billId === b.id && x.date >= win.start && x.date <= win.end);
      if (due > today || due < (b.ddFrom || '') || skip[`${b.id}:${win.start}`] || paid) continue;
      out.push({ id: `dd-${b.id}-${win.start}`, kind: 'out', amt: b.amt, cat: 'bills', sub: b.sub || b.name, merchant: b.name, note: '', date: due, time: now, biz: !!b.biz, billId: b.id, auto: true });
    }
  }
  return out;
}
