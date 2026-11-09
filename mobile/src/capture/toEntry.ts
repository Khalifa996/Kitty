// Turns a parsed bank alert into a Crest entry, using what the person has logged before.
import { billDue, billWindowAt, cycleOf, planDays, pot } from '../engine/budget';
import { diffDays, hm, ymd } from '../engine/dates';
import type { State, Tx } from '../engine/types';
import { cardBankOf, type ParsedAlert } from '../parse/bankAlerts';

const norm = (s: string) => (s || '').toLowerCase().replace(/\b(bill|payment|repayment|ltd|limited|stores?|plc)\b/g, '').replace(/[^a-z0-9]/g, '');

/** The category last used for this shop, or a match on the first word ("Tesco Stores" → "Tesco"). */
export function guessCategory(S: State, merchant?: string): string | null {
  if (!merchant) return null;
  const m = norm(merchant), first = norm(merchant.split(/\s+/)[0] || '');
  let best: string | null = null;
  for (const t of S.tx) {
    if (t.kind !== 'out' || t.billId || t.checkin || t.catGuess || !t.merchant) continue;
    const n = norm(t.merchant);
    if (n === m || (first.length >= 4 && n.startsWith(first)) || (n.length >= 4 && m.startsWith(n)) || (m.length >= 4 && n.startsWith(m))) best = t.cat;
  }
  return best;
}

// Common UK shops, for people who haven't logged them before. History always wins over this list.
const KNOWN: [RegExp, string][] = [
  [/\b(vapes?|vaping|tobacco|tobacconist)\b/i, 'personal'],
  [/\b(tesco|sainsbury|asda|aldi|lidl|co-?op|morrisons|waitrose|iceland|ocado|m&s food|marks.*spencer.*food|farmfoods|budgens|spar|londis|nisa|one stop|costcutter|food (and|&) wine|off ?licen[cs]e|mini ?market|convenience store|news ?agents?)\b/i, 'groceries'],
  [/\b(pret|greggs|costa|starbucks|caff?e|cafe|coffee|nando|mcdonald|kfc|burger king|subway|wagamama|pizza|deliveroo|just ?eat|uber ?eats|domino|leon|itsu|wasabi|restaurant|grill|kitchen)\b/i, 'food'],
  [/\b(tfl|transport for london|trainline|national rail|lner|avanti|gwr|uber|bolt|addison lee|voi|lime|santander cycles|shell|bp|esso|texaco|jet|petrol|fuel|service station|parking|ringgo|paybyphone|dart charge|congestion|ulez)\b/i, 'transport'],
  [/\b(amazon|argos|ebay|asos|primark|next|zara|h&m|uniqlo|currys|john lewis|tk ?maxx|sports direct|jd sports|shein|temu|aliexpress|apple\.com|google play)\b/i, 'shopping'],
  [/\b(boots|superdrug|pharmacy|chemist|dentist|optician|specsavers|vision express|holland.*barrett|nhs)\b/i, 'health'],
  [/\b(odeon|vue|cineworld|picturehouse|cinema|hollywood bowl|bowl|ticketmaster|see tickets|pub|bar|wetherspoon|spotify|netflix|disney|steam|playstation|xbox)\b/i, 'fun'],
  [/\b(screwfix|toolstation|b&q|wickes|homebase|ikea|dunelm|the range|wilko|robert dyas|b&m|home bargains)\b/i, 'home'],
];
export const knownCategory = (merchant?: string) => (merchant ? KNOWN.find(([rx]) => rx.test(merchant))?.[1] ?? null : null);

// The bank's own category, from the symbol Revolut and Monzo put at the start of an alert. Set by the shop's card terminal code.
const EMOJI: Record<string, string> = {
  '🍽': 'food', '🍔': 'food', '☕': 'food', '🍕': 'food', '🥡': 'food',
  '🛒': 'groceries', '🍏': 'groceries', '🥦': 'groceries', '🍎': 'groceries',
  '🚌': 'transport', '🚗': 'transport', '🚕': 'transport', '🚆': 'transport', '⛽': 'transport', '🌍': 'transport', '🅿': 'transport',
  '🛍': 'shopping', '👕': 'shopping', '👗': 'shopping', '📦': 'shopping',
  '🍿': 'fun', '🎬': 'fun', '🎟': 'fun', '🎮': 'fun', '🍺': 'fun', '🍻': 'fun', '🎉': 'fun',
  '💊': 'health', '🏥': 'health', '💪': 'health',
  '🏠': 'home', '🔨': 'home', '🛠': 'home',
  '💇': 'personal', '💅': 'personal',
};
export const emojiCategory = (e?: string) => (e ? EMOJI[e.replace(/\uFE0F/g, '')] ?? null : null);

// Words that say what kind of place it is, for shops nobody has listed. Checked in order, so the specific ones come first.
const WORDS: [RegExp, string][] = [
  [/\b(supermarkets?|grocer(y|s|ies)?|bazaa?r|cash (and|&) carry|wholesale|halal|butchers?|fishmonger|food ?(store|centre|center|hall)|superstore)\b/i, 'groceries'],
  [/\b(caf[eé]s?|coffee|bakery|bakers|bagels?|takeaway|kebabs?|chicken|chippy|fish (and|&) chips|sushi|noodles?|curry|diner|bistro|brasserie|eatery|deli|canteen|pizz\w*|burgers?|grill|kitchen|restaurant)\b/i, 'food'],
  [/\b(pubs?|bar|tavern|inn|club|cinema|theatre|bowl(ing)?|golf|arena|stadium|escape room)\b/i, 'fun'],
  [/\b(taxis?|cabs?|car ?park|parking|petrol|fuel|filling station|rail(ways?)?|trains?|buses|coach(es)?|airport|car wash)\b/i, 'transport'],
  [/\b(pharmacy|chemists?|dental|dentists?|clinic|opticians?|gym|fitness|leisure centre)\b/i, 'health'],
  [/\b(barbers?|salon|hair|beauty|nails|spa|laundrette|launderette|dry clean\w*)\b/i, 'personal'],
  [/\b(hardware|diy|furniture|garden centre|timber|builders merchants?|plumbing|electricals?)\b/i, 'home'],
  [/\b(fashion|clothing|shoes|boutique|outlet|jewell?ers?)\b/i, 'shopping'],
];
export const wordCategory = (merchant?: string) => (merchant ? WORDS.find(([rx]) => rx.test(merchant))?.[1] ?? null : null);

/** What this payer was logged as last time (money in). */
// Names Crest fills in when the alert doesn't say who: never learn a category from these
const PLACEHOLDER = /^(money in|payment sent|refund|cash|shop not named)$/i;
function guessIncome(S: State, merchant?: string): string | null {
  if (!merchant || PLACEHOLDER.test(merchant.trim())) return null;
  const m = norm(merchant); let best: string | null = null;
  for (const t of S.tx) if (t.kind === 'in' && t.merchant && norm(t.merchant) === m) best = t.cat;
  return best;
}
// Platforms that pay for work, card readers that pay out takings, and ones that pay out when you sell your own things
const WORK = /^(airtasker|mybuilder|checkatrade|bark|taskrabbit|rated ?people|fiverr|upwork)$/i;
const TAKINGS = /^(stripe|sumup|square|zettle|izettle|paypal payouts?|tide)\b/i;
const SELLING = /^(vinted|ebay|depop|facebook marketplace|gumtree)$/i;

// Words that say nothing about who a bill is with
const FILLER = new Set(['bill', 'bills', 'payment', 'payments', 'repayment', 'direct', 'debit', 'limited', 'card', 'account', 'monthly', 'premium', 'services', 'online', 'google', 'apple', 'paypal', 'with', 'from', 'the', 'charges', 'charge', 'monzo', 'barclays', 'revolut', 'starling', 'natwest', 'lloyds', 'halifax', 'hsbc', 'santander', 'nationwide', 'bank']);
const words = (s: string) => new Set((s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !FILLER.has(w)));
/** "Google Youtube" and "YouTube Premium", "Monzo Flex" and "Monzo Flex Bill". */
export function sameName(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = norm(a), y = norm(b);
  if (x.length >= 3 && x === y) return true;
  const wa = words(a);
  return [...words(b)].some((w) => w.length >= 4 && wa.has(w));
}

/** Card payments that top up another of your own accounts or apps (Barclays card → "Revolut**1234*"). */
const OWN_TOPUP = /^(revolut|monzo|starling|wise|plum|chip|moneybox|kroo|chase|curve|top ?-?up)(\s*(ltd|limited|bank|uk|top ?-?up)|\*.*|\s*\d.*)*$/i;
export const isTopUp = (name?: string) => !!name && OWN_TOPUP.test(name.trim());

/** An account the person said is their business one (asked once in Review, kept in settings). */
export const isBizAccount = (S: State, name?: string) => !!name && (S.settings.bizAccounts || []).some((n) => n.toLowerCase() === name.toLowerCase());

export type Suggestion =
  | { action: 'add'; tx: Tx; guessed: boolean; hint?: string; cash?: boolean; ai?: boolean; newBill?: boolean; big?: boolean }
  | { action: 'pay-bill'; billId: string; billName: string; tx: Tx; replaces?: Tx }
  | { action: 'ask'; reason: string }
  | { action: 'skip'; reason: string };

/** The entry id for an alert, so the same alert can never be added twice. */
export const alertTxId = (p: ParsedAlert) => `a-${p.key.replace(/[^a-z0-9]/gi, '').slice(-16)}`;

/** Minutes to wait before adding an alert by itself, so its other half (a transfer, Google Wallet's copy) can arrive. */
export const settleMinutes = (p: ParsedAlert) => (p.bank === 'Google Wallet' ? 65 : 20);

/**
 * Payments Crest is sure enough about to add without asking: money has clearly moved and there's nothing to decide.
 * Spending goes in even when the category is a guess (the money has gone either way). Money in only when Crest knows
 * what it is, since a guess there could add money that isn't really yours to spend. Anything that looks logged already,
 * cash, a new Direct Debit, or a change to a bill's amount waits for the person.
 */
export function isSure(p: ParsedAlert, sug: Suggestion, dup?: Tx | null): boolean {
  if (dup || p.duplicateOf || p.unsure || p.warning) return false;
  if (sug.action === 'pay-bill') return !sug.replaces;
  if (sug.action !== 'add' || sug.cash || sug.newBill || sug.big) return false;
  if (sug.tx.kind === 'in') return !sug.guessed && sug.tx.cat !== 'transfer' && sug.tx.cat !== 'borrowed';
  return true;
}

export function suggest(S: State, p: ParsedAlert, id: string, others: ParsedAlert[] = []): Suggestion {
  if (p.unsure && p.amount) {
    // Learn from what the person did before: skipped two from this bank and never kept one, so stop asking
    const L = S.settings.learned || {};
    if ((L.skip?.[p.bank] || 0) >= 2 && !L.keep?.[p.bank]) return { action: 'skip', reason: `You skipped alerts like this from ${p.bank} before` };
    return { action: 'ask', reason: p.reason || 'Crest couldn\'t tell what this one is' };
  }
  if (p.kind === 'ignore') return { action: 'skip', reason: p.reason || 'Not a payment' };
  // Google Wallet for a card whose bank sends its own alerts: the bank's alert is the payment, and an extra one from
  // Google Wallet with no bank twin is usually a hold (scooter and taxi apps take one before the real fare)
  if (p.bank === 'Google Wallet' && (p.kind === 'spent' || p.kind === 'received')) {
    const bank = cardBankOf(p), since = ymd(new Date(p.time - 30 * 864e5));
    if (bank && (others.some((q) => q.bank === bank) || S.tx.some((t) => t.bank === bank && t.date >= since)))
      return { action: 'skip', reason: p.kind === 'spent' ? `${bank} sends its own alert for this card. This one is usually a hold, not a charge`
        : `${bank} sends its own alert for this card, so this would count it twice` };
  }

  // Money moved from your business to your own account is paying yourself: it counts as money to spend
  const fromBiz = (p.kind === 'transfer' && !p.sent) || p.kind === 'received' ? guessIncome(S, p.merchant) === 'draw' : false;
  if (p.kind === 'transfer' && !fromBiz) return { action: 'skip', reason: p.reason || 'Moved between your accounts' };
  if (!p.amount) return { action: 'skip', reason: 'No amount' };
  // TfL adds up a day's travel and charges it overnight, so an early-morning charge belongs to the day before
  const d = new Date(p.time), lateTravel = p.kind === 'spent' && /transport for london|\btfl\b/i.test(p.merchant || '') && d.getHours() < 7;
  const date = ymd(lateTravel ? new Date(p.time - 864e5) : d), time = hm(d);
  const bizAcct = isBizAccount(S, p.accountName);
  const base = { id, amt: p.amount, merchant: p.merchant || '', note: lateTravel ? 'Charged the next morning' : '', date, time, biz: bizAcct, billId: null, source: 'alert', bank: p.bank,
    ...(p.accountName ? { accountName: p.accountName } : {}) } as const;

  // A card payment the bank or shop undid. If the payment was counted, take it back off; if not, neither counts
  // Same amount, and the same shop or the same bank (banks often name the shop differently on the undo)
  const undoes = (q: { amount?: number; merchant?: string; bank?: string }) => q.amount === p.amount && (!p.merchant || !q.merchant || q.bank === p.bank || sameName(q.merchant, p.merchant));
  if (p.reverted) {
    const since = ymd(new Date(p.time - 4 * 864e5));
    const counted = S.tx.filter((t) => t.kind === 'out' && !t.billId && t.date >= since && t.date <= date && undoes({ amount: t.amt, merchant: t.merchant, bank: t.bank }))
      .sort((a, b) => Number(sameName(b.merchant, p.merchant)) - Number(sameName(a.merchant, p.merchant)) || Number(b.bank === p.bank) - Number(a.bank === p.bank))[0];
    if (counted) {
      if (S.tx.some((t) => t.kind === 'in' && t.cat === 'refund' && t.amt === p.amount && t.date >= counted.date && sameName(t.merchant, counted.merchant)))
        return { action: 'skip', reason: 'Already taken off' };
      return { action: 'add', guessed: false, hint: `${p.bank} undid this payment, so it comes off your spending`,
        tx: { ...base, kind: 'in', cat: 'refund', sub: null, merchant: counted.merchant || p.merchant || 'Refund', note: 'Payment undone', refundCat: counted.cat, biz: !!counted.biz } };
    }
    const waiting = others.some((q) => q.key !== p.key && q.kind === 'spent' && q.bank === p.bank && q.time <= p.time && p.time - q.time <= 4 * 864e5 && undoes(q));
    return { action: 'skip', reason: waiting ? 'Undoes a payment that wasn\'t added, so both stay out' : 'Undoes a payment Crest never counted' };
  }
  // ...and the payment itself, when the undo is already here
  if (p.kind === 'spent' && others.some((q) => q.reverted && q.bank === p.bank && q.amount === p.amount && q.time >= p.time && q.time - p.time <= 4 * 864e5)) {
    return { action: 'skip', reason: `${p.bank} undid this payment` };
  }

  // Money from another of your own accounts (one Crest has seen alerts from by name) is a move, not money in
  if (p.kind === 'received' && p.merchant && S.tx.some((t) => t.accountName && sameName(t.accountName, p.merchant as string))) {
    return { action: 'skip', reason: `Moved from your ${p.merchant}` };
  }
  if (fromBiz) return { action: 'add', guessed: false, hint: 'From your business: paying yourself adds to your daily budget', tx: { ...base, kind: 'in', cat: 'draw', sub: null } };

  // Topping up another of your own accounts by card is a move, not spending: what you buy from there is counted there.
  // Unless it's a bill of the same name and amount (a savings app you pay into monthly)
  if (p.kind === 'spent' && isTopUp(p.merchant)) {
    const app = (p.merchant as string).split(/[\s*\d]/)[0];
    if (!S.bills.some((b) => b.amt === p.amount && b.name.toLowerCase().startsWith(app.toLowerCase())))
      return { action: 'skip', reason: `Topped up your ${app}: a move between your own accounts` };
  }

  if (p.kind === 'bill' || p.kind === 'spent') {
    const win = billWindowAt(date, S.settings);
    const paidTx = (b: { id: string }) => S.tx.find((t) => t.billId === b.id && t.date >= win.start && t.date <= win.end);
    const named = (b: { name: string }) => sameName(b.name, p.merchant);
    const asBill = (b: (typeof S.bills)[number], replaces?: Tx): Suggestion =>
      ({ action: 'pay-bill', billId: b.id, billName: b.name, replaces, tx: { ...base, kind: 'out', cat: 'bills', sub: b.sub || b.name, merchant: b.name, billId: b.id, biz: !!b.biz || bizAcct } });

    // Not paid yet: a matching amount (Direct Debits, or a card payment for a bill like rent), or the same name for repayments
    // that differ from the usual amount (Monzo Flex £495.50 against a £500 bill)
    const open = S.bills.filter((b) => !paidTx(b));
    const byAmt = open.filter((b) => b.amt === p.amount).sort((x, y) => Math.abs(billDue(x, win).localeCompare(date)) - Math.abs(billDue(y, win).localeCompare(date)));
    const b = byAmt.find(named) || (p.kind === 'bill' ? byAmt[0] || open.find(named) : byAmt[0]);
    if (b) return asBill(b);

    // Already ticked off. If Crest ticked it off itself (Direct Debit day), the bank's figure is the real one
    const done = S.bills.find((x) => paidTx(x) && named(x)) || (p.kind === 'bill' ? S.bills.find((x) => paidTx(x) && x.amt === p.amount) : undefined);
    if (done) {
      const t = paidTx(done) as Tx;
      if (p.kind === 'bill' && t.auto && t.amt !== p.amount) return asBill(done, t);
      if (t.amt === p.amount || p.kind === 'bill') return { action: 'skip', reason: `${done.name} is already ticked off as paid` };
    }

    // The bank didn't say who it's paid to (Barclays never does for Direct Debits): a Direct Debit bill due in the last few days
    // with a close amount. Due dates on a weekend or bank holiday are collected the next working day, and amounts drift
    if (p.kind === 'bill' && !p.merchant) {
      // Never before the due date, and not a bill another alert already matches exactly
      const exact = (x: { amt: number }) => others.some((q) => q.key !== p.key && q.kind === 'bill' && q.amount === x.amt && Math.abs(q.time - p.time) <= 5 * 864e5);
      const near = S.bills
        .filter((x) => { const gap = diffDays(billDue(x, win), date); return x.dd && gap >= 0 && gap <= 5 && !exact(x) && Math.abs(x.amt - (p.amount as number)) <= Math.max(50, x.amt * 0.05); })
        .sort((x, y) => Math.abs(x.amt - (p.amount as number)) - Math.abs(y.amt - (p.amount as number)))[0];
      if (near) {
        const t = paidTx(near);
        if (!t) return asBill(near);
        if (t.amt === near.amt && t.amt !== p.amount) return asBill(near, t);
      }
    }

    if (p.kind === 'bill') {
      return { action: 'add', guessed: true, newBill: true,
        hint: p.reason === 'Repayment' ? `Repayment to ${p.merchant || 'a lender'} that matches none of your bills`
          : p.merchant ? 'Direct Debit that matches none of your bills' : `${p.bank} didn't say who this Direct Debit is paid to`,
        tx: { ...base, kind: 'out', cat: 'bills', sub: null } };
    }
  }

  if (p.kind === 'received') {
    // Money into your business account is side income, whoever it's from
    if (bizAcct && !p.refund) return { action: 'add', guessed: false, hint: `Into your ${p.accountName} account: side income`, tx: { ...base, kind: 'in', cat: 'side', sub: null, biz: true } };
    const seen = guessIncome(S, p.merchant), m = p.merchant || '';
    const work = WORK.test(m), takings = TAKINGS.test(m), sold = SELLING.test(m);
    const biz = S.settings.sideIncome && (work || takings);
    const cat = p.refund ? 'refund'
      : seen ? seen
      : biz ? 'side'
      : work || sold ? 'extra'
      : S.settings.income && Math.abs(p.amount - S.settings.income) <= S.settings.income * 0.2 ? 'salary' : 'extra';
    return { action: 'add', guessed: !seen && !work && !sold && (cat === 'extra' || takings), tx: { ...base, kind: 'in', cat, sub: work ? 'Job' : sold ? 'Sold something' : null, biz: cat === 'side' } };
  }

  if (p.reason === 'Bank charge') {
    return { action: 'add', guessed: false, hint: 'Your bank says it is taking this charge. Add it so your budget allows for it',
      tx: { ...base, kind: 'out', cat: 'bills', sub: 'Bank charge' } };
  }
  if (p.cash) {
    return { action: 'add', guessed: true, hint: 'Cash withdrawal. If it\'s already gone (paid someone, given away), add it. If you\'ll spend it bit by bit, tap Cash to spend and log what you buy on the keypad',
      tx: { ...base, kind: 'out', cat: 'other', sub: 'Cash', merchant: p.merchant && p.merchant !== 'Cash' ? `Cash (${p.merchant})` : 'Cash' }, cash: true };
  }
  // Your own history first, then shops Crest knows, then the bank's category, then words in the name
  const mine = guessCategory(S, p.merchant), known = knownCategory(p.merchant);
  const cat = mine || known || emojiCategory(p.emoji) || wordCategory(p.merchant);
  const big = isBigOneOff(S, p.amount, p.merchant, date);
  return { action: 'add', guessed: !mine && !known, big: big || undefined,
    hint: big ? 'Bigger than your usual spending here. If it came from savings or money you put aside, it can stay out of this month' : undefined,
    tx: { ...base, kind: 'out', cat: cat || 'other', sub: null } };
}

/**
 * A spend big enough to matter (three days' worth of budget, and at least £75) that isn't usual for this name.
 * Crest can't know whether it came from this month's money or from savings, so it asks instead of guessing.
 */
export function isBigOneOff(S: State, amt: number, name: string | undefined, date: string): boolean {
  const c = cycleOf(date, S.settings), days = Math.max(1, planDays(S, c));
  const daily = Math.max(0, pot(S, c)) / days;
  if (amt < Math.max(7500, daily * 3)) return false;
  const since = ymd(new Date(new Date(date + 'T12:00:00').getTime() - 120 * 864e5));
  return !S.tx.some((t) => t.kind === 'out' && t.date >= since && t.amt >= amt * 0.6 && !!name && sameName(t.merchant, name));
}

/** Something close to this amount was already logged by hand around the same day (a round £230 for £231.40, say). */
export function alreadyLogged(S: State, p: ParsedAlert): Tx | undefined {
  if (!p.amount || (p.kind !== 'spent' && p.kind !== 'received')) return undefined;
  const kind = p.kind === 'spent' ? 'out' : 'in', day = ymd(new Date(p.time)), amt = p.amount;
  const near = (d: string) => Math.abs(new Date(d + 'T12:00:00').getTime() - new Date(day + 'T12:00:00').getTime()) <= 864e5;
  const close = (a: number) => Math.abs(a - amt) <= Math.max(100, Math.round(amt * 0.02));
  const hand = S.tx.filter((t) => t.kind === kind && !t.billId && t.source !== 'alert' && !t.checkin && near(t.date) && close(t.amt));
  const exact = hand.find((t) => t.amt === amt);
  if (exact) return exact;
  // A near amount only counts if nothing says it's a different place (Boots £12.56 is not Caffe Darte £12.45)
  const cat = kind === 'out' ? guessCategory(S, p.merchant) || knownCategory(p.merchant) : null;
  const fits = (t: Tx) => !p.merchant || !t.merchant || sameName(t.merchant, p.merchant) || (!!cat && cat === t.cat);
  return hand.filter(fits).sort((a, b) => Math.abs(a.amt - amt) - Math.abs(b.amt - amt))[0];
}
