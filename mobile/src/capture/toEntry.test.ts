/// <reference types="jest" />
import { guessCategory, suggest } from './toEntry';
import { blankState } from '../engine/migrate';
import type { ParsedAlert } from '../parse/bankAlerts';
import type { State } from '../engine/types';

const at = (s: string) => new Date(s).getTime();
const alert = (o: Partial<ParsedAlert>): ParsedAlert => ({ key: 'k', time: at('2026-10-27T12:49:00'), bank: 'Revolut', kind: 'spent', ...o });
const withHistory = (): State => {
  const S = blankState();
  S.settings.payday = 27; S.settings.income = 360000;
  S.tx.push({ id: 'a', kind: 'out', amt: 2630, cat: 'groceries', merchant: 'Tesco', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  S.bills.push({ id: 'rent', name: 'Rent', amt: 150000, day: 28, type: 'bill' }, { id: 'sb', name: 'Simply Business', amt: 1126, day: 27, type: 'sub' });
  return S;
};

it('remembers the category for a shop, even with a slightly different name', () => {
  const S = withHistory();
  expect(guessCategory(S, 'Tesco')).toBe('groceries');
  expect(guessCategory(S, 'TESCO STORES')).toBe('groceries');
  expect(guessCategory(S, 'Pret')).toBeNull();
});

it('adds a card payment with the remembered category', () => {
  const s = suggest(withHistory(), alert({ amount: 830, merchant: 'Tesco' }), 'n1');
  expect(s.action).toBe('add');
  if (s.action === 'add') { expect(s.tx).toMatchObject({ kind: 'out', amt: 830, cat: 'groceries', date: '2026-10-27', time: '12:49' }); expect(s.guessed).toBe(false); }
});

it('marks a bill paid when the amount matches', () => {
  const s = suggest(withHistory(), alert({ amount: 150000, merchant: 'Acme Lettings Limited', bank: 'Barclays' }), 'n2');
  expect(s).toMatchObject({ action: 'pay-bill', billName: 'Rent' });
});

it('matches a Direct Debit alert to the bill', () => {
  expect(suggest(withHistory(), alert({ kind: 'bill', amount: 1126, bank: 'Barclays' }), 'n3')).toMatchObject({ action: 'pay-bill', billId: 'sb' });
});

it('treats a payment close to normal pay as pay', () => {
  const s = suggest(withHistory(), alert({ kind: 'received', amount: 310000, merchant: 'Employer' }), 'n4');
  expect(s.action === 'add' && s.tx.cat).toBe('salary');
});

it('skips transfers and ignored alerts', () => {
  expect(suggest(withHistory(), alert({ kind: 'transfer', amount: 3000 }), 'n5').action).toBe('skip');
  expect(suggest(withHistory(), alert({ kind: 'ignore', reason: "Alex's card, not yours" }), 'n6')).toMatchObject({ action: 'skip', reason: "Alex's card, not yours" });
});
