/// <reference types="jest" />
import { debtLeftAt, overdraftAt, owedHistory, owedNow } from './debts';
import type { Bill, Overdraft, Settings, State, Tx } from './types';

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 300000, savings: 0,
  sideIncome: false, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `t${n++}`, kind: 'out', amt: 0, cat: 'bills', merchant: '', note: '', date: '2026-10-27', time: '12:00', biz: false, billId: null, ...o });
const card: Bill = { id: 'card', name: 'Card', amt: 10000, day: 5, type: 'debt', balance: 100000, balanceAt: '2026-09-20 10:00', history: [{ at: '2026-09-20 10:00', left: 100000 }] };
const od: Overdraft = { id: 'od', name: 'Bank overdraft', used: 150000, at: '2026-11-01 09:00', rate: null,
  history: [{ at: '2026-09-15 09:00', used: 200000 }, { at: '2026-11-01 09:00', used: 150000 }] };
const S: State = { v: 1, settings: settings(), bills: [card], pots: [], accounts: [], checkins: [], overdrafts: [od],
  tx: [tx({ billId: 'card', amt: 10000, date: '2026-10-05' }), tx({ billId: 'card', amt: 10000, date: '2026-11-05' })] };

it('works out a debt at any date after its balance was entered', () => {
  expect(debtLeftAt(S, card, '2026-09-10')).toBeNull();
  expect(debtLeftAt(S, card, '2026-09-27')).toBe(100000);
  expect(debtLeftAt(S, card, '2026-10-27')).toBe(90000);
  expect(debtLeftAt(S, card, '2026-11-09')).toBe(80000);
  expect(overdraftAt(od, '2026-10-27')).toBe(200000);
  expect(overdraftAt(od, '2026-09-01')).toBeNull();
});

it('adds up what is owed, with the date the cards and loans clear', () => {
  const o = owedNow(S, '2026-11-09');
  expect(o.total).toBe(230000);
  expect(o.missing).toBe(0);
  expect(o.by).toBe('2027-07-01'); // £800 at £100 a month, December to July
});

it('shows the trend only for months it has figures for', () => {
  expect(owedHistory(S, '2026-11-09')).toEqual([
    { date: '2026-09-27', total: 300000 }, { date: '2026-10-27', total: 290000 }, { date: '2026-11-09', total: 230000 },
  ]);
});
