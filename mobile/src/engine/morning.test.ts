/// <reference types="jest" />
import { morningMessage, nextMorning } from './morning';
import type { Settings, State, Tx } from './types';

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 310000, savings: 0,
  sideIncome: false, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `t${n++}`, kind: 'out', amt: 0, cat: 'food', merchant: '', note: '', date: '2026-10-28', time: '12:00', biz: false, billId: null, ...o });
const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;

it('is for today before the set hour, tomorrow after it', () => {
  expect(nextMorning(new Date(2026, 10, 9, 6, 30), 8)).toBe('2026-11-09');
  expect(nextMorning(new Date(2026, 10, 9, 21, 0), 8)).toBe('2026-11-10');
});

it("gives tomorrow's figure, bills going out and a category running fast", () => {
  const S: State = { v: 1, settings: settings({ catLimits: { food: 20000 } }), pots: [], accounts: [], checkins: [],
    bills: [{ id: 'gym', name: 'Gym', amt: 3000, day: 5, type: 'sub' }],
    tx: [tx({ amt: 18000, date: '2026-10-30' }), tx({ amt: 1000, date: '2026-11-04' })] };
  // 31-day month of £3,100 less £30 of bills = £3,070. By the 5th, £190 spent: (£3,070 - £190) / 22 days left
  const m = morningMessage(S, '2026-11-05', fmt);
  expect(m.title).toBe('£130.91 to spend today');
  expect(m.body).toBe('Gym (£30.00) goes out today. Eating out is running fast: £190.00 of £200.00.');
});

it('says when the pay month is already over', () => {
  const S: State = { v: 1, settings: settings({ income: 50000 }), pots: [], accounts: [], checkins: [], bills: [], tx: [tx({ amt: 60000, date: '2026-10-28' })] };
  expect(morningMessage(S, '2026-11-02', fmt)).toEqual({ title: '£100.00 over this pay month', body: 'Payday in 25 days.' });
});
