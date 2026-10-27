import { billDue, checkinGap, cycleOf, dueDirectDebits, pot, potBalance, safeInfo } from './budget';
import type { Bill, Settings, State, Tx } from './types';

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 360000, savings: 5000,
  sideIncome: false, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
const state = (o: Partial<State> = {}): State => ({ v: 1, settings: settings(), bills: [], tx: [], pots: [], accounts: [], checkins: [], ...o });
let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `t${n++}`, kind: 'out', amt: 0, cat: 'other', merchant: '', note: '', date: '2026-10-27', time: '12:00', biz: false, billId: null, ...o });
const bill = (name: string, amt: number, day: number, o: Partial<Bill> = {}): Bill => ({ id: name, name, amt, day, type: 'bill', ...o });

// A tight month: £2,787.23 of bills, paid 27 Oct, a £106.40 cot on day one
const moBills: Bill[] = [
  bill('Rent', 150000, 28), bill('Monzo Flex', 50000, 27, { type: 'debt' }), bill('Barclaycard', 13000, 27, { type: 'debt' }),
  bill('Council tax', 14800, 1), bill('EE', 7800, 28), bill('Monzo int', 8000, 28, { type: 'debt' }), bill('British Gas', 6500, 1),
  bill('Gym', 5999, 1, { type: 'sub' }), bill('Paypal', 5000, 28, { type: 'debt' }), bill('Car insurance', 4700, 27), bill('E.on', 4300, 27),
  bill('Revolut/Plum', 2000, 3, { type: 'sub' }), bill('Claude Pro', 1800, 4, { type: 'sub' }), bill('RAC', 1600, 9, { type: 'sub' }),
  bill('YouTube', 1299, 28, { type: 'sub' }), bill('Simply Business', 1126, 27, { type: 'sub' }), bill('Netflix', 799, 7, { type: 'sub' }),
];

describe('pay cycles', () => {
  it('monthly on the 27th', () => {
    expect(cycleOf('2026-10-27', settings())).toEqual({ start: '2026-10-27', end: '2026-11-26', days: 31 });
    expect(cycleOf('2026-10-26', settings())).toEqual({ start: '2026-09-27', end: '2026-10-26', days: 30 });
  });
  it('a 31st payday in February moves to the last day', () => {
    expect(cycleOf('2026-02-28', settings({ payday: 31 }))).toEqual({ start: '2026-02-28', end: '2026-03-30', days: 31 });
  });
  it('last working day skips the weekend', () => {
    // 31 Oct 2026 is a Saturday, so payday is Friday 30 Oct
    expect(cycleOf('2026-10-27', settings({ payFreq: 'lastwd' }))).toEqual({ start: '2026-09-30', end: '2026-10-29', days: 30 });
    expect(cycleOf('2026-10-30', settings({ payFreq: 'lastwd' })).start).toBe('2026-10-30');
  });
  it('weekly from an anchor payday', () => {
    expect(cycleOf('2026-10-27', settings({ payFreq: 'weekly', payAnchor: '2026-10-23' }))).toEqual({ start: '2026-10-23', end: '2026-10-29', days: 7 });
    expect(cycleOf('2026-10-20', settings({ payFreq: 'fortnightly', payAnchor: '2026-10-23' })).start).toBe('2026-10-09');
  });
});

describe('day one of a tight month', () => {
  const S = state({ bills: moBills, tx: [tx({ kind: 'in', cat: 'salary', amt: 310000, time: '10:07' }), tx({ cat: 'shopping', amt: 10640, merchant: 'Cot shop' })] });
  it('matches what the phone showed', () => {
    const si = safeInfo(S, '2026-10-27');
    expect(si.P).toBe(310000 - 323723 - 5000);
    expect(si.safe).toBe(-9579);
    expect(si.tomorrow).toBe(741);
  });
  it('borrowing adds to the money to spend', () => {
    const S2 = { ...S, tx: [...S.tx, tx({ kind: 'in', cat: 'borrowed', amt: 50000, merchant: 'Monzo Flex' })] };
    expect(pot(S2, cycleOf('2026-10-27', S2.settings))).toBe(32877 + 50000);
  });
  it('moving the cot into a pot takes it off the daily budget', () => {
    const p = { id: 'baby', name: 'Baby', perPay: 3000, target: 60000, opening: 0, start: '2026-10-27' };
    const S3: State = { ...S, pots: [p], tx: S.tx.map((t) => (t.merchant === 'Cot shop' ? { ...t, potId: 'baby' } : t)) };
    expect(safeInfo(S3, '2026-10-27').safe).toBe(Math.round((32877 - 3000) / 31));
    expect(potBalance(S3, 'baby', '2026-10-27')).toBe(3000 - 10640);
  });
});

describe('bills', () => {
  it('finds the due date inside the cycle', () => {
    const c = cycleOf('2026-10-27', settings());
    expect(billDue({ day: 1 }, c)).toBe('2026-11-01');
    expect(billDue({ day: 28 }, c)).toBe('2026-10-28');
  });
  it('shares monthly bills across weekly paydays', () => {
    const S = state({ settings: settings({ payFreq: 'weekly', payAnchor: '2026-10-23', income: 56000, savings: 0 }), bills: [bill('Rent', 95000, 1)] });
    expect(pot(S, cycleOf('2026-10-27', S.settings))).toBe(56000 - Math.round((95000 * 7 * 12) / 365));
  });
  it('pays Direct Debits on their due date, once', () => {
    const S = state({ bills: [bill('EE', 7800, 28, { dd: true, ddFrom: '2026-10-27' })] });
    expect(dueDirectDebits(S, '2026-10-27')).toHaveLength(0);
    const due = dueDirectDebits(S, '2026-10-28');
    expect(due).toHaveLength(1);
    expect(dueDirectDebits({ ...S, tx: due }, '2026-10-29')).toHaveLength(0);
  });
  it('respects a Direct Debit marked unpaid', () => {
    const S = state({ settings: settings({ ddSkip: { 'EE:2026-10-27': true } }), bills: [bill('EE', 7800, 28, { dd: true, ddFrom: '2026-10-27' })] });
    expect(dueDirectDebits(S, '2026-10-28')).toHaveLength(0);
  });
});

describe('starting part-way through a cycle', () => {
  it('uses the balance given at setup', () => {
    const S = state({ settings: settings({ payday: 15, opening: { start: '2026-10-15', date: '2026-10-27', pot: 60000 } }) });
    const si = safeInfo(S, '2026-10-27');
    expect(si.P).toBe(60000);
    expect(si.allowance).toBe(Math.round(60000 / 19));
  });
});

describe('balance check-ins', () => {
  const accounts = [{ id: 'a', name: 'Barclays', type: 'current' as const }, { id: 'c', name: 'Barclaycard', type: 'credit' as const, debtId: 'card' }];
  const base = { id: 'ci1', at: '2026-10-25 09:00', bal: { a: 90000, c: 20000 }, net: 70000, moved: 0 };
  it('finds spending that was not logged', () => {
    const S = state({ accounts, checkins: [base], tx: [tx({ amt: 1000, date: '2026-10-26' })] });
    expect(checkinGap(S, { a: 84000, c: 20000 })).toBe(5000);
  });
  it('does not count paying off your own credit card as spending', () => {
    const S = state({ accounts, checkins: [base], bills: [bill('card', 13000, 26, { type: 'debt' })], tx: [tx({ amt: 13000, billId: 'card', cat: 'bills', date: '2026-10-26' })] });
    expect(checkinGap(S, { a: 77000, c: 7000 })).toBe(0);
  });
  it('spots having more than expected', () => {
    const S = state({ accounts, checkins: [base] });
    expect(checkinGap(S, { a: 95000, c: 20000 })).toBe(-5000);
  });
  it('needs a starting point first', () => {
    expect(checkinGap(state({ accounts }), { a: 1 })).toBeNull();
  });
});
