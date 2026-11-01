/// <reference types="jest" />
import { alreadyLogged, emojiCategory, guessCategory, knownCategory, sameName, suggest, wordCategory } from './toEntry';
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
  expect(knownCategory('Balham Food And Wine')).toBe('groceries');
  expect(knownCategory('MR Vape Limited')).toBe('personal');
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
  S.tx.push({ id: 'b', kind: 'out', amt: 1256, cat: 'health', merchant: 'Boots', note: '', date: '2026-10-27', time: '09:00', biz: false, billId: null });
  expect(alreadyLogged(S, alert({ amount: 1245, merchant: 'Caffe Darte' }))).toBeUndefined();
  expect(alreadyLogged(S, alert({ amount: 1245, merchant: 'Boots UK' }))?.id).toBe('b');
});

it('treats card reader payouts as business takings when side income is on', () => {
  const S = withHistory();
  const off = suggest(S, alert({ kind: 'received', amount: 4210, merchant: 'Stripe Payments Uk Ltd' }), 'n17');
  expect(off.action === 'add' && [off.tx.cat, off.guessed]).toEqual(['extra', true]);
  S.settings.sideIncome = true;
  const on = suggest(S, alert({ kind: 'received', amount: 4210, merchant: 'Stripe Payments Uk Ltd' }), 'n18');
  expect(on.action === 'add' && [on.tx.cat, on.tx.biz, on.guessed]).toEqual(['side', true, true]);
});

it('asks about a cash withdrawal instead of guessing', () => {
  const s = suggest(withHistory(), alert({ amount: 10000, merchant: 'High Street', cash: true }), 'n19');
  expect(s).toMatchObject({ action: 'add', cash: true, guessed: true, tx: { merchant: 'Cash (High Street)', sub: 'Cash' } });
});

it('asks about alerts Kitty could not read', () => {
  expect(suggest(withHistory(), alert({ kind: 'ignore', unsure: true, amount: 3000 }), 'n20').action).toBe('ask');
  expect(suggest(withHistory(), alert({ kind: 'ignore', reason: 'Advert' }), 'n21').action).toBe('skip');
});

it('works out the kind of shop from words in its name', () => {
  expect(wordCategory('Holland Bazaar Ltd')).toBe('groceries');
  expect(wordCategory('Northside Cash & Carry')).toBe('groceries');
  expect(wordCategory('Bread And Co Cafe')).toBe('food');
  expect(wordCategory('Kings Barbers')).toBe('personal');
  expect(wordCategory('Acme Ltd')).toBeNull();
});

it("uses the bank's own category symbol for shops nobody has listed", () => {
  expect(emojiCategory('🍽️')).toBe('food');
  expect(emojiCategory('🛍')).toBe('shopping');
  const s = suggest(withHistory(), alert({ amount: 2800, merchant: 'The Label Yard', emoji: '🛍' }), 'n22');
  expect(s.action === 'add' && [s.tx.cat, s.guessed]).toEqual(['shopping', true]);
  // Your own history wins over the bank
  const S = withHistory();
  S.tx.push({ id: 'ly', kind: 'out', amt: 500, cat: 'personal', merchant: 'The Label Yard', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  const mine = suggest(S, alert({ amount: 2800, merchant: 'The Label Yard', emoji: '🛍' }), 'n23');
  expect(mine.action === 'add' && [mine.tx.cat, mine.guessed]).toEqual(['personal', false]);
});

it("doesn't learn a category from a name Kitty filled in", () => {
  const S = withHistory();
  S.tx.push({ id: 'm', kind: 'in', amt: 18000, cat: 'expenses', merchant: 'Money in', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  const s = suggest(S, alert({ kind: 'received', amount: 4000, merchant: 'Money in' }), 'n24');
  expect(s.action === 'add' && [s.tx.cat, s.guessed]).toEqual(['extra', true]);
});

it('offers a bank charge as a one-off bill', () => {
  const s = suggest(withHistory(), alert({ kind: 'spent', amount: 1234, merchant: 'Monzo charges', reason: 'Bank charge' }), 'n25');
  expect(s).toMatchObject({ action: 'add', tx: { cat: 'bills', sub: 'Bank charge', amt: 1234 } });
});

it('stops asking about alerts the person keeps skipping', () => {
  const S = withHistory();
  const p = alert({ kind: 'ignore', unsure: true, amount: 3000, bank: 'Revolut' });
  expect(suggest(S, p, 'n26').action).toBe('ask');
  S.settings.learned = { skip: { Revolut: 2 } };
  expect(suggest(S, p, 'n27')).toMatchObject({ action: 'skip', reason: 'You skipped alerts like this from Revolut before' });
  S.settings.learned = { skip: { Revolut: 2 }, keep: { Revolut: 1 } };
  expect(suggest(S, p, 'n28').action).toBe('ask');
});
