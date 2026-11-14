/// <reference types="jest" />
import { safeInfo } from './budget';
import { applySetup, newDraft, preview } from './setup';

let k = 0;
const id = () => `x${k++}`;

describe('first-run setup', () => {
  it('a monthly earner starting on payday', () => {
    const d = { ...newDraft('2026-10-28'), payday: 28, income: 200000, savings: 10000 };
    d.bills[0].amt = 80000; d.bills[0].day = 1;   // rent
    d.bills[4].amt = 2000; d.bills[4].day = 15;   // mobile
    const p = preview(d, '2026-10-28');
    expect([p.mid, p.bills, p.left, p.days]).toEqual([false, 82000, 108000, 31]);
    const S = applySetup(d, '2026-10-28', '09:00', id);
    expect(S.bills.map((b) => b.name)).toEqual(['Rent or mortgage', 'Mobile phone']);
    expect(S.settings.opening).toBeNull();
    expect(safeInfo(S, '2026-10-28').allowance).toBe(Math.round(108000 / 31));
  });

  it('starting part-way asks for money now and marks earlier bills as paid', () => {
    const d = { ...newDraft('2026-11-10'), payday: 28, income: 200000 };
    d.bills[0].amt = 80000; d.bills[0].day = 1;    // rent, already paid this cycle
    d.bills[4].amt = 2000; d.bills[4].day = 20;    // mobile, still to come
    d.balance = 50000;
    const p = preview(d, '2026-11-10');
    expect([p.mid, p.rem, p.first, p.daysLeft]).toEqual([true, 2000, 48000, 18]);
    const S = applySetup(d, '2026-11-10', '09:00', id);
    expect(S.settings.opening).toEqual({ start: '2026-10-28', date: '2026-11-10', pot: 48000 });
    expect(Object.keys(S.settings.prepaid || {})).toEqual([S.bills[0].id]);
    expect(safeInfo(S, '2026-11-10').allowance).toBe(Math.round(48000 / 18));
  });

  it('weekly pay shares monthly bills across the week', () => {
    const d = { ...newDraft('2026-10-30'), payFreq: 'weekly' as const, payAnchor: '2026-10-30', income: 45000 };
    d.bills[0].amt = 73000;
    const p = preview(d, '2026-10-30');
    expect([p.days, p.bills, p.left]).toEqual([7, Math.round((73000 * 7 * 12) / 365), 45000 - Math.round((73000 * 7 * 12) / 365)]);
    expect(applySetup(d, '2026-10-30', '09:00', id).settings.payAnchor).toBe('2026-10-30');
  });

  it('turns side income on only when asked', () => {
    expect(applySetup(newDraft('2026-10-28'), '2026-10-28', '09:00', id).settings.sideIncome).toBe(false);
  });
});

import { tidyOld } from './migrate';
it('tidies shop names saved by older versions', () => {
  expect(tidyOld('Revolut You’ve spent £12.30 on your card today')).toBe('Revolut');
  expect(tidyOld('TFL')).toBe('Transport for London');
  expect(tidyOld('Transport for London GBP')).toBe('Transport for London');
  expect(tidyOld('Subway 51234-0')).toBe('Subway');
  expect(tidyOld('Your purchase from Google')).toBe('Google');
  expect(tidyOld('Transport for London. Travel charge for Monday')).toBe('Transport for London');
  expect(tidyOld('Tesco')).toBe('Tesco');
});
