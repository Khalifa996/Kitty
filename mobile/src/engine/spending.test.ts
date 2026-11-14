/// <reference types="jest" />
import { byShop, catHistory, limitInfo, limitsNow, refundedPayment, shopKey, suggestLimit } from './spending';
import { blankState } from './migrate';
import { cycleOf } from './budget';
import type { Settings, State, Tx } from './types';

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 300000, savings: 0,
  sideIncome: false, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
const state = (tx: Tx[], o: Partial<Settings> = {}): State => ({ v: 1, settings: settings(o), bills: [], tx, pots: [], accounts: [], checkins: [] });
let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `t${n++}`, kind: 'out', amt: 0, cat: 'food', merchant: '', note: '', date: '2026-10-28', time: '12:00', biz: false, billId: null, ...o });

it('groups a shop however the bank spells it', () => {
  expect(shopKey('TFL')).toBe(shopKey('Tfl'));
  expect(shopKey('Revolut**1234*')).toBe('revolut');
  expect(shopKey('Motoring Servi Ref0123456')).toBe('motoring servi');
});

it('ranks shops in a pay month, with refunds off and bills left out', () => {
  const S = state([
    tx({ merchant: 'Cafe Uno', amt: 450 }), tx({ merchant: 'CAFE UNO', amt: 300 }),
    tx({ merchant: 'Big Shop', amt: 2000, cat: 'shopping' }), tx({ kind: 'in', cat: 'refund', merchant: 'Big Shop', amt: 1500 }),
    tx({ merchant: 'Landlord', amt: 90000, cat: 'bills', billId: 'rent' }),
    tx({ merchant: 'Cafe Uno', amt: 999, date: '2026-10-20' }), // the pay month before
  ]);
  const shops = byShop(S, cycleOf('2026-10-28', S.settings));
  expect(shops.map((x) => [x.name, x.amt, x.n])).toEqual([['Cafe Uno', 750, 2], ['Big Shop', 500, 1]]);
});

it('averages only full pay months since you started', () => {
  const S = state([
    tx({ amt: 5000, date: '2026-08-10' }), // part of the month 27 Jul to 26 Aug: Crest started mid-month
    tx({ amt: 10000, date: '2026-09-01' }), tx({ amt: 14000, date: '2026-10-05' }), tx({ amt: 3000, date: '2026-10-30' }),
  ]);
  const h = catHistory(S, 'food', cycleOf('2026-10-30', S.settings));
  expect(h.months.map((m) => m.amt)).toEqual([5000, 10000, 14000, 3000]);
  expect(h.avg).toBe(12000);
  expect(suggestLimit(S, 'food', '2026-10-30')).toBe(12000);
});

it('says a category is running fast only once a week has gone by', () => {
  const S = state([tx({ amt: 6000, date: '2026-10-28' })], { catLimits: { food: 10000 } });
  // Day 2: £60 of £100 spent, but too early to say
  expect(limitInfo(S, 'food', '2026-10-28')).toMatchObject({ spent: 6000, left: 4000, pace: 'ok' });
  // Day 10: at this rate the month ends well over
  expect(limitInfo(S, 'food', '2026-11-05')).toMatchObject({ pace: 'fast' });
  // Day 25: on course
  expect(limitInfo(S, 'food', '2026-11-20')).toMatchObject({ pace: 'ok' });
  S.tx.push(tx({ amt: 5000, date: '2026-11-20' }));
  const now = limitsNow(S, '2026-11-20');
  expect(now.length).toBe(1);
  expect(now[0]).toMatchObject({ cat: 'food', pace: 'over', left: -1000 });
  expect(limitInfo(S, 'fun', '2026-11-20')).toBeNull();
});

it('finds the payment a refund gives back', () => {
  const S = blankState();
  const fee = { id: 'f', kind: 'out' as const, amt: 25000, cat: 'bills', merchant: 'Phone fee', note: '', date: '2026-11-02', time: '09:00', biz: false, billId: null };
  const shoes = { id: 's', kind: 'out' as const, amt: 6000, cat: 'shopping', merchant: 'Shoe Shop', note: '', date: '2026-11-05', time: '12:00', biz: false, billId: null };
  S.tx.push(fee, shoes);
  // No name: the same amount
  expect(refundedPayment(S, { amt: 25000, date: '2026-11-14', merchant: 'Refund' })).toBe(fee);
  // Named: the same shop, even for part of it
  expect(refundedPayment(S, { amt: 2000, date: '2026-11-14', merchant: 'SHOE SHOP LTD' })).toBe(shoes);
  expect(refundedPayment(S, { amt: 1234, date: '2026-11-14' })).toBeNull();
  // Nothing from after the refund, or long before it
  expect(refundedPayment(S, { amt: 25000, date: '2026-11-01' })).toBeNull();
});
