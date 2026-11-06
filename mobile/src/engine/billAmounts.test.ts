/// <reference types="jest" />
import { bigChange, billRange, inBand, learnAmount, paymentsOf, settleBills } from './billAmounts';
import { billItems } from './bills';
import { dueDirectDebits, safeInfo } from './budget';
import { blankState } from './migrate';
import type { Bill, State, Tx } from './types';

// Made-up amounts throughout
const base = (): State => {
  const S = blankState();
  S.settings.payday = 27; S.settings.income = 200000; S.settings.setupDone = true;
  return S;
};
const bill = (o: Partial<Bill>): Bill => ({ id: 'b', name: 'Bill', amt: 5000, day: 1, type: 'bill', dd: true, ...o });
let n = 0;
const paid = (billId: string, amt: number, date: string, o: Partial<Tx> = {}): Tx =>
  ({ id: `t${n++}`, kind: 'out', amt, cat: 'bills', merchant: '', note: '', date, time: '09:00', biz: false, billId, source: 'alert', ...o });

it('treats a bill as fixed until its payments move', () => {
  const S = base();
  S.bills = [bill({ id: 'ph', amt: 3000 })];
  S.tx.push(paid('ph', 3000, '2026-08-01'), paid('ph', 3000, '2026-09-01'), paid('ph', 2980, '2026-10-01'));
  expect(billRange(S, S.bills[0], '2026-10-20')).toMatchObject({ varies: false, n: 3, setAside: 3000 });
});

it('sets aside the most of the last three for a bill that varies, rounded up to a pound', () => {
  const S = base();
  S.bills = [bill({ id: 'el', amt: 5000 })];
  S.tx.push(paid('el', 7110, '2026-07-01'), paid('el', 4820, '2026-08-01'), paid('el', 5260, '2026-09-01'), paid('el', 6130, '2026-10-01'));
  // The July payment is older than the last three, so it doesn't count
  expect(billRange(S, S.bills[0], '2026-10-20')).toMatchObject({ varies: true, n: 3, low: 4820, high: 6130, setAside: 6200 });
});

it('covers the same month last year once there is a year of history', () => {
  const S = base();
  S.bills = [bill({ id: 'gas', amt: 4000 })];
  S.tx.push(paid('gas', 9300, '2025-11-03'), paid('gas', 3900, '2026-08-03'), paid('gas', 4300, '2026-09-01'), paid('gas', 4500, '2026-10-01'));
  // Due 1 Nov in the 27 Oct to 26 Nov window: last November was the dearest
  expect(billRange(S, S.bills[0], '2026-10-28')).toMatchObject({ varies: true, high: 4500, lastYear: 9300, setAside: 9300 });
});

it('leans on the amount you gave until it has seen two payments', () => {
  const S = base();
  S.bills = [bill({ id: 'w', amt: 3500, vary: true })];
  S.tx.push(paid('w', 2900, '2026-10-01'));
  expect(billRange(S, S.bills[0], '2026-10-20')).toMatchObject({ varies: true, n: 1, low: 2900, high: 3500, setAside: 3500 });
});

it('ignores its own ticks and one-offs when learning', () => {
  const S = base();
  S.bills = [bill({ id: 'c', amt: 13000 })];
  S.tx.push(
    paid('c', 13000, '2026-08-01', { source: undefined, auto: true, planned: 13000 }), // Kitty's Direct Debit tick
    paid('c', 13000, '2026-09-01', { source: undefined, planned: 13000 }),             // Mark paid at the usual amount
    paid('c', 12000, '2026-09-15', { source: undefined, planned: 13000 }),             // a payment the person edited
    paid('c', 40000, '2026-10-01', { oneOff: true }),
  );
  expect(paymentsOf(S, S.bills[0]).map((t) => t.amt)).toEqual([12000]);
});

it('counts only payments since a new amount was accepted', () => {
  const S = base();
  S.bills = [bill({ id: 'bb', amt: 3500, amtFrom: '2026-10-01' })];
  S.tx.push(paid('bb', 2500, '2026-08-01'), paid('bb', 2500, '2026-09-01'), paid('bb', 3500, '2026-10-01'));
  expect(billRange(S, S.bills[0], '2026-10-20')).toMatchObject({ varies: false, n: 1 });
});

it('matches an unnamed payment within each bill\'s band', () => {
  const S = base();
  S.bills = [bill({ id: 'fix', amt: 5000 }), bill({ id: 'var', amt: 6000 })];
  S.tx.push(paid('var', 4000, '2026-09-01'), paid('var', 6000, '2026-10-01'));
  const [fix, v] = S.bills;
  // Fixed: within a fifth
  expect([inBand(S, fix, 5900, '2026-11-02'), inBand(S, fix, 6100, '2026-11-02')]).toEqual([true, false]);
  // Varies: half the lowest (£20) to half as much again as the highest (£90)
  expect([inBand(S, v, 2100, '2026-11-02'), inBand(S, v, 8900, '2026-11-02'), inBand(S, v, 9200, '2026-11-02')]).toEqual([true, true, false]);
});

it('asks about big changes: a fifth on fixed bills, well outside the range on ones that vary', () => {
  const S = base();
  S.bills = [bill({ id: 'fix', amt: 5000 }), bill({ id: 'var', amt: 6000, vary: true })];
  expect(bigChange(S, S.bills[0], 5800, '2026-11-02')).toBe(false);
  expect(bigChange(S, S.bills[0], 7500, '2026-11-02')).toBe(true);
  // An overpayment on a card that varies: £120 against a usual £60
  expect(bigChange(S, S.bills[1], 8500, '2026-11-02')).toBe(false);
  expect(bigChange(S, S.bills[1], 12000, '2026-11-02')).toBe(true);
});

it('takes on small changes quietly and big ones only when told', () => {
  const S = base();
  S.bills = [bill({ id: 'fix', amt: 5000 })];
  const small = paid('fix', 5500, '2026-11-02');
  S.tx.push(small);
  learnAmount(S, 'fix', small, '2026-11-02');
  expect(S.bills[0].amt).toBe(5500);

  const T = base();
  T.bills = [bill({ id: 'fix', amt: 5000 })];
  const big = paid('fix', 7500, '2026-11-02');
  T.tx.push(big);
  learnAmount(T, 'fix', big, '2026-11-02');
  expect(T.bills[0].amt).toBe(5000);
  learnAmount(T, 'fix', big, '2026-11-02', true);
  expect(T.bills[0]).toMatchObject({ amt: 7500, amtFrom: '2026-11-02' });
});

it('keeps a varying bill at its set-aside figure, and Direct Debit ticks use it', () => {
  const S = base();
  S.bills = [bill({ id: 'el', amt: 5000, ddFrom: '2026-01-01' })];
  S.tx.push(paid('el', 4100, '2026-09-01'), paid('el', 6650, '2026-10-01'));
  expect(settleBills(S, '2026-11-01')).toBe(1);
  expect(S.bills[0].amt).toBe(6700);
  expect(settleBills(S, '2026-11-01')).toBe(0);
  expect(dueDirectDebits(S, '2026-11-01')[0]).toMatchObject({ amt: 6700, planned: 6700, auto: true });
});

it('spreads what a bill came in under over the rest of the pay month', () => {
  const S = base();
  S.bills = [bill({ id: 'el', amt: 6000, dd: false })];
  const before = safeInfo(S, '2026-11-02');
  // £60 set aside, £45 taken: £15 back, shared over the 25 days left (2 Nov to 26 Nov)
  S.tx.push(paid('el', 4500, '2026-11-02', { planned: 6000 }));
  const after = safeInfo(S, '2026-11-02');
  expect(after.P - before.P).toBe(1500);
  expect(after.allowance - before.allowance).toBe(60);
  // And over: £75 taken against £60 comes off
  S.tx[S.tx.length - 1].amt = 7500;
  expect(safeInfo(S, '2026-11-02').P - before.P).toBe(-1500);
});

it('shows paid bills at what was really paid', () => {
  const S = base();
  S.bills = [bill({ id: 'el', amt: 6000 }), bill({ id: 'ph', amt: 2000, day: 10 })];
  S.tx.push(paid('el', 4500, '2026-11-02', { planned: 6000 }));
  expect(billItems(S, '2026-11-03')).toMatchObject({ total: 6500, paidTotal: 4500 });
});
