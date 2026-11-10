// Ask Crest: a question goes to Claude through Crest's AI service; whenever Claude needs a figure it asks the phone,
// and these tools work it out from the data here. Your list of payments never leaves the phone, only the figures
// a question needs (and the few payments a search finds).
import { billItems } from '../engine/bills';
import { counts, cycleOf, safeInfo, txIn } from '../engine/budget';
import { catName, inName } from '../engine/cats';
import { addDays, diffDays, nextDay, parse, prevDay, ymd } from '../engine/dates';
import { owedNow } from '../engine/debts';
import { paceForecast } from '../engine/forecast';
import { shopKey } from '../engine/spending';
import type { State, Tx } from '../engine/types';

const pounds = (p: number) => Math.round(p) / 100;

type Period = 'today' | 'this_pay_month' | 'last_pay_month' | 'last_7_days' | 'last_30_days';

function range(S: State, period: Period, today: string): { from: string; to: string } {
  const c = cycleOf(today, S.settings);
  switch (period) {
    case 'today': return { from: today, to: today };
    case 'last_pay_month': { const p = cycleOf(prevDay(c.start), S.settings); return { from: p.start, to: p.end }; }
    case 'last_7_days': return { from: ymd(addDays(parse(today), -6)), to: today };
    case 'last_30_days': return { from: ymd(addDays(parse(today), -29)), to: today };
    default: return { from: c.start, to: today };
  }
}

const inRange = (S: State, r: { from: string; to: string }) => S.tx.filter((t) => t.date >= r.from && t.date <= r.to);
const matches = (S: State, t: Tx, text?: string) => {
  if (!text) return true;
  const q = text.toLowerCase();
  return `${t.merchant} ${t.note} ${catName(S.settings, t.cat)} ${inName(t.cat)}`.toLowerCase().includes(q);
};

/** Run one tool Claude asked for. Always returns plain data; amounts are in pounds. */
export function runTool(S: State, name: string, input: Record<string, unknown>, today: string): unknown {
  const period = (input.period as Period) || 'this_pay_month';
  switch (name) {
    case 'get_today': {
      const si = safeInfo(S, today), payday = nextDay(si.c.end);
      return {
        today, safe_to_spend_today: pounds(si.safe), daily_allowance_today: pounds(si.allowance), spent_today: pounds(si.todaySpent),
        left_this_pay_month: pounds(si.left), per_day_from_tomorrow: si.tomorrow === null ? null : pounds(si.tomorrow),
        pay_month: { from: si.c.start, to: si.c.end }, next_payday: payday, days_until_payday: diffDays(today, payday),
        note: 'Bills and savings are already taken off. Day-to-day spending is what the daily figure covers.',
      };
    }
    case 'get_spending': {
      const r = range(S, period, today), by = input.by === 'shop' ? 'shop' : 'category';
      const L = inRange(S, r).filter((t) => counts(t) && matches(S, t, input.filter as string | undefined));
      const groups = new Map<string, { name: string; amount: number; payments: number }>();
      for (const t of L) {
        const k = by === 'shop' ? shopKey(t.merchant || '') || 'no name' : t.cat;
        const g = groups.get(k) || { name: by === 'shop' ? t.merchant || 'No name' : catName(S.settings, t.cat), amount: 0, payments: 0 };
        g.amount += t.amt; g.payments++;
        groups.set(k, g);
      }
      const list = [...groups.values()].sort((a, b) => b.amount - a.amount);
      return {
        ...r, total: pounds(L.reduce((a, t) => a + t.amt, 0)), payments: L.length,
        groups: list.slice(0, 15).map((g) => ({ ...g, amount: pounds(g.amount) })),
        note: 'Day-to-day spending only: bills, pots and anything paid from savings are left out.',
      };
    }
    case 'find_payments': {
      const r = range(S, period, today);
      const L = inRange(S, r).filter((t) => matches(S, t, input.text as string | undefined))
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      return {
        ...r, found: L.length,
        payments: L.slice(0, 15).map((t) => ({ date: t.date, name: t.merchant || '', amount: pounds(t.amt), direction: t.kind === 'in' ? 'in' : 'out',
          category: t.kind === 'in' ? inName(t.cat) : t.billId ? 'Bill' : catName(S.settings, t.cat) })),
      };
    }
    case 'try_spending': {
      const amt = Math.round(Number(input.amount) * 100);
      const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) && input.date >= today ? input.date : today;
      if (!(amt > 0)) return { error: 'Give an amount in pounds' };
      const before = safeInfo(S, date);
      const S2: State = { ...S, tx: [...S.tx, { id: 'try', kind: 'out', amt, cat: 'other', merchant: '', note: '', date, time: '12:00', biz: false, billId: null }] };
      const after = safeInfo(S2, date);
      return {
        date, amount: pounds(amt), allowance_that_day: pounds(before.allowance), safe_that_day_before: pounds(before.safe), safe_that_day_after: pounds(after.safe),
        left_this_pay_month_after: pounds(after.left), per_day_after_that: after.tomorrow === null ? null : pounds(after.tomorrow),
        same_pay_month: date <= cycleOf(today, S.settings).end,
      };
    }
    case 'upcoming_bills': {
      const days = Math.min(62, Math.max(1, Number(input.days) || 14)), until = ymd(addDays(parse(today), days));
      const items = billItems(S, today).items.filter((i) => !i.paid && i.due >= today && i.due <= until);
      return { until, bills: items.map((i) => ({ name: i.b.name, amount: pounds(i.b.amt), due: i.due, direct_debit: !!i.b.dd })), note: 'Bills are already taken off the daily figure.' };
    }
    case 'get_debts': {
      const o = owedNow(S, today);
      return {
        total_owed: pounds(o.total), cards_and_loans_clear_by: o.by, wont_clear_at_these_payments: o.never, without_a_balance: o.missing,
        debts: o.items.map((x) => x.kind === 'debt'
          ? { name: x.name, owed: x.left === null ? null : pounds(x.left), monthly_payment: pounds(x.bill.amt), rate: x.bill.rate || null, clear_by: x.plan?.by || null }
          : { name: x.name, owed: pounds(x.left), overdraft: true, interest_a_month: pounds(x.monthlyInterest) }),
      };
    }
    case 'get_forecast': {
      const p = paceForecast(S, today);
      if (!p) return { not_enough_data: true, note: 'Crest waits for a week of the pay month before forecasting.' };
      return { usual_spend_a_day: pounds(p.perDay), left_on_payday_at_this_pace: pounds(p.endLeft), runs_out_on: p.runOut, days_so_far: p.daysGone };
    }
    default:
      return { error: `No tool called ${name}` };
  }
}

export type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };
export type Msg = { role: 'user' | 'assistant'; content: string | Block[] };
type Send = (messages: Msg[]) => Promise<{ stop_reason: string; content: Block[] }>;

/**
 * One question: keep answering Claude's tool calls from the phone until it has an answer. `prior` holds earlier
 * questions and answers as plain text, so a follow-up ("and last month?") makes sense.
 */
export async function askLoop(question: string, prior: Msg[], S: State, today: string, send: Send): Promise<string> {
  let messages: Msg[] = [...prior, { role: 'user', content: question }];
  for (let round = 0; round < 6; round++) {
    const r = await send(messages);
    const uses = r.content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use');
    const text = r.content.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (r.stop_reason !== 'tool_use' || !uses.length) return text || 'Crest couldn’t find an answer to that.';
    messages = [...messages, { role: 'assistant', content: r.content },
      { role: 'user', content: uses.map((u) => ({ type: 'tool_result' as const, tool_use_id: u.id, content: JSON.stringify(runTool(S, u.name, u.input || {}, today)) })) }];
  }
  return 'That took too many steps. Try asking it a simpler way.';
}
