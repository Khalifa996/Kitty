// Turns a bank app's notification into something Kitty can log.
// Built from real UK alerts. Every rule here should have a test in bankAlerts.test.ts.

export type RawAlert = { key: string; pkg: string; title: string; text: string; time: number };

export type AlertKind = 'spent' | 'received' | 'transfer' | 'bill' | 'ignore';

export type ParsedAlert = {
  key: string;
  time: number;
  bank: string;
  kind: AlertKind;
  amount?: number;      // pennies
  merchant?: string;
  balance?: number;     // pennies, when the alert shows it
  account?: string;     // last four digits
  refund?: boolean;
  reason?: string;      // why it was ignored, or a note for the person
  duplicateOf?: string; // key of the alert this one repeats
};

export const BANK_APPS: Record<string, string> = {
  'com.revolut.revolut': 'Revolut',
  'com.barclays.android.barclaysmobilebanking': 'Barclays',
  'com.barclaycard.barclaycardmobile': 'Barclaycard',
  'co.uk.getmondo': 'Monzo',
  'com.starlingbank.android': 'Starling',
  'com.rbs.mobile.android.natwest': 'NatWest',
  'com.google.android.apps.walletnfcrel': 'Google Wallet',
};

const MONEY = '(?:£|GBP\\s?)\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
const AMOUNT = new RegExp(MONEY, 'i');
const BALANCE = new RegExp('balance:?\\s*' + MONEY, 'i');

export const toPennies = (s: string) => Math.round(parseFloat(s.replace(/,/g, '')) * 100);

/** Strip emoji, card symbols and extra spaces. */
export function clean(s: string): string {
  return (s || '')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "GOOGLE PLAY APPS" → "Google Play Apps". Leaves mixed case alone. */
export function tidyName(s: string): string {
  const t = clean(s).replace(/[.,;:]+$/, '').trim();
  if (!t) return t;
  if (t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) {
    // Title case, but keep likely initials as they are: a short first word (ABC, BP) or a two-letter word (UK)
    const small = /^(THE|AND|FOR|LTD|PLC|CO|OF|TO|IN|AT|ON|BY|MY|AN|OR)$/;
    return t.split(' ').map((w, i) => {
      const keep = !small.test(w) && ((i === 0 && /^[A-Z]{2,3}$/.test(w)) || /^[A-Z]{2}$/.test(w));
      return keep ? w : w.charAt(0) + w.slice(1).toLowerCase();
    }).join(' ');
  }
  return t;
}

const IGNORE: [RegExp, string][] = [
  [/\bverify\b|tap to verify|approve (this|the) payment/i, 'Payment check, not a payment'],
  [/authori[sz]ed for future payments/i, 'Card saved with a shop, not a payment'],
  [/one[- ]time (pass)?code|\bOTP\b|security code|passcode/i, 'Security code'],
  [/you have a new notification from/i, 'General notice'],
  [/standing order/i, 'Standing order set up or cancelled'],
  [/overdrawn|interest charges/i, 'Account warning'],
  [/statement is (ready|available)/i, 'Statement notice'],
  [/\b(log(ged)? ?in|sign(ed)? in)\b/i, 'Sign-in notice'],
  [/declined/i, 'Declined payment'],
];

const GENERIC_TITLES = /^(revolut|barclays|barclaycard|monzo|starling( bank)?|natwest|payment|card payment|new notification|google wallet)$/i;

export function parseAlert(a: RawAlert): ParsedAlert {
  const bank = BANK_APPS[a.pkg] || a.pkg;
  const title = clean(a.title);
  const text = clean(a.text);
  const all = `${title} ${text}`;
  const base: ParsedAlert = { key: a.key, time: a.time, bank, kind: 'ignore' };

  for (const [rx, why] of IGNORE) if (rx.test(all)) return { ...base, reason: why };

  // Revolut shows a family member's card as "<Name> 💳" with "Spent £x at Shop"
  if (/💳/.test(a.title) && /\bspent\b/i.test(text)) {
    return { ...base, reason: `${title}'s card, not yours`, merchant: tidyName((text.match(/\bat\s+(.+?)(?:\s+balance|$)/i) || [])[1] || '') };
  }

  const am = text.match(AMOUNT) || title.match(AMOUNT);
  if (!am) return { ...base, reason: 'No amount found' };
  const amount = toPennies(am[1]);
  const bal = text.match(BALANCE);
  const acct = (all.match(/ending\s+(\d{4})/i) || all.match(/(?:••|\*\*)\s?(\d{4})/) || [])[1];
  const out: ParsedAlert = { ...base, amount, balance: bal ? toPennies(bal[1]) : undefined, account: acct };

  // Direct Debits: match these to bills rather than logging a new spend
  if (/direct debit (was )?(paid|collected)|direct debit of/i.test(text)) return { ...out, kind: 'bill', reason: 'Direct Debit' };

  // Moving money between your own accounts
  if (/transferred .* to another account|to your (own|other) account|between your accounts|to (your )?savings/i.test(text)) {
    return { ...out, kind: 'transfer', reason: 'Moved between your accounts' };
  }

  // Money in
  const fromName = (text.match(/\bfrom\s+(.+?)(?:\s+(?:to|into)\s+your|\.\s|\.$|\s+balance|$)/i) || [])[1];
  const sentYou = text.match(/^(.+?)\s+(?:sent|paid) you\b/i);
  if (/\brefund/i.test(all)) {
    return { ...out, kind: 'received', refund: true, merchant: tidyName(fromName || (!GENERIC_TITLES.test(title) ? title : '') || 'Refund') };
  }
  if (sentYou || /\b(received|paid in|credited|money in|you've got|deposit(ed)?|incoming)\b/i.test(text)) {
    const who = sentYou ? sentYou[1] : fromName && !/your account/i.test(fromName) ? fromName : !GENERIC_TITLES.test(title) ? title : '';
    return { ...out, kind: 'received', merchant: tidyName(who || 'Money in') };
  }

  // Google Wallet: title is the shop, text is "£8.30 with Revolut Visa ••3333"
  if (bank === 'Google Wallet') {
    const card = (text.match(/with\s+(.+?)(?:\s*(?:••|\*\*)\s?\d{4})?$/i) || [])[1];
    return { ...out, kind: 'spent', merchant: tidyName(title), reason: card ? `Paid with ${clean(card)}` : undefined };
  }

  // Spending
  if (/\b(spent|paid|payment|purchase|card used|debited|you sent|withdrew|withdrawal)\b/i.test(text) || /^\s*-?£/.test(text)) {
    let merchant: string | undefined = (text.match(/\b(?:at|with|to)\s+(.+?)(?:\s+(?:from|on|using)\s+your\b|\s+balance\b|\.\s|\.$|$)/i) || [])[1];
    if (merchant && /your account|another account/i.test(merchant)) merchant = undefined;
    if (!merchant && !GENERIC_TITLES.test(title) && !AMOUNT.test(title)) merchant = title;
    if (!merchant && /you sent/i.test(text)) merchant = 'Payment sent';
    if (!merchant && /withdr/i.test(text)) merchant = 'Cash';
    return { ...out, kind: 'spent', merchant: merchant ? tidyName(merchant) : undefined, reason: merchant ? undefined : 'Shop not named in the alert' };
  }

  return { ...out, reason: 'Not sure what this one is' };
}

/**
 * The same card payment often arrives twice (the bank and Google Wallet).
 * Keep the bank's alert and mark the Wallet one as a duplicate.
 */
export function markDuplicates(list: ParsedAlert[], windowMs = 10 * 60 * 1000): ParsedAlert[] {
  const spent = list.filter((p) => p.kind === 'spent');
  return list.map((p) => {
    if (p.kind !== 'spent' || p.bank !== 'Google Wallet') return p;
    const twin = spent.find((q) => q !== p && q.bank !== 'Google Wallet' && q.amount === p.amount && Math.abs(q.time - p.time) <= windowMs);
    return twin ? { ...p, kind: 'ignore', duplicateOf: twin.key, reason: `Same payment as ${twin.bank}` } : p;
  });
}

export const parseAll = (raw: RawAlert[]) => markDuplicates(raw.map(parseAlert));
