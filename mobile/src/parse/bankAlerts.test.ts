/// <reference types="jest" />
import { parseAlert, parseAll, tidyName, RawAlert } from './bankAlerts';

const REV = 'com.revolut.revolut';
const BAR = 'com.barclays.android.barclaysmobilebanking';
const GW = 'com.google.android.apps.walletnfcrel';
let n = 0;
const a = (pkg: string, title: string, text: string, time = 0): RawAlert => ({ key: `k${n++}`, pkg, title, text, time });

describe('Revolut (real alerts, Oct 2026)', () => {
  it('reads a card payment with the shop as the title', () => {
    const p = parseAlert(a(REV, 'Tesco', '🛒 You spent £8.30\nGBP balance: £72.44'));
    expect(p).toMatchObject({ kind: 'spent', amount: 830, merchant: 'Tesco', balance: 7244, bank: 'Revolut' });
  });
  it('reads a fuel payment', () => {
    expect(parseAlert(a(REV, 'Green Man Service Station', '🚌 You spent £56.32\nGBP balance: £81.42'))).toMatchObject({ kind: 'spent', amount: 5632, merchant: 'Green Man Service Station' });
  });
  it("ignores a family member's card", () => {
    const p = parseAlert(a(REV, 'Alex 💳', 'Spent £1 at Iron Brew\nBalance: £0.49'));
    expect(p.kind).toBe('ignore');
    expect(p.reason).toMatch(/Alex's card/);
  });
  it('ignores payment checks', () => {
    expect(parseAlert(a(REV, 'Verify a payment', 'Alex is making an online payment of £3.99 to NVIDIA CORPORATION. Tap to verify')).kind).toBe('ignore');
  });
  it('ignores a card being saved with a shop', () => {
    expect(parseAlert(a(REV, 'Card authorised', 'Your card has been authorised for future payments with OpenAI')).kind).toBe('ignore');
  });
  it('reads money coming in', () => {
    expect(parseAlert(a(REV, 'Revolut', 'You received £25.00 from Sam Smith'))).toMatchObject({ kind: 'received', amount: 2500, merchant: 'Sam Smith' });
  });
});

describe('Barclays (real alerts, Oct 2026)', () => {
  it('reads a card payment with the shop named', () => {
    const p = parseAlert(a(BAR, 'Barclays', "Pers acct - You've spent £1.99 with GOOGLE PLAY APPS from your account ending 1111."));
    expect(p).toMatchObject({ kind: 'spent', amount: 199, merchant: 'Google Play Apps', account: '1111' });
  });
  it('reads a payment captured on the phone (28 Oct)', () => {
    const p = parseAlert(a(BAR, 'Barclays', "Pers acct - You've spent £1.00 with ABC TRADE WORK from your account ending 1111."));
    expect(p).toMatchObject({ kind: 'spent', amount: 100, merchant: 'ABC Trade Work', account: '1111' });
  });
  it('reads rent paid to a company', () => {
    expect(parseAlert(a(BAR, 'Barclays', "Pers acct - You've spent £1250.00 with ACME LETTINGS LIMITED from your account ending 2222."))).toMatchObject({ kind: 'spent', amount: 125000, merchant: 'Acme Lettings Limited', account: '2222' });
  });
  it('reads a payment with no shop name and says so', () => {
    const p = parseAlert(a(BAR, 'Barclays', "Pers acct - You've spent £106.40 from your account ending 1111."));
    expect(p).toMatchObject({ kind: 'spent', amount: 10640 });
    expect(p.merchant).toBeUndefined();
  });
  it('reads money sent to someone', () => {
    expect(parseAlert(a(BAR, 'Barclays', 'Pers acct - You sent £571.00 from your account ending 1111.'))).toMatchObject({ kind: 'spent', amount: 57100, merchant: 'Payment sent' });
  });
  it('treats moving money to another account as a transfer', () => {
    expect(parseAlert(a(BAR, 'Barclays', 'Pers acct - You transferred £30.00 to another account, from your account ending 1111.'))).toMatchObject({ kind: 'transfer', amount: 3000 });
  });
  it('matches Direct Debits to bills', () => {
    expect(parseAlert(a(BAR, 'Barclays', 'Pers acct - Your £11.26 Direct Debit was paid from your account ending 1111.'))).toMatchObject({ kind: 'bill', amount: 1126 });
  });
  it('ignores overdraft warnings', () => {
    expect(parseAlert(a(BAR, 'Barclays', 'Hello. Your account 1111 is overdrawn. Interest charges of 35.0% EAR (variable) apply. Tap here to move money to reduce or avoid interest charges, by 6.45pm today.')).kind).toBe('ignore');
  });
  it('ignores standing order notices and empty notices', () => {
    expect(parseAlert(a(BAR, 'Barclays', "We've set up your standing order for £1999 to SECOND ACCOUNT every month, from account ending 1111. Tap to view or cancel it.")).kind).toBe('ignore');
    expect(parseAlert(a(BAR, 'New notification', 'You have a new notification from Barclays.')).kind).toBe('ignore');
  });
});

describe('Google Wallet', () => {
  it('reads the shop from the title', () => {
    expect(parseAlert(a(GW, 'TESCO STORES', '£8.30 with Revolut Visa ••3333'))).toMatchObject({ kind: 'spent', amount: 830, merchant: 'Tesco Stores', account: '3333' });
  });
  it('drops the Wallet copy when the bank sent the same payment', () => {
    const t = 1_700_000_000_000;
    const out = parseAll([a(GW, 'TESCO STORES', '£8.30 with Revolut Visa ••3333', t), a(REV, 'Tesco', '🛒 You spent £8.30\nGBP balance: £72.44', t + 2000)]);
    expect(out[0]).toMatchObject({ kind: 'ignore', reason: 'Same payment as Revolut' });
    expect(out[1]).toMatchObject({ kind: 'spent', merchant: 'Tesco' });
  });
});

describe('Other banks (generic wording until we have real samples)', () => {
  it('Starling style', () => {
    expect(parseAlert(a('com.starlingbank.android', 'Starling Bank', 'You spent £12.40 at Sainsburys'))).toMatchObject({ kind: 'spent', amount: 1240, merchant: 'Sainsburys' });
  });
  it('NatWest style refund', () => {
    expect(parseAlert(a('com.rbs.mobile.android.natwest', 'NatWest', 'Refund of £20.00 from AMAZON'))).toMatchObject({ kind: 'received', refund: true, amount: 2000, merchant: 'Amazon' });
  });
  it('handles thousands separators', () => {
    expect(parseAlert(a(BAR, 'Barclays', "You've spent £1,250.00 with ACME LETTINGS from your account ending 2222.")).amount).toBe(125000);
  });
});

describe('real alerts, 27 to 29 Oct (names changed)', () => {
  const MON = 'co.uk.getmondo';
  it('reads Barclays money in, not as spending', () => {
    expect(parseAlert(a(BAR, 'Barclays', "Pers acct - You've been paid £225.76 to your account ending 1111. This credit may take up to 24 hours to show."))).toMatchObject({ kind: 'received', amount: 22576 });
  });
  it('reads Revolut money in, with the amount in the title', () => {
    expect(parseAlert(a(REV, 'You received £85.58', 'Payment received from Airtasker Uk Limited. Tap for details'))).toMatchObject({ kind: 'received', amount: 8558, merchant: 'Airtasker' });
    expect(parseAlert(a(REV, 'You received £190', 'Payment received from Mangopay S.a.. Tap for details'))).toMatchObject({ kind: 'received', amount: 19000, merchant: 'Vinted' });
  });
  it('reads Monzo, which puts everything in the title', () => {
    expect(parseAlert(a(MON, '🍏 £1 at Co-op', ''))).toMatchObject({ kind: 'spent', amount: 100, merchant: 'Co-op' });
    expect(parseAlert(a(MON, '🤸🏽 £495.50 Monzo Flex payment made', 'You made your monthly payment'))).toMatchObject({ kind: 'bill', amount: 49550, merchant: 'Monzo Flex', reason: 'Repayment' });
  });
  it('drops the Google Wallet copy of a Monzo payment', () => {
    const out = parseAll([a(MON, '🍏 £1 at Co-op', '', 1000), a(GW, 'WELCOME', '£1.00 with Monzo Mastercard ••1234', 6000)]);
    expect(out.map((p) => p.kind)).toEqual(['spent', 'ignore']);
  });
  it('cleans card terminal names', () => {
    expect(parseAlert(a(GW, 'SumUp  *CAFFE DARTE LTD', '£12.45 with Revolut Visa ••1234')).merchant).toBe('Caffe Darte Ltd');
  });
  it('pairs money moved between your own banks, even minutes apart', () => {
    const m = 60 * 1000;
    const out = parseAll([
      a(REV, 'You received £180', 'Payment received from Smith J A. Tap for details', 0),
      a(REV, 'Transfer sent ✅', 'You sent £35 to Jane Ann Smith. It will arrive in seconds', 1 * m),
      a(BAR, 'Barclays', "Pers acct - You've been paid £35.00 to your account ending 1111. This credit may take up to 24 hours to show.", 2 * m),
      a(BAR, 'Barclays', 'Pers acct - You sent £180.00 from your account ending 1111.', 2 * m),
      a(REV, 'You received £50', 'Payment received from Smith J A. Tap for details', 3 * m),
      a(BAR, 'Barclays', 'Pers acct - You sent £50.00 from your account ending 1111.', 7 * m),
    ]);
    expect(out.map((p) => p.kind)).toEqual(['transfer', 'transfer', 'transfer', 'transfer', 'transfer', 'transfer']);
    expect(out[3].reason).toBe('Moved to your Revolut');
  });
  it('keeps a payment to someone else as spending', () => {
    const out = parseAll([a(REV, 'Transfer sent ✅', 'You sent £35 to Jane Ann Smith. It will arrive in seconds', 0)]);
    expect(out[0]).toMatchObject({ kind: 'spent', merchant: 'Jane Ann Smith', sent: true });
  });
  it('skips adverts, declined cards and account notices', () => {
    expect(parseAlert(a(REV, 'Get Make for less', 'Open a Pro account for free and save over £1,700 on digital freelancer tools. T&Cs apply')).reason).toBe('Advert');
    expect(parseAlert(a(REV, "Alex couldn't use their card ❌", "Your kid doesn't have enough balance to complete the transaction")).reason).toBe('Declined payment');
    expect(parseAlert(a(REV, 'New device log-in ➡️', 'Alex logged into a new device. If you suspect this isn\'t them, log them out.')).reason).toBe('Account notice');
    expect(parseAlert(a(REV, 'Verify a payment', 'You’re making an online card payment of £57 to Hollywood Bowl. Tap to verify')).kind).toBe('ignore');
  });
});

it('tidies shouty names', () => {
  expect(tidyName('GOOGLE PLAY APPS.')).toBe('Google Play Apps');
  expect(tidyName('McDonalds')).toBe('McDonalds');
  expect(tidyName('BP THE GREEN MAN')).toBe('BP The Green Man');
});
