// Bills whose amount moves: energy and water on usage, credit card payments, anything that creeps up at renewal.
// Kitty learns each bill's usual range from what actually left the bank, sets aside the top of it, and gives back
// whatever isn't used (see `billDiff` in budget.ts). Fixed bills take on small changes quietly; big ones are asked about.
import { billDue, billWindowAt } from './budget';
import { addDays, diffDays, parse, ymd } from './dates';
import type { Bill, State, Tx } from './types';

/** How far apart two payments can be and still be the same amount: £1 or 3%, whichever is more. */
export const slack = (amt: number) => Math.max(100, Math.round(amt * 0.03));

/** A change bigger than this share of the usual amount is worth asking about. Smaller ones are taken on quietly. */
export const BIG = 0.2;

/** A payment that says what the bill really cost: from a bank alert, or a figure the person typed. Not Kitty's own
 *  Direct Debit tick, or a tick at exactly what was set aside (those only repeat the guess), and not a one-off. */
export function realAmount(t: Tx): boolean {
  if (t.oneOff || t.kind !== 'out') return false;
  if (t.source === 'alert') return true;
  return t.planned != null ? t.amt !== t.planned : !t.auto;
}

/** Real payments for a bill, newest first, from the date its current amount was accepted. */
export function paymentsOf(S: State, b: Bill, upTo?: string): Tx[] {
  return S.tx.filter((t) => t.billId === b.id && realAmount(t) && (!b.amtFrom || t.date >= b.amtFrom) && (!upTo || t.date <= upTo))
    .sort((x, y) => `${y.date} ${y.time}`.localeCompare(`${x.date} ${x.time}`));
}

export type BillRange = {
  varies: boolean;       // the amount moves (the person said so, or the last three payments weren't the same)
  n: number;             // real payments Kitty is going on, up to three
  low: number; high: number;
  setAside: number;      // what the budget allows for: the bill's amount if fixed, the top of the range if it varies
  lastYear: number | null; // paid around the same time last year, when Kitty has it
};

/** What a bill usually costs and what to set aside for it. With fewer than two real payments, the amount the
 *  person gave counts too, so one cheap month never drags the figure down. */
export function billRange(S: State, b: Bill, today: string): BillRange {
  const all = paymentsOf(S, b, today), last = all.slice(0, 3).map((t) => t.amt);
  const moved = last.length >= 2 && Math.max(...last) - Math.min(...last) > slack(Math.max(...last));
  const varies = b.vary ?? moved;
  if (!varies) return { varies, n: last.length, low: b.amt, high: b.amt, setAside: b.amt, lastYear: null };
  // The same time last year covers winter for energy, once there's a year of history
  const ago = ymd(addDays(parse(billDue(b, billWindowAt(today, S.settings))), -365));
  const ly = all.filter((t) => Math.abs(diffDays(t.date, ago)) <= 20).map((t) => t.amt);
  const lastYear = ly.length ? Math.max(...ly) : null;
  const seen = last.length >= 2 ? last : [b.amt, ...last];
  const low = Math.min(...seen), high = Math.max(...seen), top = Math.max(high, lastYear || 0);
  // Round up to a whole pound when Kitty worked it out, so the figure reads as an allowance, not a bill
  return { varies, n: last.length, low, high, setAside: top === b.amt ? b.amt : Math.ceil(top / 100) * 100, lastYear };
}

/** Could a payment of this amount be this bill, when the bank doesn't name who it's for?
 *  Fixed bills: within a fifth of the usual amount. Bills that vary: half the lowest to half as much again as the highest. */
export function inBand(S: State, b: Bill, amt: number, today: string): boolean {
  const r = billRange(S, b, today);
  if (!r.varies) return Math.abs(amt - b.amt) <= Math.max(slack(b.amt), Math.round(b.amt * BIG));
  return amt >= Math.round(r.low * 0.5) && amt <= Math.round(r.high * 1.5);
}

/** How far a payment is from a bill's usual range, as a share of it. 0 inside the range. For picking the closest bill. */
export function distance(S: State, b: Bill, amt: number, today: string): number {
  const r = billRange(S, b, today);
  if (amt >= r.low && amt <= r.high) return 0;
  return Math.min(Math.abs(amt - r.low), Math.abs(amt - r.high)) / Math.max(1, r.high);
}

/** A payment far enough from the usual to ask whether it's just this once (an overpayment, a catch-up bill).
 *  Fixed bills: more than a fifth either way. Bills that vary: outside their range by half or more. */
export function bigChange(S: State, b: Bill, amt: number, today: string): boolean {
  const r = billRange(S, b, today);
  if (!r.varies) return Math.abs(amt - b.amt) > Math.max(slack(b.amt), Math.round(b.amt * BIG));
  return amt < Math.round(r.low * 0.5) || amt > Math.round(r.high * 1.5);
}

/** After a real payment is added for a bill: a fixed bill takes on the new amount if the change is small, or if the
 *  person said it's the new amount (then older payments stop counting). Bills that vary are left to `settleBills`. */
export function learnAmount(S: State, billId: string, t: Tx, today: string, newNormal = false): void {
  const b = S.bills.find((x) => x.id === billId);
  if (!b || t.oneOff) return;
  // A new amount starts the bill afresh: fixed at that figure until its payments say otherwise
  if (newNormal) { b.amt = t.amt; b.amtFrom = t.date; if (b.vary) b.vary = null; return; }
  if (billRange(S, b, today).varies) return;
  if (!bigChange(S, b, t.amt, today)) b.amt = t.amt;
}

/** Keeps each varying bill's amount at what Kitty sets aside for it, so the Plan, the budget and Direct Debit ticks
 *  all use the same figure. Changes S. Returns how many bills changed. */
export function settleBills(S: State, today: string): number {
  let n = 0;
  for (const b of S.bills) {
    const r = billRange(S, b, today);
    if (r.varies && r.setAside !== b.amt) { b.amt = r.setAside; n++; }
  }
  return n;
}
