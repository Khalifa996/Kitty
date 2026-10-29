// Turns a parsed bank alert into a Kitty entry, using what the person has logged before.
import { billDue, billWindowAt } from '../engine/budget';
import { hm, ymd } from '../engine/dates';
import type { State, Tx } from '../engine/types';
import type { ParsedAlert } from '../parse/bankAlerts';

const norm = (s: string) => (s || '').toLowerCase().replace(/\b(bill|payment|repayment|ltd|limited|stores?|plc)\b/g, '').replace(/[^a-z0-9]/g, '');

/** The category last used for this shop, or a match on the first word ("Tesco Stores" → "Tesco"). */
export function guessCategory(S: State, merchant?: string): string | null {
  if (!merchant) return null;
  const m = norm(merchant), first = norm(merchant.split(/\s+/)[0] || '');
  let best: string | null = null;
  for (const t of S.tx) {
    if (t.kind !== 'out' || t.billId || t.checkin || !t.merchant) continue;
    const n = norm(t.merchant);
    if (n === m || (first.length >= 4 && n.startsWith(first)) || (n.length >= 4 && m.startsWith(n)) || (m.length >= 4 && n.startsWith(m))) best = t.cat;
  }
  return best;
}

// Common UK shops, for people who haven't logged them before. History always wins over this list.
const KNOWN: [RegExp, string][] = [
  [/\b(tesco|sainsbury|asda|aldi|lidl|co-?op|morrisons|waitrose|iceland|ocado|m&s food|marks.*spencer.*food|farmfoods|budgens|spar|londis|nisa|one stop|costcutter)\b/i, 'groceries'],
  [/\b(pret|greggs|costa|starbucks|caff?e|cafe|coffee|nando|mcdonald|kfc|burger king|subway|wagamama|pizza|deliveroo|just ?eat|uber ?eats|domino|leon|itsu|wasabi|restaurant|grill|kitchen)\b/i, 'food'],
  [/\b(tfl|transport for london|trainline|national rail|lner|avanti|gwr|uber|bolt|addison lee|voi|lime|santander cycles|shell|bp|esso|texaco|jet|petrol|fuel|service station|parking|ringgo|paybyphone|dart charge|congestion|ulez)\b/i, 'transport'],
  [/\b(amazon|argos|ebay|asos|primark|next|zara|h&m|uniqlo|currys|john lewis|tk ?maxx|sports direct|jd sports|shein|temu|aliexpress|apple\.com|google play)\b/i, 'shopping'],
  [/\b(boots|superdrug|pharmacy|chemist|dentist|optician|specsavers|vision express|holland.*barrett|nhs)\b/i, 'health'],
  [/\b(odeon|vue|cineworld|picturehouse|cinema|hollywood bowl|bowl|ticketmaster|see tickets|pub|bar|wetherspoon|spotify|netflix|disney|steam|playstation|xbox)\b/i, 'fun'],
  [/\b(screwfix|toolstation|b&q|wickes|homebase|ikea|dunelm|the range|wilko|robert dyas|b&m|home bargains)\b/i, 'home'],
];
export const knownCategory = (merchant?: string) => (merchant ? KNOWN.find(([rx]) => rx.test(merchant))?.[1] ?? null : null);

/** What this payer was logged as last time (money in). */
function guessIncome(S: State, merchant?: string): string | null {
  if (!merchant) return null;
  const m = norm(merchant); let best: string | null = null;
  for (const t of S.tx) if (t.kind === 'in' && t.merchant && norm(t.merchant) === m) best = t.cat;
  return best;
}
// Platforms that pay for work, card readers that pay out takings, and ones that pay out when you sell your own things
const WORK = /^(airtasker|mybuilder|checkatrade|bark|taskrabbit|rated ?people|fiverr|upwork)$/i;
const TAKINGS = /^(stripe|sumup|square|zettle|izettle|paypal payouts?|tide)\b/i;
const SELLING = /^(vinted|ebay|depop|facebook marketplace|gumtree)$/i;

// Words that say nothing about who a bill is with
const FILLER = new Set(['bill', 'bills', 'payment', 'payments', 'repayment', 'direct', 'debit', 'limited', 'card', 'account', 'monthly', 'premium', 'services', 'online', 'google', 'apple', 'paypal', 'with', 'from', 'the']);
const words = (s: string) => new Set((s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !FILLER.has(w)));
/** "Google Youtube" and "YouTube Premium", "Monzo Flex" and "Monzo Flex Bill". */
export function sameName(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = norm(a), y = norm(b);
  if (x.length >= 3 && x === y) return true;
  const wa = words(a);
  return [...words(b)].some((w) => w.length >= 4 && wa.has(w));
}

export type Suggestion =
  | { action: 'add'; tx: Tx; guessed: boolean; hint?: string }
  | { action: 'pay-bill'; billId: string; billName: string; tx: Tx; replaces?: Tx }
  | { action: 'skip'; reason: string };

export function suggest(S: State, p: ParsedAlert, id: string): Suggestion {
  if (p.kind === 'ignore') return { action: 'skip', reason: p.reason || 'Not a payment' };
  if (p.kind === 'transfer') return { action: 'skip', reason: p.reason || 'Moved between your accounts' };
  if (!p.amount) return { action: 'skip', reason: 'No amount' };
  const d = new Date(p.time), date = ymd(d), time = hm(d);
  const base = { id, amt: p.amount, merchant: p.merchant || '', note: '', date, time, biz: false, billId: null, source: 'alert', bank: p.bank } as const;

  if (p.kind === 'bill' || p.kind === 'spent') {
    const win = billWindowAt(date, S.settings);
    const paidTx = (b: { id: string }) => S.tx.find((t) => t.billId === b.id && t.date >= win.start && t.date <= win.end);
    const named = (b: { name: string }) => sameName(b.name, p.merchant);
    const asBill = (b: (typeof S.bills)[number], replaces?: Tx): Suggestion =>
      ({ action: 'pay-bill', billId: b.id, billName: b.name, replaces, tx: { ...base, kind: 'out', cat: 'bills', sub: b.sub || b.name, merchant: b.name, billId: b.id, biz: !!b.biz } });

    // Not paid yet: a matching amount (Direct Debits, or a card payment for a bill like rent), or the same name for repayments
    // that differ from the usual amount (Monzo Flex £495.50 against a £500 bill)
    const open = S.bills.filter((b) => !paidTx(b));
    const byAmt = open.filter((b) => b.amt === p.amount).sort((x, y) => Math.abs(billDue(x, win).localeCompare(date)) - Math.abs(billDue(y, win).localeCompare(date)));
    const b = byAmt.find(named) || (p.kind === 'bill' ? byAmt[0] || open.find(named) : byAmt[0]);
    if (b) return asBill(b);

    // Already ticked off. If Kitty ticked it off itself (Direct Debit day), the bank's figure is the real one
    const done = S.bills.find((x) => paidTx(x) && named(x)) || (p.kind === 'bill' ? S.bills.find((x) => paidTx(x) && x.amt === p.amount) : undefined);
    if (done) {
      const t = paidTx(done) as Tx;
      if (p.kind === 'bill' && t.auto && t.amt !== p.amount) return asBill(done, t);
      if (t.amt === p.amount || p.kind === 'bill') return { action: 'skip', reason: `${done.name} is already ticked off as paid` };
    }

    if (p.kind === 'bill') {
      return { action: 'add', guessed: true, hint: p.reason === 'Repayment' ? `Repayment to ${p.merchant || 'a lender'} that matches none of your bills` : 'Direct Debit that matches none of your bills',
        tx: { ...base, kind: 'out', cat: 'bills', sub: null } };
    }
  }

  if (p.kind === 'received') {
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

  const cat = guessCategory(S, p.merchant) || knownCategory(p.merchant);
  return { action: 'add', guessed: !cat, tx: { ...base, kind: 'out', cat: cat || 'other', sub: null } };
}

/** Something close to this amount was already logged by hand around the same day (a round £225 for £225.76, say). */
export function alreadyLogged(S: State, p: ParsedAlert): Tx | undefined {
  if (!p.amount || (p.kind !== 'spent' && p.kind !== 'received')) return undefined;
  const kind = p.kind === 'spent' ? 'out' : 'in', day = ymd(new Date(p.time)), amt = p.amount;
  const near = (d: string) => Math.abs(new Date(d + 'T12:00:00').getTime() - new Date(day + 'T12:00:00').getTime()) <= 864e5;
  const close = (a: number) => Math.abs(a - amt) <= Math.max(100, Math.round(amt * 0.02));
  const hand = S.tx.filter((t) => t.kind === kind && !t.billId && t.source !== 'alert' && !t.checkin && near(t.date) && close(t.amt));
  return hand.find((t) => t.amt === amt) || hand.sort((a, b) => Math.abs(a.amt - amt) - Math.abs(b.amt - amt))[0];
}
