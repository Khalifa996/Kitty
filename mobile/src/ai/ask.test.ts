/// <reference types="jest" />
import { askLoop, runTool } from './ask';
import type { Settings, State, Tx } from '../engine/types';

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 310000, savings: 0,
  sideIncome: false, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `t${n++}`, kind: 'out', amt: 0, cat: 'food', merchant: '', note: '', date: '2026-10-28', time: '12:00', biz: false, billId: null, ...o });
const S: State = { v: 1, settings: settings(), pots: [], accounts: [], checkins: [],
  bills: [{ id: 'g', name: 'Gym', amt: 3000, day: 14, type: 'sub' }],
  tx: [tx({ merchant: 'Cafe Uno', amt: 450, date: '2026-11-03' }), tx({ merchant: 'Cafe Uno', amt: 550, date: '2026-11-05' }), tx({ merchant: 'Big Shop', amt: 2000, cat: 'shopping', date: '2026-11-06' })] };
const today = '2026-11-10';

it('answers the questions Claude asks with figures from the phone', () => {
  expect(runTool(S, 'get_today', {}, today)).toMatchObject({ next_payday: '2026-11-27', days_until_payday: 17 });
  expect(runTool(S, 'get_spending', { period: 'this_pay_month', by: 'shop' }, today)).toMatchObject({
    total: 30, payments: 3, groups: [{ name: 'Big Shop', amount: 20, payments: 1 }, { name: 'Cafe Uno', amount: 10, payments: 2 }],
  });
  expect(runTool(S, 'find_payments', { text: 'uno', period: 'last_30_days' }, today)).toMatchObject({ found: 2 });
  expect(runTool(S, 'upcoming_bills', { days: 7 }, today)).toMatchObject({ bills: [{ name: 'Gym', amount: 30, due: '2026-11-14', direct_debit: false }] });
  const t = runTool(S, 'try_spending', { amount: 80, date: '2026-11-14' }, today) as Record<string, number>;
  expect(t.safe_that_day_before - t.safe_that_day_after).toBe(80);
  expect(runTool(S, 'nope', {}, today)).toEqual({ error: 'No tool called nope' });
});

it('keeps answering tool calls until there is an answer', async () => {
  const seen: unknown[] = [];
  const send = async (messages: unknown[]) => {
    seen.push(messages);
    return seen.length === 1
      ? { stop_reason: 'tool_use', content: [{ type: 'tool_use' as const, id: 'u1', name: 'get_today', input: {} }] }
      : { stop_reason: 'end_turn', content: [{ type: 'text' as const, text: 'You have £98.71 to spend today.' }] };
  };
  const a = await askLoop('How much can I spend today?', [], S, today, send);
  expect(a).toBe('You have £98.71 to spend today.');
  const second = seen[1] as { role: string; content: { type: string; content: string }[] }[];
  expect(second.length).toBe(3);
  expect(JSON.parse(second[2].content[0].content)).toMatchObject({ next_payday: '2026-11-27' });
});
