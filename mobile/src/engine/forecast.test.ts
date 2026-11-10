/// <reference types="jest" />
import { paceForecast, paceLine } from './forecast';
import { findRecurring } from './recurring';
import type { Settings, State, Tx } from './types';
import { addDays, parse, ymd } from './dates';

const day = (i: number) => ymd(addDays(parse('2026-10-27'), i));

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 93000, savings: 0,
  sideIncome: false, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `t${n++}`, kind: 'out', amt: 0, cat: 'food', merchant: '', note: '', date: '2026-10-28', time: '12:00', biz: false, billId: null, ...o });
const state = (txs: Tx[], o: Partial<Settings> = {}): State => ({ v: 1, settings: settings(o), bills: [], tx: txs, pots: [], accounts: [], checkins: [], });
const fmt = (p: number) => `£${Math.round(p / 100)}`;

it('waits for a week of the pay month before saying anything', () => {
  expect(paceForecast(state([tx({ amt: 5000, date: '2026-10-28' })]), '2026-11-02')).toBeNull();
});

it('says when the money runs out at the usual pace', () => {
  // £930 for a 31-day month. £50 a day for the first 10 days: £430 left for 21 days, at £50 a day that's 8 days
  const S = state(Array.from({ length: 10 }, (_, i) => tx({ amt: 5000, date: day(i) })));
  const p = paceForecast(S, day(10))!;
  expect(p.perDay).toBe(5000);
  expect(p.endLeft).toBe(43000 - 5000 * 21);
  expect(p.runOut).toBe(day(18));
  expect(paceLine(p, fmt, (d) => d)).toBe(`At your usual pace (about £50 a day) the money runs out around ${day(18)}, about £620 short by payday.`);
});

it('says what should be left when on course, leaving one-offs out of the pace', () => {
  const S = state([
    ...Array.from({ length: 8 }, (_, i) => tx({ amt: 1000, date: day(i) })),
    tx({ amt: 20000, cat: 'bills', date: day(2) }), // a one-off, spread over the month
  ]);
  const p = paceForecast(S, day(8))!;
  expect(p.perDay).toBe(1000);
  expect(p.endLeft).toBeGreaterThan(0);
  expect(p.runOut).toBeNull();
});

it('spots a monthly payment that is not a bill yet', () => {
  const S = state([
    tx({ merchant: 'Streamio', amt: 799, date: '2026-09-07', cat: 'fun' }),
    tx({ merchant: 'STREAMIO', amt: 799, date: '2026-10-07', cat: 'fun' }),
    tx({ merchant: 'Streamio', amt: 799, date: '2026-11-07', cat: 'fun' }),
    tx({ merchant: 'Cafe Uno', amt: 450, date: '2026-10-07' }), tx({ merchant: 'Cafe Uno', amt: 900, date: '2026-11-07' }),
    tx({ merchant: 'Gym Co', amt: 3000, date: '2026-10-01' }), tx({ merchant: 'Gym Co', amt: 3000, date: '2026-11-01' }),
  ]);
  S.bills.push({ id: 'g', name: 'Gym Co membership', amt: 3000, day: 1, type: 'sub' });
  const r = findRecurring(S, '2026-11-10');
  expect(r.map((x) => [x.name, x.amt, x.day, x.count])).toEqual([['Streamio', 799, 7, 3]]);
  S.settings.dismissed = { 'rec:streamio': true };
  expect(findRecurring(S, '2026-11-10')).toEqual([]);
});
