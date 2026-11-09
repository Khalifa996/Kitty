/// <reference types="jest" />
import { alreadyLogged, emojiCategory, guessCategory, isSure, knownCategory, sameName, suggest, wordCategory } from './toEntry';
import { blankState } from '../engine/migrate';
import type { ParsedAlert } from '../parse/bankAlerts';
import type { State, Tx } from '../engine/types';

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
  expect(s).toMatchObject({ action: 'add', guessed: true, newBill: true, hint: "Barclays didn't say who this Direct Debit is paid to", tx: { kind: 'out', cat: 'bills', amt: 6120 } });
});

it('matches an unnamed Direct Debit to a bill with a close amount from the last few days', () => {
  const S = withHistory();
  S.bills.push({ id: 'en', name: 'Energy', amt: 7000, day: 1, type: 'bill', dd: true }, { id: 'tv', name: 'TV', amt: 1500, day: 30, type: 'sub', dd: true });
  // Kitty ticked the energy bill off on Sunday 1 Nov at the usual amount; the bank took a little less on Monday
  S.tx.push({ id: 'dden', kind: 'out', amt: 7000, cat: 'bills', merchant: 'Energy', note: '', date: '2026-11-01', time: '06:00', biz: false, billId: 'en', auto: true });
  const mon = (h: string) => at(`2026-11-02T${h}:00`);
  expect(suggest(S, alert({ kind: 'bill', amount: 6840, bank: 'Barclays', time: mon('09:30') }), 'n50')).toMatchObject({ action: 'pay-bill', billId: 'en', tx: { amt: 6840 }, replaces: { id: 'dden' } });
  // Not ticked off yet: the TV bill was due on Friday, the bank took it today at a slightly different amount
  expect(suggest(S, alert({ kind: 'bill', amount: 1520, bank: 'Barclays', time: mon('07:00') }), 'n51')).toMatchObject({ action: 'pay-bill', billId: 'tv', tx: { amt: 1520 } });
  // Nothing close: ask to make it a bill
  expect(suggest(S, alert({ kind: 'bill', amount: 42110, bank: 'Barclays', time: mon('09:31') }), 'n52')).toMatchObject({ action: 'add', newBill: true });
  // Not before the due date: a bill due tomorrow isn't matched
  S.bills.push({ id: 'ph', name: 'Phone', amt: 2400, day: 3, type: 'bill', dd: true });
  expect(suggest(S, alert({ kind: 'bill', amount: 2380, bank: 'Barclays', time: mon('09:32') }), 'n53')).toMatchObject({ action: 'add', newBill: true });
  // Another alert has the energy bill's exact amount, so a near one isn't taken for it
  const exact = alert({ key: 'k2', kind: 'bill', amount: 7000, bank: 'Barclays', time: mon('06:50') });
  const close = alert({ key: 'k3', kind: 'bill', amount: 7010, bank: 'Barclays', time: mon('07:40') });
  expect(suggest(S, close, 'n54', [exact, close])).toMatchObject({ action: 'add', newBill: true });
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

it('counts money from your own business as paying yourself, once Kitty has seen you mark it', () => {
  const S = withHistory();
  S.settings.sideIncome = true;
  S.tx.push({ id: 'd', kind: 'in', amt: 10000, cat: 'draw', merchant: 'Acme Repairs', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  // Paired with the business account's "sent" alert, it would normally be skipped as a move between accounts
  const moved = suggest(S, alert({ kind: 'transfer', amount: 25000, merchant: 'Acme Repairs', reason: 'Moved from your Monzo' }), 'n40');
  expect(moved).toMatchObject({ action: 'add', guessed: false, tx: { kind: 'in', cat: 'draw', amt: 25000, biz: false } });
  const plain = suggest(S, alert({ kind: 'received', amount: 5000, merchant: 'Acme Repairs' }), 'n41');
  expect(plain).toMatchObject({ action: 'add', tx: { cat: 'draw' } });
  // The sending half stays a move, and other transfers are still skipped
  expect(suggest(S, alert({ kind: 'transfer', sent: true, amount: 25000, merchant: 'Acme Repairs' }), 'n42').action).toBe('skip');
  expect(suggest(S, alert({ kind: 'transfer', amount: 18000, merchant: 'Savings' }), 'n43').action).toBe('skip');
});

it('puts an overnight TfL charge on the day of travel', () => {
  const S = withHistory();
  const night = suggest(S, alert({ kind: 'spent', amount: 520, merchant: 'Transport for London', time: at('2026-11-07T03:35:00') }), 'n60');
  expect(night).toMatchObject({ action: 'add', tx: { date: '2026-11-06', note: 'Charged the next morning' } });
  const day = suggest(S, alert({ kind: 'spent', amount: 520, merchant: 'Transport for London', time: at('2026-11-07T12:10:00') }), 'n61');
  expect(day).toMatchObject({ action: 'add', tx: { date: '2026-11-07', note: '' } });
});

it('adds by itself only what it is sure about', () => {
  const S = withHistory();
  const sure = (o: Partial<ParsedAlert>) => { const p = alert(o); return isSure(p, suggest(S, p, 'n70'), alreadyLogged(S, p)); };
  expect(sure({ kind: 'spent', amount: 640, merchant: 'Pret A Manger' })).toBe(true);
  // Spending with a guessed category still goes in: the money has gone either way
  expect(sure({ kind: 'spent', amount: 655, merchant: 'Qwzx Ltd' })).toBe(true);
  // Money in that Kitty can't place, cash, unread alerts and anything that looks logged already wait for the person
  expect(sure({ kind: 'received', amount: 5000, merchant: 'Money in' })).toBe(false);
  expect(sure({ kind: 'spent', amount: 2000, merchant: 'Cash machine', cash: true })).toBe(false);
  expect(sure({ kind: 'spent', amount: 999, unsure: true })).toBe(false);
  expect(sure({ kind: 'spent', amount: 2630, merchant: 'Tesco', time: at('2026-10-20T10:05:00') })).toBe(false);
  // A Direct Debit Kitty doesn't know waits for "Make it a bill"
  expect(sure({ kind: 'bill', amount: 4211, bank: 'Barclays' })).toBe(false);
});

it("skips Google Wallet's extra alert when the card's bank sends its own", () => {
  const S = withHistory();
  S.tx.push({ id: 'b', kind: 'out', amt: 300, cat: 'food', merchant: 'Cafe', note: '', date: '2026-10-26', time: '09:00', biz: false, billId: null, bank: 'Barclays' });
  const hold = alert({ kind: 'spent', amount: 500, merchant: 'Scoota Technology AB', bank: 'Google Wallet', reason: 'Paid with Barclays Debit' });
  expect(suggest(S, hold, 'n71')).toMatchObject({ action: 'skip' });
  // A card from a bank Kitty never hears from: Google Wallet is the only record, so it counts
  const other = alert({ kind: 'spent', amount: 1350, merchant: 'Corner Shop', bank: 'Google Wallet', reason: 'Paid with Amex Gold' });
  expect(suggest(S, other, 'n72')).toMatchObject({ action: 'add' });
});

it('treats a second account like any other, and money from it as a move', () => {
  const S = withHistory();
  S.settings.sideIncome = true;
  // Money into the business account from a job platform is side income, like anywhere else
  const inn = suggest(S, alert({ kind: 'received', amount: 7520, merchant: 'Airtasker', bank: 'Monzo', accountName: 'Acme Fixes & Co' }), 'n80');
  expect(inn).toMatchObject({ action: 'add', tx: { kind: 'in', cat: 'side', accountName: 'Acme Fixes & Co' } });
  S.tx.push((inn as { tx: Tx }).tx);
  // Later, money from that account into a personal one is a move between your own accounts
  expect(suggest(S, alert({ kind: 'received', amount: 5000, merchant: 'Acme Fixes & Co', bank: 'Barclays' }), 'n81')).toMatchObject({ action: 'skip' });
});

it('asks about a big spend that is unusual for that name, but not a usual one', () => {
  const S = withHistory();
  const big = suggest(S, alert({ kind: 'spent', amount: 48000, merchant: 'Car Garage Ltd' }), 'n90');
  expect(big).toMatchObject({ action: 'add', big: true });
  expect(isSure(alert({ kind: 'spent', amount: 48000, merchant: 'Car Garage Ltd' }), big)).toBe(false);
  // The weekly shop at the usual place isn't a one-off, however big
  S.tx.push({ id: 'w', kind: 'out', amt: 9500, cat: 'groceries', merchant: 'Tesco', note: '', date: '2026-10-20', time: '10:00', biz: false, billId: null });
  const shop = suggest(S, alert({ kind: 'spent', amount: 9800, merchant: 'Tesco', time: at('2026-10-27T10:00:00') }), 'n92') as { big?: boolean };
  expect(shop.big).toBeUndefined();
});

it("doesn't take a Direct Debit for a bill that's a few pence out of a near amount", () => {
  const S = withHistory();
  S.bills.push({ id: 'tv', name: 'TV', amt: 1099, day: 25, type: 'sub', dd: true });
  // 79p off on a small bill is a different payment, not the TV bill drifting
  expect(suggest(S, alert({ kind: 'bill', amount: 1020, bank: 'Barclays' }), 'n100')).toMatchObject({ action: 'add', newBill: true });
});

it('skips Google Wallet money in when the bank sends its own', () => {
  const S = withHistory();
  S.tx.push({ id: 'b', kind: 'out', amt: 300, cat: 'food', merchant: 'Cafe', note: '', date: '2026-10-26', time: '09:00', biz: false, billId: null, bank: 'Monzo' });
  const check = alert({ kind: 'received', refund: true, amount: 100, merchant: 'Budget App Ltd', bank: 'Google Wallet', reason: 'Paid with Monzo Mastercard' });
  expect(suggest(S, check, 'n101')).toMatchObject({ action: 'skip' });
});

it('treats a card top-up of your own account as a move', () => {
  const S = withHistory();
  expect(suggest(S, alert({ kind: 'spent', amount: 2000, merchant: 'Revolut**1234*', bank: 'Barclays' }), 'n102')).toMatchObject({ action: 'skip' });
  expect(suggest(S, alert({ kind: 'spent', amount: 2000, merchant: 'Monzo', bank: 'Barclays' }), 'n103')).toMatchObject({ action: 'skip' });
  // Shops that only start the same way are still spending
  expect(suggest(S, alert({ kind: 'spent', amount: 950, merchant: 'Chip Shop', bank: 'Barclays' }), 'n104')).toMatchObject({ action: 'add' });
  expect(suggest(S, alert({ kind: 'spent', amount: 950, merchant: 'Plum Tree Cafe', bank: 'Barclays' }), 'n105')).toMatchObject({ action: 'add' });
  // A savings app paid as a monthly bill is the bill
  S.bills.push({ id: 'sv', name: 'Chip savings', amt: 5000, day: 27, type: 'bill' });
  expect(suggest(S, alert({ kind: 'spent', amount: 5000, merchant: 'Chip', bank: 'Barclays' }), 'n106')).toMatchObject({ action: 'pay-bill', billId: 'sv' });
});

it('takes a payment back off when the bank undoes it', () => {
  const S = withHistory();
  S.tx.push({ id: 't1', kind: 'out', amt: 640, cat: 'transport', merchant: 'Transport for London', note: '', date: '2026-10-26', time: '08:00', biz: false, billId: null, bank: 'Revolut' });
  const undo = alert({ key: 'u1', kind: 'received', refund: true, reverted: true, amount: 640, merchant: 'Transport for London' });
  const s = suggest(S, undo, 'n107');
  expect(s).toMatchObject({ action: 'add', guessed: false, tx: { kind: 'in', cat: 'refund', amt: 640, merchant: 'Transport for London' } });
  expect(isSure(undo, s)).toBe(true);
  // The bank names the shop differently on the undo
  expect(suggest(S, { ...undo, merchant: 'TFL Travel CH' }, 'n107b')).toMatchObject({ action: 'add', tx: { merchant: 'Transport for London' } });
  // Nothing counted: the undo isn't money in
  expect(suggest(withHistory(), undo, 'n108')).toMatchObject({ action: 'skip' });
  // Both still waiting: the payment and its undo both stay out
  const pay = alert({ key: 'p1', kind: 'spent', amount: 640, merchant: 'Transport for London', time: at('2026-10-27T08:00:00') });
  expect(suggest(withHistory(), pay, 'n109', [pay, undo])).toMatchObject({ action: 'skip' });
  expect(suggest(withHistory(), undo, 'n110', [pay, undo])).toMatchObject({ action: 'skip' });
});

it('counts everything in your business account as business, once you say which it is', () => {
  const S = withHistory();
  S.settings.sideIncome = true; S.settings.bizAccounts = ['Acme Fixes & Co'];
  // Money in from anyone is side income
  expect(suggest(S, alert({ kind: 'received', amount: 12000, merchant: 'Jo Bloggs', bank: 'Monzo', accountName: 'Acme Fixes & Co' }), 'n111'))
    .toMatchObject({ action: 'add', guessed: false, tx: { kind: 'in', cat: 'side', biz: true } });
  // Spending is a business cost
  expect(suggest(S, alert({ kind: 'spent', amount: 1240, merchant: 'Toolstation', bank: 'Monzo', accountName: 'Acme Fixes & Co' }), 'n112'))
    .toMatchObject({ action: 'add', tx: { kind: 'out', cat: 'home', biz: true } });
  // The personal account in the same app isn't
  expect(suggest(S, alert({ kind: 'received', amount: 12000, merchant: 'Jo Bloggs', bank: 'Monzo' }), 'n113')).toMatchObject({ tx: { cat: 'extra', biz: false } });
});

it("doesn't learn a shop's category from one Kitty guessed", () => {
  const S = withHistory();
  S.tx.push({ id: 'g', kind: 'out', amt: 500, cat: 'other', merchant: 'Corner Kebab', note: '', date: '2026-10-26', time: '09:00', biz: false, billId: null, catGuess: true });
  expect(guessCategory(S, 'Corner Kebab')).toBeNull();
});
