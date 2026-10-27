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
    if (n === m || (first.length >= 4 && n.startsWith(first))) best = t.cat;
  }
  return best;
}

export type Suggestion =
  | { action: 'add'; tx: Tx; guessed: boolean }
  | { action: 'pay-bill'; billId: string; billName: string; tx: Tx }
  | { action: 'skip'; reason: string };

export function suggest(S: State, p: ParsedAlert, id: string): Suggestion {
  if (p.kind === 'ignore') return { action: 'skip', reason: p.reason || 'Not a payment' };
  if (p.kind === 'transfer') return { action: 'skip', reason: 'Moved between your accounts' };
  if (!p.amount) return { action: 'skip', reason: 'No amount' };
  const d = new Date(p.time), date = ymd(d), time = hm(d);
  const base = { id, amt: p.amount, merchant: p.merchant || '', note: '', date, time, biz: false, billId: null, source: 'alert' } as const;

  // A bill by amount: Direct Debits, or a card payment for a bill (e.g. rent)
  const win = billWindowAt(date, S.settings);
  const unpaid = S.bills.filter((b) => b.amt === p.amount && !S.tx.some((t) => t.billId === b.id && t.date >= win.start && t.date <= win.end));
  if (p.kind === 'bill' || (p.kind === 'spent' && unpaid.length)) {
    const b = unpaid.sort((x, y) => Math.abs(billDue(x, win).localeCompare(date)) - Math.abs(billDue(y, win).localeCompare(date)))[0];
    if (b) return { action: 'pay-bill', billId: b.id, billName: b.name, tx: { ...base, kind: 'out', cat: 'bills', sub: b.sub || b.name, merchant: b.name, billId: b.id, biz: !!b.biz } };
    if (p.kind === 'bill') return { action: 'skip', reason: 'Direct Debit that matches no bill. Add it on the Bills screen' };
  }

  if (p.kind === 'received') {
    const cat = p.refund ? 'refund' : S.settings.income && Math.abs(p.amount - S.settings.income) <= S.settings.income * 0.2 ? 'salary' : 'extra';
    return { action: 'add', guessed: false, tx: { ...base, kind: 'in', cat, sub: null } };
  }

  const cat = guessCategory(S, p.merchant);
  return { action: 'add', guessed: !cat, tx: { ...base, kind: 'out', cat: cat || 'other', sub: null } };
}
