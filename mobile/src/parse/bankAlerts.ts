// Turns a bank app's notification into something Kitty can log.
// Built from real UK alerts. Every rule here should have a test in bankAlerts.test.ts.

export type RawAlert = { key: string; pkg: string; title: string; text: string; time: number; app?: string };

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
  unsure?: boolean;     // has an amount, but Kitty can't tell what it is: ask the person
  cash?: boolean;       // a cash withdrawal
  warning?: string;     // something the person should know about (overdraft, low balance): shown as a heads-up
  emoji?: string;       // the bank's own category symbol (Revolut and Monzo start alerts with one)
};

// Apps Kitty never reads, even if someone turns them on: chats, email, texts and social apps carry private messages,
// and marketplaces, app stores and ride or delivery apps only repeat money that's counted when it reaches your bank.
// Kept in step with NEVER in CaptureStore.kt.
const NEVER_PKG = /whatsapp|telegram|thoughtcrime|signal|messag|\.mms|\bsms|mail|android\.gm$|outlook|snapchat|instagram|facebook|discord|slack|teams|viber|naver\.line|skype|twitter|linkedin|musically|tiktok|reddit|dynamite|airtasker|amazon|samsungapps|android\.vending|vinted|ebay|ubercab|deliveroo|justeat|depop|etsy/i;
export const neverRead = (pkg: string) => !(pkg in BANK_APPS) && NEVER_PKG.test(pkg);

export const BANK_APPS: Record<string, string> = {
  'com.revolut.revolut': 'Revolut',
  'com.barclays.android.barclaysmobilebanking': 'Barclays',
  'com.barclaycard.barclaycardmobile': 'Barclaycard',
  'co.uk.getmondo': 'Monzo',
  'com.starlingbank.android': 'Starling',
  'com.rbs.mobile.android.natwest': 'NatWest',
  'com.rbs.mobile.android.rbs': 'RBS',
  'com.rbs.mobile.android.ubr': 'Ulster Bank',
  'com.grppl.android.shell.CMBlloydsTSB73': 'Lloyds',
  'com.grppl.android.shell.halifax': 'Halifax',
  'com.grppl.android.shell.BOS': 'Bank of Scotland',
  'uk.co.hsbc.hsbcukmobilebanking': 'HSBC',
  'com.firstdirect.bankingonthego': 'first direct',
  'uk.co.santander.santanderUK': 'Santander',
  'co.uk.Nationwide.Mobile': 'Nationwide',
  'uk.co.tsb.newmobilebank': 'TSB',
  'com.chase.intl': 'Chase',
  'com.americanexpress.android.acctsvcs.uk': 'Amex',
  'com.virginmoney.uk.mobile.android': 'Virgin Money',
  'com.kroo.app': 'Kroo',
  'com.imaginecurve.curve.prd': 'Curve',
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
  // Card terminals often add a store number (TESCO STORES 2041)
  const t = clean(s).replace(PREFIX, '').replace(/[.,;:]+$/, '').replace(/\s+#?\d{3,}$/, '').trim();
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

// Things the bank is telling you about your money, not money moving. Worth a heads-up, never a payment.
const WARNINGS: [RegExp, string][] = [
  [/unarranged overdraft|overdraft limit (exceeded|reached)|over your (arranged )?overdraft|payments? (may|will|could) (bounce|be returned)/i, 'Overdraft'],
  [/balance is (below|under|low)|low balance|running low|top up now/i, 'Low balance'],
];
// The bank telling you about a charge it is taking: real money, so it can be added as a bank charge
const BANK_CHARGE = /\b(charge|fee|interest)\b[^.]*\b(overdraft|overdrawn)\b|\boverdraft\b[^.]*\b(charge|fee|interest)\b|\bmonthly (account )?fee\b/i;

// Words that mean money actually moved
const MONEY_MOVING = /\b(paid|pay|payment|received|sent|spent|charged?|debit(ed)?|credit(ed)?|refund(ed)?|transfer(red)?|payout|withdr\w*|deposit(ed)?|purchase|bought|top(ped)? ?up|direct debit|standing order|card|transaction|exchanged?|on hold|pending)\b/i;
// Platforms whose own alerts about money duplicate what later lands in your bank
const PLATFORM = /airtasker|vinted|ebay|depop|etsy|fiverr|upwork|checkatrade|mybuilder|bark|taskrabbit|uber|deliveroo|just ?eat|amazon/i;

const IGNORE: [RegExp, string][] = [
  [/\btask in\b|we found a task|new task|job (alert|offer|request)|quote request|new lead\b|requests? a quote/i, 'Job alert, not a payment'],
  [/budget update|of your [^.]*budget|\b(stayed|stay|are|you're|went|gone|still) (well )?(under|over|within) (your |the )?(\w+ ){0,3}budget|left to spare|spending report|monthly summary|weekly summary|your year in/i, 'Summary from your bank'],
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

/** The first amount in a piece of text, in pennies. */
export const amountIn = (s: string) => { const m = (s || '').match(AMOUNT); return m ? toPennies(m[1]) : undefined; };

const BANK_NAMES = [...new Set(Object.values(BANK_APPS))].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const GENERIC_TITLES = new RegExp(`^(${BANK_NAMES}|monzo bank|starling bank|payment|card payment|new notification|notification)$`, 'i');
/** A title that just names the bank, not a shop. */
export const isGenericTitle = (t: string) => GENERIC_TITLES.test(clean(t));

export function parseAlert(a: RawAlert): ParsedAlert {
  const bank = BANK_APPS[a.pkg] || a.app || a.pkg;
  const title = clean(a.title);
  const text = clean(a.text);
  const all = `${title} ${text}`;
  const lead = (a.text || '').match(/^\s*(\p{Extended_Pictographic})/u) || (a.title || '').match(/^\s*(\p{Extended_Pictographic})/u);
  const base: ParsedAlert = { key: a.key, time: a.time, bank, kind: 'ignore', emoji: lead ? lead[1] : undefined };

  // An app the person turned on that isn't a bank (a marketplace or job platform): its payouts reach the bank later
  if (!BANK_APPS[a.pkg] && PLATFORM.test(`${bank} ${a.pkg}`)) {
    return { ...base, reason: MONEY_MOVING.test(all) && AMOUNT.test(all) ? `Added when the money reaches your bank, so it isn't counted twice` : 'Not a payment' };
  }
  const charge = BANK_CHARGE.test(all) && (text.match(AMOUNT) || title.match(AMOUNT));
  if (charge) return { ...base, kind: 'spent', amount: toPennies(charge[1]), merchant: `${bank} charges`, reason: 'Bank charge' };
  for (const [rx, why] of WARNINGS) if (rx.test(all)) return { ...base, reason: `${why} warning`, warning: why };
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
  if (!am) return { ...base, reason: 'Not a payment' };
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
    let merchant: string | undefined = (text.match(/\b(?:at|with|to)\s+(.+?)(?:\s+(?:from|on|using|with)\s+(?:your|a|card)\b|\s+card ending\b|\s+balance\b|\.\s|\.$|$)/i) || [])[1];
    if (merchant && /your account|another account/i.test(merchant)) merchant = undefined;
    if (!merchant && !GENERIC_TITLES.test(title) && !AMOUNT.test(title)) merchant = title;
    const sent = /\byou sent\b|transfer sent/i.test(all);
    if (merchant && sent) merchant = merchant.replace(/\.\s.*$/, '');
    if (!merchant && sent) merchant = 'Payment sent';
    const cash = /withdr|cash ?machine|cashpoint|\batm\b/i.test(all) || /[\u{1F3E7}\u{1F4B5}]/u.test(a.text + a.title);
    if (!merchant && cash) merchant = 'Cash';
    return { ...out, kind: 'spent', cash: cash || undefined, sent: sent || undefined, merchant: merchant ? tidyName(merchant) : undefined, reason: merchant ? undefined : 'Shop not named in the alert' };
  }

  // Only ask about it if it talks about money moving; a price in an advert or a job post is not a payment
  if (!MONEY_MOVING.test(all)) return { ...out, reason: 'Not a payment' };
  return { ...out, unsure: true, reason: 'Kitty couldn\'t tell what this one is' };
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
