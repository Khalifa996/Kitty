// The brain: what to do with captured bank alerts, the same whether the app is open or Crest is running in the
// background. Pure functions over the data, so they can be tested; task.ts does the reading, saving and posting.
import { alertTxId, alreadyLogged, isSure, keysFor, settleMinutes, suggest, type Suggestion } from '../capture/toEntry';
import { safeInfo } from '../engine/budget';
import { catName, inName } from '../engine/cats';
import type { State, Tx } from '../engine/types';
import type { ParsedAlert } from '../parse/bankAlerts';

export type Item = { p: ParsedAlert; sug: Suggestion; sure: boolean; settled: boolean };

const copy = (S: State): State => JSON.parse(JSON.stringify(S));

/** Every alert waiting in the queue, with what Crest would do with it. */
export function assess(S: State, parsed: ParsedAlert[], now: number): Item[] {
  return parsed.filter((p) => !p.duplicateOf).map((p) => {
    const sug = suggest(S, p, alertTxId(p), parsed);
    return { p, sug, sure: isSure(p, sug, alreadyLogged(S, p)), settled: now - p.time >= settleMinutes(p) * 60 * 1000 };
  });
}

/** The entry an item would add, marked as added by Crest. Shops it couldn't place keep their guess, flagged for Smart sorting. */
export function entryFor(it: Item, stamp: string): Tx | null {
  const s = it.sug;
  if (s.action !== 'add' && s.action !== 'pay-bill') return null;
  const guess = s.action === 'add' && s.guessed && s.tx.kind === 'out';
  return { ...s.tx, autoAdded: stamp, ...(guess ? { catGuess: true } : {}) };
}

/** What can go in now: sure and settled. Returns the entries and the alert keys finished with. */
export function settledAdds(items: Item[], parsed: ParsedAlert[], stamp: string): { txs: Tx[]; keys: string[] } {
  const ready = items.filter((i) => i.sure && i.settled);
  return { txs: ready.map((i) => entryFor(i, stamp)).filter((t): t is Tx => !!t), keys: ready.flatMap((i) => keysFor(i.p, parsed)) };
}

/** Add entries that aren't there already. */
export function addAll(d: State, txs: Tx[]): void {
  const have = new Set(d.tx.map((t) => t.id));
  for (const t of txs) if (!have.has(t.id)) { d.tx.push(t); have.add(t.id); }
}

/**
 * The data as it will be once everything Crest is sure about has settled. The widget and the after-payment message
 * use this, so a payment shows in the figure within seconds rather than when it's added a couple of minutes later.
 */
export function projected(S: State, items: Item[]): State {
  const extra = items.filter((i) => i.sure).map((i) => entryFor(i, '')).filter((t): t is Tx => !!t);
  if (!extra.length) return S;
  const next = copy(S);
  addAll(next, extra);
  return next;
}

/** When the next waiting alert will have settled, so the brain can run again then. */
export function nextSettle(items: Item[], now: number): number | null {
  const times = items.filter((i) => i.sure && !i.settled).map((i) => i.p.time + settleMinutes(i.p) * 60 * 1000);
  return times.length ? Math.max(now + 60 * 1000, Math.min(...times)) : null;
}

// ---- What the phone shows ----

type Fmt = (p: number) => string;

/** "£12.40 left today", or what's over and what tomorrow looks like. */
export function leftLine(S: State, today: string, fmt: Fmt): string {
  const si = safeInfo(S, today);
  if (si.left < 0) return `${fmt(-si.left)} over this pay month`;
  if (si.safe >= 0) return `${fmt(si.safe)} left today`;
  return si.tomorrow !== null ? `${fmt(-si.safe)} over today, so ${fmt(si.tomorrow)} a day from tomorrow` : `${fmt(-si.safe)} over today`;
}

export type Snapshot = { amount: string; label: string; line: string; tone: 'ok' | 'low' | 'over'; at: number; day: string };

/** The figure for the widget, the Quick Settings tile and the status bar. */
export function snapshot(S: State, today: string, fmt: Fmt, now: number): Snapshot {
  if (!S.settings.setupDone) return { amount: '', label: 'Open Crest to set up', line: '', tone: 'ok', at: now, day: today };
  const si = safeInfo(S, today);
  const payday = si.daysLeft === 1 ? 'payday tomorrow' : `payday in ${si.daysLeft} days`;
  const tone = si.safe < 0 || si.left < 0 ? 'over' : si.safe < si.allowance * 0.25 ? 'low' : 'ok';
  return {
    amount: fmt(Math.abs(si.safe)),
    label: si.safe >= 0 ? 'left today' : 'over today',
    line: si.left < 0 ? `${fmt(-si.left)} over this pay month · ${payday}` : `${fmt(si.left)} left · ${payday}`,
    tone,
    at: now,
    day: today,
  };
}

export type NoticeAction = { label: string; key: string };
export type Notice = { id: string; title: string; body: string; actions: NoticeAction[]; open?: boolean };

/** What a tap on a notification button asks for. Sent back by Android exactly as given. */
export type Act = { t: string; k: string; op: string };
const act = (label: string, t: string, k: string, op: string): NoticeAction => ({ label, key: JSON.stringify({ t, k, op }) });

// Two sensible other homes for a payment, so most wrong guesses are one tap to fix
const ALT: Record<string, [string, string]> = {
  food: ['groceries', 'fun'], groceries: ['food', 'home'], transport: ['fun', 'other'], shopping: ['home', 'personal'],
  fun: ['food', 'shopping'], health: ['personal', 'shopping'], home: ['shopping', 'other'], personal: ['shopping', 'health'],
  bills: ['other', 'shopping'], other: ['shopping', 'food'],
};

/**
 * The message Crest posts a few seconds after the bank's own alert. `P` is the projected data (this payment included
 * when Crest is sure of it). Nothing is posted for alerts that aren't money moving, moves between your own accounts,
 * or ones that need the app to sort out.
 */
export function noticeFor(P: State, it: Item, today: string, fmt: Fmt): Notice | null {
  const { p, sug } = it;
  const id = alertTxId(p), k = p.key, amt = p.amount ? fmt(p.amount) : '';
  const bizOn = !!P.settings.sideIncome;
  if (sug.action === 'skip' || sug.action === 'ask' || !p.amount) return null;

  if (sug.action === 'pay-bill') {
    return { id, title: `${sug.billName} paid · ${amt}`, body: `A bill you planned for, so today is the same. ${leftLine(P, today, fmt)}.`, actions: [] };
  }
  const t = sug.tx, name = t.merchant || (t.kind === 'in' ? 'someone' : 'a shop');

  if (t.kind === 'in') {
    if (it.sure) return { id, title: `${amt} in · ${inName(t.cat)}`, body: `${capital(leftLine(P, today, fmt))}.`, actions: [] };
    const asks = [
      ...(bizOn ? [act('Business income', id, k, 'in:side')] : []),
      act('Extra income', id, k, 'in:extra'),
      act('My own account', id, k, 'drop'),
    ];
    return { id, title: `${amt} in from ${name}`, body: 'What is it? Crest counts it once you say.', actions: asks.slice(0, 3) };
  }

  if (sug.cash) {
    return { id, title: `${amt} cash`, body: 'Count it as spending, or leave it out if it is going back in the bank.', actions: [act('Count it', id, k, 'keep'), act('Leave it out', id, k, 'drop')] };
  }
  if (sug.big) {
    return {
      id, title: `${amt} at ${name}`, body: 'A big one-off. Spread it over the pay month, or pay it from savings?',
      actions: [act('Spread it', id, k, 'spread'), act('From savings', id, k, 'outside'), act('Today', id, k, 'keep')],
    };
  }
  if (sug.newBill) {
    return { id, title: `${amt} ${t.merchant ? `to ${t.merchant}` : 'Direct Debit'}`, body: 'Looks like a new regular payment. Tap to tell Crest what it is.', actions: [], open: true };
  }
  if (!it.sure) return null;

  // Ordinary spending: the new figure, and one tap to fix the category
  const cat = catName(P.settings, t.cat) + (sug.guessed ? ' (a guess)' : '') + (t.biz ? ' · business' : '');
  const [a, b] = ALT[t.cat] || ALT.other;
  const third = bizOn && !t.biz ? act('Business', id, k, 'biz') : act('Not spending', id, k, 'drop');
  return {
    id, title: `${amt} at ${name}`, body: `${cat} · ${leftLine(P, today, fmt)}`,
    actions: [act(catName(P.settings, a), id, k, `cat:${a}`), act(catName(P.settings, b), id, k, `cat:${b}`), third],
  };
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Apply a button tap. If the entry is already in, change it; if the alert is still waiting, add it now the person
 * has said what it is. Returns what changed and the follow-up to show.
 */
export function applyAct(S: State, parsed: ParsedAlert[], a: Act, today: string, fmt: Fmt, now: number):
  { S: State; keys: string[]; notice: Notice | null } {
  const next = copy(S);
  let keys: string[] = [];
  let t = next.tx.find((x) => x.id === a.t);
  const p = parsed.find((x) => x.key === a.k);

  if (!t && p) {
    keys = keysFor(p, parsed);
    if (a.op === 'drop') return { S, keys, notice: { id: a.t, title: 'Left out', body: 'Crest won’t count that one.', actions: [] } };
    const items = assess(next, parsed, now).filter((i) => i.p.key === p.key);
    const e = items[0] && entryFor(items[0], new Date(now).toISOString());
    if (!e) return { S, keys: [], notice: null };
    next.tx.push(e);
    t = next.tx[next.tx.length - 1];
  }
  if (!t) return { S, keys, notice: null };

  let what = '';
  if (a.op === 'drop') {
    next.tx = next.tx.filter((x) => x.id !== t!.id);
    return { S: next, keys, notice: { id: a.t, title: 'Left out', body: `Crest won’t count it. ${capital(leftLine(next, today, fmt))}.`, actions: [] } };
  }
  if (a.op.startsWith('cat:')) { t.cat = a.op.slice(4); delete t.catGuess; what = `Moved to ${catName(next.settings, t.cat)}`; }
  else if (a.op === 'biz') { t.biz = true; what = 'Marked as a business cost'; }
  else if (a.op.startsWith('in:')) { t.cat = a.op.slice(3); t.biz = t.cat === 'side'; what = `Counted as ${inName(t.cat).toLowerCase()}`; }
  else if (a.op === 'spread') { t.spread = true; what = 'Spread over the pay month'; }
  else if (a.op === 'outside') { t.outside = true; what = 'Paid from savings, left out of today'; }
  else what = 'Counted';
  return { S: next, keys, notice: { id: a.t, title: `${what}`, body: `${t.merchant || 'Payment'} · ${leftLine(next, today, fmt)}`, actions: [] } };
}
