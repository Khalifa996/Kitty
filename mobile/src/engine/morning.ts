// The morning message: what's safe to spend on a day, written the evening before (or whenever the app was last open).
import { billItems } from './bills';
import { safeInfo } from './budget';
import { catName } from './cats';
import { ymd } from './dates';
import { limitsNow } from './spending';
import type { State } from './types';

/** The day the next morning message is for: today if it's not that time yet, otherwise tomorrow. */
export function nextMorning(now: Date, hour: number): string {
  const d = new Date(now);
  if (now.getHours() >= hour) d.setDate(d.getDate() + 1);
  return ymd(d);
}

/** Title and body for a day's morning message. `fmt` turns pennies into money text. */
export function morningMessage(S: State, day: string, fmt: (p: number) => string): { title: string; body: string } {
  const si = safeInfo(S, day), lines: string[] = [];
  let title: string;
  if (si.left < 0) {
    title = `${fmt(-si.left)} over this pay month`;
    lines.push(`Payday in ${si.daysLeft} day${si.daysLeft === 1 ? '' : 's'}.`);
  } else if (si.safe < 0) {
    title = `${fmt(-si.safe)} over today already`;
  } else {
    title = `${fmt(si.safe)} to spend today`;
    if (si.dayN === 1) lines.push('Payday: a new pay month starts today.');
  }
  const due = billItems(S, day).items.filter((i) => !i.paid && i.due === day);
  if (due.length === 1) lines.push(`${due[0].b.name} (${fmt(due[0].b.amt)}) goes out today.`);
  else if (due.length > 1) lines.push(`${due.length} bills go out today, ${fmt(due.reduce((a, i) => a + i.b.amt, 0))} in all.`);
  for (const l of limitsNow(S, day).filter((x) => x.pace !== 'ok').slice(0, 2)) {
    const name = catName(S.settings, l.cat);
    lines.push(l.pace === 'over' ? `${name} is ${fmt(-l.left)} over its limit.` : `${name} is running fast: ${fmt(l.spent)} of ${fmt(l.limit)}.`);
  }
  return { title, body: lines.join(' ') };
}
