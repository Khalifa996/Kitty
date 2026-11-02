/// <reference types="jest" />
import { billItems, debtFree, debtLeft, debtTip, paidIn } from './bills';
import { blankState } from './migrate';
import type { Bill, State } from './types';

const base = (): State => {
  const S = blankState();
  S.settings.payday = 27; S.settings.setupDone = true;
  return S;
};
const bill = (o: Partial<Bill>): Bill => ({ id: 'b', name: 'Bill', amt: 1000, day: 1, type: 'bill', ...o });

it('knows what is paid, due and coming up this period', () => {
  const S = base();
  S.bills = [bill({ id: 'rent', name: 'Rent', amt: 80000, day: 1 }), bill({ id: 'ee', name: 'Phone', amt: 2000, day: 28 }), bill({ id: 'gym', name: 'Gym', amt: 3000, day: 5 })];
  S.tx.push({ id: 't', kind: 'out', amt: 2000, cat: 'bills', merchant: 'Phone', note: '', date: '2026-10-28', time: '06:00', biz: false, billId: 'ee', auto: true });
  S.settings.prepaid = { rent: '2026-10-27' };
  const r = billItems(S, '2026-11-02');
  expect(r.items.map((i) => [i.b.id, i.due, !!i.paid])).toEqual([['ee', '2026-10-28', true], ['rent', '2026-11-01', true], ['gym', '2026-11-05', false]]);
  expect([r.total, r.paidTotal]).toEqual([85000, 82000]);
  expect(paidIn(S, S.bills[0], r.w)).toEqual({ date: '2026-10-27', auto: false, pre: true });
});

it('works out what is left on a debt and when it clears', () => {
  const S = base();
  const card = bill({ id: 'card', name: 'Card', amt: 10000, day: 15, type: 'debt', balance: 45000, balanceAt: '2026-10-01 09:00' });
  S.bills = [card];
  S.tx.push({ id: 'p', kind: 'out', amt: 10000, cat: 'bills', merchant: 'Card', note: '', date: '2026-10-15', time: '06:00', biz: false, billId: 'card' });
  expect(debtLeft(S, card)).toBe(35000);
  // Paid for this period (27 Sep to 26 Oct) on 15 Oct: 4 more payments from Nov, so clear by Feb 2027
  expect(debtFree(S, card, '2026-10-20')).toMatchObject({ left: 35000, months: 4, by: '2027-02-01', interest: 0, never: false });
});

it('adds interest when the debt has a rate', () => {
  const S = base();
  // An overdraft where the monthly payment is about the interest: it never goes down
  const od = bill({ id: 'od', name: 'Overdraft', amt: 6000, day: 28, type: 'debt', balance: 240000, balanceAt: '2026-10-01 09:00', rate: 39 });
  S.bills = [od];
  S.tx.push({ id: 'p', kind: 'out', amt: 6000, cat: 'bills', merchant: 'Overdraft', note: '', date: '2026-10-28', time: '06:00', biz: false, billId: 'od' });
  expect(debtLeft(S, od)).toBeGreaterThan(240000);
  const f = debtFree(S, od, '2026-11-02');
  expect(f).toMatchObject({ never: true, by: null });
  expect(f?.monthlyInterest).toBeGreaterThan(6000);
  // At 24% the same payment clears it, but much later than the no-interest guess of 40 months
  od.rate = 24;
  const g = debtFree(S, od, '2026-11-02');
  expect(g?.never).toBe(false);
  expect(g?.months).toBeGreaterThan(60);
  expect(g?.interest).toBeGreaterThan(150000);
});

it("suggests moving a finished debt's payment to the dearest one", () => {
  const S = base();
  const flex = bill({ id: 'flex', name: 'Flex', amt: 45000, day: 27, type: 'debt', balance: 90000, balanceAt: '2026-10-27 21:00' });
  const od = bill({ id: 'od', name: 'Overdraft', amt: 6000, day: 28, type: 'debt', balance: 240000, balanceAt: '2026-10-27 21:00', rate: 39 });
  S.bills = [flex, od];
  for (const b of [flex, od]) S.tx.push({ id: 'p' + b.id, kind: 'out', amt: b.amt, cat: 'bills', merchant: b.name, note: '', date: '2026-10-27', time: '12:00', biz: false, billId: b.id });
  const tip = debtTip(S, '2026-11-02');
  expect(tip).toMatchObject({ kind: 'move', extra: 45000, fromBy: '2026-12-01', by: '2027-06-01', saved: null });
  // Nothing finishing soon: what it would take to clear the overdraft in two years
  S.bills = [od];
  expect(debtTip(S, '2026-11-02')).toMatchObject({ kind: 'needs', years: 2 });
});
