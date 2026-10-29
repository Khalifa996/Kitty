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
// Platforms that pay for work, and ones that pay out when you sell your own things
const WORK = /^(airtasker|mybuilder|checkatrade|bark|taskrabbit|rated ?people|fiverr|upwork)$/i;
const SELLING = /^(vinted|ebay|depop|facebook marketplace|gumtree)$/i;

export type Suggestion =
  | { action: 'add'; tx: Tx; guessed: boolean }
  | { action: 'pay-bill'; billId: string; billName: string; tx: Tx }
  | { action: 'skip'; reason: string };

export function suggest(S: State, p: ParsedAlert, id: string): Suggestion {
  if (p.kind === 'ignore') return { action: 'skip', reason: p.reason || 'Not a payment' };
  if (p.kind === 'transfer') return { action: 'skip', reason: p.reason || 'Moved between your accounts' };
  if (!p.amount) return { action: 'skip', reason: 'No amount' };
  const d = new Date(p.time), date = ymd(d), time = hm(d);
  const base = { id, amt: p.amount, merchant: p.merchant || '', note: '', date, time, biz: false, billId: null, source: 'alert' } as const;

  // A bill by amount: Direct Debits, or a card payment for a bill (e.g. rent)
  const win = billWindowAt(date, S.settings);
  const unpaid = S.bills.filter((b) => b.amt === p.amount && !S.tx.some((t) => t.billId === b.id && t.date >= win.start && t.date <= win.end));
  const open = S.bills.filter((b) => !S.tx.some((t) => t.billId === b.id && t.date >= win.start && t.date <= win.end));
  // Repayments can differ from the usual amount (Monzo Flex £495.50 against a £500 bill), so match on the name too
  const nameMatch = (b: { name: string }) => { const n = norm(b.name), q = norm(p.merchant || ''); return q.length >= 4 && (n.includes(q) || q.includes(n)); };
  const byNameAll = p.merchant ? S.bills.find(nameMatch) : undefined;
  const byName = p.merchant ? open.find((b) => { const n = norm(b.name), q = norm(p.merchant as string); return q.length >= 4 && (n.includes(q) || q.includes(n)); }) : undefined;
  if (p.kind === 'bill' || (p.kind === 'spent' && unpaid.length)) {
    const b = unpaid.sort((x, y) => Math.abs(billDue(x, win).localeCompare(date)) - Math.abs(billDue(y, win).localeCompare(date)))[0] || (p.kind === 'bill' ? byName : undefined);
    if (b) return { action: 'pay-bill', billId: b.id, billName: b.name, tx: { ...base, kind: 'out', cat: 'bills', sub: b.sub || b.name, merchant: b.name, billId: b.id, biz: !!b.biz } };
    const alreadyPaid = S.bills.find((b) => (b.amt === p.amount || b === byNameAll) && S.tx.some((t) => t.billId === b.id && t.date >= win.start && t.date <= win.end));
    if (p.kind === 'bill' && alreadyPaid) return { action: 'skip', reason: `${alreadyPaid.name} is already ticked off as paid` };
    if (p.kind === 'bill') return { action: 'skip', reason: p.reason === 'Repayment' ? `Repayment to ${p.merchant || 'a lender'} that matches no bill. Add it on the Bills screen` : 'Direct Debit that matches no bill. Add it on the Bills screen' };
  }

  if (p.kind === 'received') {
    const seen = guessIncome(S, p.merchant);
    const work = WORK.test(p.merchant || ''), sold = SELLING.test(p.merchant || '');
    const cat = p.refund ? 'refund'
      : seen ? seen
      : work ? (S.settings.sideIncome ? 'side' : 'extra')
      : sold ? 'extra'
      : S.settings.income && Math.abs(p.amount - S.settings.income) <= S.settings.income * 0.2 ? 'salary' : 'extra';
    return { action: 'add', guessed: !seen && !work && !sold && cat === 'extra', tx: { ...base, kind: 'in', cat, sub: work ? 'Job' : sold ? 'Sold something' : null, biz: cat === 'side' } };
  }

  const cat = guessCategory(S, p.merchant) || knownCategory(p.merchant);
  return { action: 'add', guessed: !cat, tx: { ...base, kind: 'out', cat: cat || 'other', sub: null } };
}

/** Something with the same amount was already logged by hand around the same day. */
export function alreadyLogged(S: State, p: ParsedAlert): Tx | undefined {
  if (!p.amount || (p.kind !== 'spent' && p.kind !== 'received')) return undefined;
  const kind = p.kind === 'spent' ? 'out' : 'in', day = ymd(new Date(p.time));
  const near = (d: string) => Math.abs(new Date(d + 'T12:00:00').getTime() - new Date(day + 'T12:00:00').getTime()) <= 864e5;
  return S.tx.find((t) => t.kind === kind && t.amt === p.amount && !t.billId && t.source !== 'alert' && near(t.date));
}
