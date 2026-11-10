// "At your usual pace...": where the pay month is heading, from how you've actually spent so far.
// Only after a week of the pay month, so a single big day doesn't decide it.
import { counts, isSpread, safeInfo, txIn } from './budget';
import { addDays, diffDays, parse, ymd } from './dates';
import type { State } from './types';

export type Pace = {
  perDay: number;      // usual day-to-day spending a day so far this pay month (one-offs left out)
  endLeft: number;     // about what's left on payday at that pace (negative: short by this much)
  runOut: string | null; // the day the money runs out at that pace, if it does before payday
  daysGone: number;
};

export const MIN_DAYS = 7;

export function paceForecast(S: State, today: string): Pace | null {
  const si = safeInfo(S, today), c = si.c;
  const daysGone = diffDays(c.start, today); // whole days before today
  if (daysGone < MIN_DAYS) return null;
  const L = txIn(S, c).filter((t) => t.date < today);
  const spent = L.filter((t) => counts(t) && !isSpread(t)).reduce((a, t) => a + t.amt, 0)
    - L.filter((t) => t.kind === 'in' && t.cat === 'refund').reduce((a, t) => a + t.amt, 0);
  const perDay = Math.max(0, Math.round(spent / daysGone));
  const fromToday = si.left + si.todaySpent; // what's left to spend from the start of today
  const endLeft = fromToday - perDay * si.daysLeft;
  let runOut: string | null = null;
  if (endLeft < 0 && perDay > 0) runOut = ymd(addDays(parse(today), Math.max(0, Math.floor(fromToday / perDay))));
  return { perDay, endLeft, runOut, daysGone };
}

/** One honest sentence about it. */
export function paceLine(p: Pace, fmt: (n: number) => string, day: (d: string) => string): string {
  const pace = `At your usual pace (about ${fmt(p.perDay)} a day)`;
  if (p.endLeft >= 0) return `${pace} you'll have about ${fmt(p.endLeft)} left on payday.`;
  return p.runOut ? `${pace} the money runs out around ${day(p.runOut)}, about ${fmt(-p.endLeft)} short by payday.` : `${pace} you'll be about ${fmt(-p.endLeft)} short by payday.`;
}
