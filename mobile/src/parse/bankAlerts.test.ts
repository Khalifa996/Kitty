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
  it('reads rent paid to a company', () => {
    expect(parseAlert(a(BAR, 'Barclays', "Pers acct - You've spent £1500.00 with ACME LETTINGS LIMITED from your account ending 2222."))).toMatchObject({ kind: 'spent', amount: 150000, merchant: 'Acme Lettings Limited', account: '2222' });
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
  it('Monzo style', () => {
    expect(parseAlert(a('co.uk.getmondo', 'Pret A Manger', '£4.50'))).toMatchObject({ kind: 'spent', amount: 450, merchant: 'Pret A Manger' });
  });
  it('Starling style', () => {
    expect(parseAlert(a('com.starlingbank.android', 'Starling Bank', 'You spent £12.40 at Sainsburys'))).toMatchObject({ kind: 'spent', amount: 1240, merchant: 'Sainsburys' });
  });
  it('NatWest style refund', () => {
    expect(parseAlert(a('com.rbs.mobile.android.natwest', 'NatWest', 'Refund of £20.00 from AMAZON'))).toMatchObject({ kind: 'received', refund: true, amount: 2000, merchant: 'Amazon' });
  });
  it('handles thousands separators', () => {
    expect(parseAlert(a(BAR, 'Barclays', "You've spent £1,500.00 with ACME LETTINGS from your account ending 2222.")).amount).toBe(150000);
  });
});

it('tidies shouty names', () => {
  expect(tidyName('GOOGLE PLAY APPS.')).toBe('Google Play Apps');
  expect(tidyName('McDonalds')).toBe('McDonalds');
});
