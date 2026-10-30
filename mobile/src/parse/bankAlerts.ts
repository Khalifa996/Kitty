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
  sent?: boolean;       // money you sent to someone (may be one of your own accounts)
  pairedWith?: string;  // key of the other half of a move between your own accounts
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

// Card terminal prefixes that hide the real shop name
const PREFIX = /^(sumup|sq|zettle|iz|ztl|paypal|pp|sp|stripe|crv|lsp)\s*\*\s*/i;
// Payment companies that pay out on behalf of a platform people know
const PAYERS: [RegExp, string][] = [
  [/mangopay/i, 'Vinted'],
  [/uber\s*\*?\s*eats/i, 'Uber Eats'],
  [/\bubr\b|uber\.com|^uber\s*\*/i, 'Uber'],
  [/airtasker/i, 'Airtasker'],
  [/mybuilder/i, 'MyBuilder'],
  [/checkatrade/i, 'Checkatrade'],
  [/hmrc/i, 'HMRC'],
  [/\bdwp\b|universal credit/i, 'DWP'],
];

/** "GOOGLE PLAY APPS" → "Google Play Apps". Leaves mixed case alone. */
export function tidyName(s: string): string {
  for (const [rx, name] of PAYERS) if (rx.test(s || '')) return name;
  const t = clean(s).replace(PREFIX, '').replace(/[.,;:]+$/, '').trim();
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
  [/declined|couldn'?t use (their|your) card|doesn'?t have enough balance/i, 'Declined payment'],
  [/new device|log-?in\b|logged in(to)?\b|added (their|your) card to/i, 'Account notice'],
  [/contactless limit|approaching (your|the)? ?limit/i, 'Card limit notice'],
  [/t&cs apply|terms apply|save over|open an? \w+ account|refer a friend|cashback offer|exclusive offer|virtual card number|shop more securely/i, 'Advert'],
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

  // Monzo puts the whole alert in the title: "£1 at Co-op", "£20 from Sam", "£495.50 Monzo Flex payment made"
  const tAt = title.match(new RegExp('^' + MONEY + '\\s+at\\s+(.+)$', 'i'));
  const tFrom = title.match(new RegExp('^' + MONEY + '\\s+from\\s+(.+)$', 'i'));
  if (tAt && !text.match(AMOUNT)) return { ...base, kind: 'spent', amount: toPennies(tAt[1]), merchant: tidyName(tAt[2]) };
  if (tFrom && !text.match(AMOUNT)) return { ...base, kind: 'received', amount: toPennies(tFrom[1]), merchant: tidyName(tFrom[2]) };

  const am = text.match(AMOUNT) || title.match(AMOUNT);
  if (!am) return { ...base, reason: 'No amount found' };
  const amount = toPennies(am[1]);
  const bal = text.match(BALANCE);
  const acct = (all.match(/ending\s+(\d{4})/i) || all.match(/(?:••|\*\*)\s?(\d{4})/) || [])[1];
  const out: ParsedAlert = { ...base, amount, balance: bal ? toPennies(bal[1]) : undefined, account: acct };

  // Direct Debits: match these to bills rather than logging a new spend
  if (/direct debit (was )?(paid|collected)|direct debit of/i.test(text)) return { ...out, kind: 'bill', reason: 'Direct Debit' };

  // Paying off credit: match it to the debt bill
  const repay = all.match(new RegExp(MONEY + '\\s+(.+?)\\s+(?:re)?payment\\s+(?:made|taken|received)', 'i'));
  if (repay || /made your (monthly )?(re)?payment|repayment (was )?(made|taken|collected)/i.test(all)) {
    return { ...out, kind: 'bill', merchant: repay ? tidyName(repay[2]) : undefined, reason: 'Repayment' };
  }

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
  if (sentYou || /\b(received|paid in|been paid|credited|money in|you've got|deposit(ed)?|incoming)\b/i.test(text) || /^you received\b/i.test(title)) {
    const who = sentYou ? sentYou[1] : fromName && !/your account/i.test(fromName) ? fromName : !GENERIC_TITLES.test(title) ? title : '';
    return { ...out, kind: 'received', merchant: tidyName(who || 'Money in') };
  }

  // Google Wallet: title is the shop, text is "£8.30 with Revolut Visa ••1234"
  if (bank === 'Google Wallet') {
    const card = (text.match(/with\s+(.+?)(?:\s*(?:••|\*\*)\s?\d{4})?$/i) || [])[1];
    return { ...out, kind: 'spent', merchant: tidyName(title), reason: card ? `Paid with ${clean(card)}` : undefined };
  }

  // Spending
  if (/\b(spent|paid|payment|purchase|card used|debited|you sent|withdrew|withdrawal)\b/i.test(text) || /^\s*-?£/.test(text)) {
    let merchant: string | undefined = (text.match(/\b(?:at|with|to)\s+(.+?)(?:\s+(?:from|on|using)\s+your\b|\s+balance\b|\.\s|\.$|$)/i) || [])[1];
    if (merchant && /your account|another account/i.test(merchant)) merchant = undefined;
    if (!merchant && !GENERIC_TITLES.test(title) && !AMOUNT.test(title)) merchant = title;
    const sent = /\byou sent\b|transfer sent/i.test(all);
    if (merchant && sent) merchant = merchant.replace(/\.\s.*$/, '');
    if (!merchant && sent) merchant = 'Payment sent';
    if (!merchant && /withdr/i.test(text)) merchant = 'Cash';
    return { ...out, kind: 'spent', sent: sent || undefined, merchant: merchant ? tidyName(merchant) : undefined, reason: merchant ? undefined : 'Shop not named in the alert' };
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

/**
 * Money sent from one of your banks that lands in another of your banks within a few minutes
 * is a move between your own accounts, not spending or income. Banks can be minutes apart.
 */
export function markTransfers(list: ParsedAlert[], windowMs = 15 * 60 * 1000): ParsedAlert[] {
  const out = list.map((p) => ({ ...p }));
  const used = new Set<string>();
  const sends = out.filter((p) => p.kind === 'spent' && p.sent).sort((a, b) => a.time - b.time);
  for (const s of sends) {
    const r = out
      .filter((q) => q.kind === 'received' && !q.refund && !used.has(q.key) && q.bank !== s.bank && q.amount === s.amount && Math.abs(q.time - s.time) <= windowMs)
      .sort((a, b) => Math.abs(a.time - s.time) - Math.abs(b.time - s.time))[0];
    if (!r) continue;
    used.add(r.key);
    s.kind = 'transfer'; s.pairedWith = r.key; s.reason = `Moved to your ${r.bank}`;
    r.kind = 'transfer'; r.pairedWith = s.key; r.reason = `Moved from your ${s.bank}`;
  }
  return out;
}

export const parseAll = (raw: RawAlert[]) => markTransfers(markDuplicates(raw.map(parseAlert)));
