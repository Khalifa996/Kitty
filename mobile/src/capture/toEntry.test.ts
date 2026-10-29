/// <reference types="jest" />
import { alreadyLogged, guessCategory, knownCategory, sameName, suggest } from './toEntry';
import { blankState } from '../engine/migrate';
import type { ParsedAlert } from '../parse/bankAlerts';
import type { State } from '../engine/types';

const at = (s: string) => new Date(s).getTime();
const alert = (o: Partial<ParsedAlert>): ParsedAlert => ({ key: 'k', time: at('2026-10-27T12:49:00'), bank: 'Revolut', kind: 'spent', ...o });
const withHistory = (): State => {
  const S = blankState();
  S.settings.payday = 27; S.settings.income = 360000;
  S.tx.push({ id: 'a', kind: 'out', amt: 2630, cat: 'groceries', merchant: 'Tesco', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  S.bills.push({ id: 'rent', name: 'Rent', amt: 125000, day: 28, type: 'bill' }, { id: 'sb', name: 'Insurance', amt: 1126, day: 27, type: 'sub' });
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
  const s = suggest(withHistory(), alert({ amount: 125000, merchant: 'Acme Lettings Limited', bank: 'Barclays' }), 'n2');
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

it('matches a repayment to its debt by name when the amount differs', () => {
  const S = withHistory();
  S.bills.push({ id: 'flex', name: 'Monzo Flex Bill', amt: 50000, day: 27, type: 'debt' });
  expect(suggest(S, alert({ kind: 'bill', amount: 49550, merchant: 'Monzo Flex', bank: 'Monzo', reason: 'Repayment' }), 'n7')).toMatchObject({ action: 'pay-bill', billId: 'flex', tx: { amt: 49550 } });
});

it('treats platform payouts sensibly', () => {
  const S = withHistory();
  const work = suggest(S, alert({ kind: 'received', amount: 8558, merchant: 'Airtasker' }), 'n8');
  expect(work.action === 'add' && work.tx.cat).toBe('extra');
  S.settings.sideIncome = true;
  const biz = suggest(S, alert({ kind: 'received', amount: 8558, merchant: 'Airtasker' }), 'n9');
  expect(biz.action === 'add' && [biz.tx.cat, biz.tx.biz]).toEqual(['side', true]);
  const sold = suggest(S, alert({ kind: 'received', amount: 19000, merchant: 'Vinted' }), 'n10');
  expect(sold.action === 'add' && sold.tx.sub).toBe('Sold something');
});

it('skips moves between your own accounts', () => {
  expect(suggest(withHistory(), alert({ kind: 'transfer', amount: 18000, reason: 'Moved from your Barclays' }), 'n11')).toMatchObject({ action: 'skip', reason: 'Moved from your Barclays' });
});

it('does not pay a bill twice when a Direct Debit already ticked it off', () => {
  const S = withHistory();
  S.tx.push({ id: 'dd', kind: 'out', amt: 1126, cat: 'bills', merchant: 'Insurance', note: '', date: '2026-10-27', time: '06:00', biz: false, billId: 'sb', auto: true });
  expect(suggest(S, alert({ kind: 'bill', amount: 1126, bank: 'Barclays' }), 'n12')).toMatchObject({ action: 'skip', reason: 'Insurance is already ticked off as paid' });
});

it('spots a payment already logged by hand', () => {
  const S = withHistory();
  S.tx.push({ id: 'h', kind: 'out', amt: 830, cat: 'groceries', merchant: 'Tesco', note: '', date: '2026-10-27', time: '12:40', biz: false, billId: null });
  expect(alreadyLogged(S, alert({ amount: 830, merchant: 'Tesco' }))?.id).toBe('h');
  expect(alreadyLogged(S, alert({ amount: 999, merchant: 'Tesco' }))).toBeUndefined();
});

it('knows common UK shops for new users', () => {
  expect(knownCategory('Co-op')).toBe('groceries');
  expect(knownCategory('Caffe Darte')).toBe('food');
  expect(knownCategory('Transport for London')).toBe('transport');
  expect(knownCategory('Amazon.co.uk')).toBe('shopping');
  expect(knownCategory('Hollywood Bowl Derby')).toBe('fun');
  expect(knownCategory('Screwfix')).toBe('home');
  expect(knownCategory('Acme Ltd')).toBeNull();
});

it('prefers your own history over the built-in list', () => {
  const S = withHistory();
  S.tx.push({ id: 'z', kind: 'out', amt: 500, cat: 'home', merchant: 'Amazon', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  const s = suggest(S, alert({ amount: 1825, merchant: 'Amazon.co.uk' }), 'n13');
  expect(s.action === 'add' && s.tx.cat).toBe('home');
});

it('matches bill names written differently', () => {
  expect(sameName('Youtube Premium', 'Google Youtube')).toBe(true);
  expect(sameName('Monzo Flex Bill', 'Monzo Flex')).toBe(true);
  expect(sameName('EE Mobile', 'Tesco')).toBe(false);
  expect(sameName('Paypal Bill', 'Paypal *Spotify')).toBe(false);
});

it('does not count a card payment for a bill Kitty already ticked off', () => {
  const S = withHistory();
  S.bills.push({ id: 'yt', name: 'Youtube Premium', amt: 1299, day: 28, type: 'sub', dd: true });
  S.tx.push({ id: 'ddyt', kind: 'out', amt: 1299, cat: 'bills', merchant: 'Youtube Premium', note: '', date: '2026-10-28', time: '06:00', biz: false, billId: 'yt', auto: true });
  expect(suggest(S, alert({ amount: 1299, merchant: 'Google Youtube', bank: 'Barclays' }), 'n14')).toMatchObject({ action: 'skip', reason: 'Youtube Premium is already ticked off as paid' });
});

it('corrects a Direct Debit Kitty ticked off with the usual amount', () => {
  const S = withHistory();
  S.bills.push({ id: 'flex', name: 'Monzo Flex Bill', amt: 50000, day: 27, type: 'debt', dd: true });
  S.tx.push({ id: 'ddf', kind: 'out', amt: 50000, cat: 'bills', merchant: 'Monzo Flex Bill', note: '', date: '2026-10-27', time: '06:00', biz: false, billId: 'flex', auto: true });
  const s = suggest(S, alert({ kind: 'bill', amount: 48120, merchant: 'Monzo Flex', bank: 'Monzo', reason: 'Repayment' }), 'n15');
  expect(s).toMatchObject({ action: 'pay-bill', billId: 'flex', tx: { amt: 48120 }, replaces: { id: 'ddf' } });
});

it('offers a Direct Debit that matches no bill instead of hiding it', () => {
  const s = suggest(withHistory(), alert({ kind: 'bill', amount: 6120, bank: 'Barclays', reason: 'Direct Debit' }), 'n16');
  expect(s).toMatchObject({ action: 'add', guessed: true, hint: 'Direct Debit that matches none of your bills', tx: { kind: 'out', cat: 'bills', amt: 6120 } });
});

it('spots a round figure logged by hand for the exact bank amount', () => {
  const S = withHistory();
  S.tx.push({ id: 'r', kind: 'in', amt: 18000, cat: 'expenses', merchant: 'Trip', note: '', date: '2026-10-27', time: '09:00', biz: false, billId: null });
  expect(alreadyLogged(S, alert({ kind: 'received', amount: 18045 }))?.id).toBe('r');
  expect(alreadyLogged(S, alert({ kind: 'received', amount: 30000 }))).toBeUndefined();
});

it('treats card reader payouts as business takings when side income is on', () => {
  const S = withHistory();
  const off = suggest(S, alert({ kind: 'received', amount: 4210, merchant: 'Stripe Payments Uk Ltd' }), 'n17');
  expect(off.action === 'add' && [off.tx.cat, off.guessed]).toEqual(['extra', true]);
  S.settings.sideIncome = true;
  const on = suggest(S, alert({ kind: 'received', amount: 4210, merchant: 'Stripe Payments Uk Ltd' }), 'n18');
  expect(on.action === 'add' && [on.tx.cat, on.tx.biz, on.guessed]).toEqual(['side', true, true]);
});
