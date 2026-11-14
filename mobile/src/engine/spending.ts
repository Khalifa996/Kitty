// Where the money went: by shop, one category over recent pay months, and optional category limits.
import { counts, cycleOf, txIn } from './budget';
import { addDays, diffDays, parse, prevDay, ymd } from './dates';
import type { Cycle, State, Tx } from './types';

const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/** One name per shop, so "TFL" and "Tfl" land together. Reference numbers and card digits are left out. */
export const shopKey = (name: string) =>
  name.toLowerCase().replace(/\*.*$/, '').replace(/\b[a-z]*\d[\w/.-]*\b/g, '').replace(/[^a-z& ]/g, ' ').replace(/\s+/g, ' ').trim();

export type Shop = { key: string; name: string; amt: number; n: number; cat: string; tx: Tx[] };

/** Day-to-day spending in a pay month by shop, biggest first. Refunds from a shop come off its total. */
export function byShop(S: State, c: Cycle): Shop[] {
  const L = txIn(S, c), m = new Map<string, Shop>();
  for (const t of L.filter(counts)) {
    const key = shopKey(t.merchant || '') || `cat:${t.cat}`;
    const x = m.get(key) || { key, name: t.merchant || '', amt: 0, n: 0, cat: t.cat, tx: [] };
    x.amt += t.amt; x.n++; x.tx.push(t);
    if (t.merchant && t.merchant.length < x.name.length) x.name = t.merchant; // the shortest spelling reads best
    m.set(key, x);
  }
  for (const t of L.filter((t) => t.kind === 'in' && t.cat === 'refund' && !t.biz)) {
    const x = m.get(shopKey(t.merchant || ''));
    if (x) x.amt -= t.amt;
  }
  return [...m.values()].filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt);
}

/** The first day Crest has anything for, so averages never count months from before you started. */
export const firstDay = (S: State) => S.tx.reduce((a, t) => (t.date < a ? t.date : a), '9999-12-31');

/** Spending in one category in a pay month (refunds put back against it come off). */
export function catSpent(S: State, cat: string, c: Cycle): number {
  const L = txIn(S, c);
  return sum(L.filter((t) => counts(t) && t.cat === cat), (t) => t.amt) - sum(L.filter((t) => t.kind === 'in' && t.cat === 'refund' && t.refundCat === cat && !t.biz), (t) => t.amt);
}

export type CatHistory = { months: { c: Cycle; amt: number; full: boolean }[]; avg: number | null };

/** A category in this pay month and the ones before it (oldest first), with the average of the full months before this one. */
export function catHistory(S: State, cat: string, c: Cycle, count = 4): CatHistory {
  const first = firstDay(S), list: CatHistory['months'] = [];
  let x = c;
  for (let k = 0; k < count; k++) {
    list.unshift({ c: x, amt: catSpent(S, cat, x), full: k > 0 && x.start >= first });
    x = cycleOf(prevDay(x.start), S.settings);
  }
  const full = list.filter((m) => m.full);
  return { months: list, avg: full.length ? Math.round(sum(full, (m) => m.amt) / full.length) : null };
}

/** A limit to start from: the usual spend over up to three full pay months, rounded up to the next £5. */
export function suggestLimit(S: State, cat: string, today: string): number | null {
  const h = catHistory(S, cat, cycleOf(today, S.settings), 4);
  if (h.avg === null || h.avg <= 0) return null;
  return Math.ceil(h.avg / 500) * 500;
}

export type LimitInfo = { limit: number; spent: number; left: number; pace: 'ok' | 'fast' | 'over'; daysLeft: number };

/**
 * How a category is doing against its limit this pay month. "fast" only once a week has gone by and,
 * at this rate, it would end the month more than 10% over: early in the month a single shop would make it look worse than it is.
 */
export function limitInfo(S: State, cat: string, today: string): LimitInfo | null {
  const limit = S.settings.catLimits?.[cat];
  if (!limit) return null;
  const c = cycleOf(today, S.settings), spent = catSpent(S, cat, c);
  const gone = diffDays(c.start, today) + 1, daysLeft = c.days - gone;
  const pace = spent > limit ? 'over' : gone >= 7 && (spent / gone) * c.days > limit * 1.1 ? 'fast' : 'ok';
  return { limit, spent, left: limit - spent, pace, daysLeft };
}

/** Every category with a limit, worst first. */
export function limitsNow(S: State, today: string): ({ cat: string } & LimitInfo)[] {
  const rank = { over: 0, fast: 1, ok: 2 } as const;
  return Object.keys(S.settings.catLimits || {})
    .map((cat) => { const l = limitInfo(S, cat, today); return l && { cat, ...l }; })
    .filter((x): x is { cat: string } & LimitInfo => !!x)
    .sort((a, b) => rank[a.pace] - rank[b.pace] || a.left - b.left);
}

const firstWord = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0] || '';

/**
 * The earlier payment a refund gives back: one from the same shop if the bank named it, otherwise one of exactly the same
 * amount, in the 90 days before. Bills paid on time are left out: a refund isn't for those.
 */
export function refundedPayment(S: State, r: { id?: string; amt: number; date: string; merchant?: string }): Tx | null {
  const from = ymd(addDays(parse(r.date), -90)), name = firstWord(r.merchant);
  const L = S.tx.filter((t) => t.id !== r.id && t.kind === 'out' && !t.billId && t.date >= from && t.date <= r.date)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const named = name.length >= 3 && name !== 'refund' ? L.find((t) => firstWord(t.merchant) === name && t.amt >= r.amt) : undefined;
  return named || L.find((t) => t.amt === r.amt) || null;
}
