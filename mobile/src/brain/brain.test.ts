/// <reference types="jest" />
import { addAll, applyAct, assess, nextSettle, noticeFor, projected, settledAdds, snapshot } from './brain';
import { parseAll } from '../parse/bankAlerts';
import type { Settings, State, Tx } from '../engine/types';

const settings = (o: Partial<Settings> = {}): Settings => ({
  currency: 'GBP', payFreq: 'monthly', payday: 27, payAnchor: null, income: 310000, savings: 0,
  sideIncome: true, setupDone: true, checkEvery: 3, limits: {}, dismissed: {}, ...o,
});
const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
const at = (s: string) => new Date(s).getTime();
const NOW = at('2026-11-10T12:00:30');
const REV = 'com.revolut.revolut', BAR = 'com.barclays.android.barclaysmobilebanking', GW = 'com.google.android.apps.walletnfcrel';
const raw = (key: string, pkg: string, title: string, text: string, time: number) => ({ key, pkg, title, text, time });
const state = (tx: Tx[] = []): State => ({ v: 1, settings: settings(), bills: [], tx, pots: [], accounts: [], checkins: [] });
// Revolut and Barclays have been heard from lately, so Google Wallet's copies of their cards are skipped
const seen: Tx[] = [
  { id: 'old1', kind: 'out', amt: 300, cat: 'food', merchant: 'Cafe', note: '', date: '2026-11-03', time: '09:00', biz: false, billId: null, bank: 'Revolut' },
  { id: 'old2', kind: 'out', amt: 500, cat: 'shopping', merchant: 'Shop', note: '', date: '2026-11-04', time: '09:00', biz: false, billId: null, bank: 'Barclays' },
];

it('counts a card payment straight away in the figure, and adds it once it has settled', () => {
  const S = state([...seen]);
  const parsed = parseAll([raw('r1', REV, 'Greggs', '🍔 You spent £4.50\nGBP balance: £42.01', NOW - 10 * 1000)]);
  const items = assess(S, parsed, NOW);
  expect(items[0]).toMatchObject({ sure: true, settled: false });
  expect(settledAdds(items, parsed, 'x').txs).toEqual([]);
  expect(nextSettle(items, NOW)).toBe(NOW - 10 * 1000 + 2 * 60 * 1000);

  const P = projected(S, items);
  expect(P.tx.length).toBe(3);
  const n = noticeFor(P, items[0], '2026-11-10', fmt)!;
  expect(n.title).toBe('£4.50 at Greggs');
  expect(n.body).toMatch(/^Eating out · £[\d.]+ left today$/);
  expect(n.actions.map((a) => a.label)).toEqual(['Groceries', 'Going out', 'Business']);

  // Three minutes on, it goes in
  const later = assess(S, parsed, NOW + 3 * 60 * 1000);
  const { txs, keys } = settledAdds(later, parsed, '2026-11-10T12:03:30Z');
  expect(txs.length).toBe(1);
  expect(keys).toEqual(['r1']);
  const d = JSON.parse(JSON.stringify(S)); addAll(d, txs); addAll(d, txs);
  expect(d.tx.length).toBe(3);
});

it("says nothing about Google Wallet's copy when the bank sends its own", () => {
  const S = state([...seen]);
  const parsed = parseAll([raw('g1', GW, 'GREGGS', '£4.50 with Revolut Visa ••1234', NOW - 5000)]);
  const items = assess(S, parsed, NOW);
  expect(noticeFor(projected(S, items), items[0], '2026-11-10', fmt)).toBeNull();
});

it('asks what money in is, and one tap counts it', () => {
  const S = state([...seen]);
  const parsed = parseAll([raw('b1', BAR, 'Barclays', "Pers acct - You've been paid £90.00 to your account ending 1111. This credit may take up to 24 hours to show.", NOW - 5000)]);
  const items = assess(S, parsed, NOW);
  expect(items[0].sure).toBe(false);
  const n = noticeFor(projected(S, items), items[0], '2026-11-10', fmt)!;
  expect(n.title).toMatch(/^£90\.00 in from/);
  expect(n.actions.map((a) => a.label)).toEqual(['Business income', 'Extra income', 'My own account']);

  const r = applyAct(S, parsed, JSON.parse(n.actions[0].key), '2026-11-10', fmt, NOW);
  const t = r.S.tx[r.S.tx.length - 1];
  expect(t).toMatchObject({ kind: 'in', amt: 9000, cat: 'side', biz: true });
  expect(r.keys).toEqual(['b1']);
  expect(r.notice?.title).toBe('Counted as business income');

  // "My own account" leaves it out and finishes with the alert
  const drop = applyAct(S, parsed, JSON.parse(n.actions[2].key), '2026-11-10', fmt, NOW);
  expect(drop.S).toBe(S);
  expect(drop.keys).toEqual(['b1']);
});

it('moves an entry that is already in to another category', () => {
  const S = state([...seen, { id: 'a-x1', kind: 'out', amt: 450, cat: 'food', merchant: 'Greggs', note: '', date: '2026-11-10', time: '12:00', biz: false, billId: null, catGuess: true }]);
  const r = applyAct(S, [], { t: 'a-x1', k: 'gone', op: 'cat:groceries' }, '2026-11-10', fmt, NOW);
  expect(r.S.tx.find((t) => t.id === 'a-x1')).toMatchObject({ cat: 'groceries' });
  expect(r.S.tx.find((t) => t.id === 'a-x1')?.catGuess).toBeUndefined();
  expect(r.notice?.title).toBe('Moved to Groceries');
});

it('gives the widget a ready-written figure', () => {
  const s = snapshot(state(), '2026-11-10', fmt, NOW);
  expect(s).toMatchObject({ label: 'left today', tone: 'ok', day: '2026-11-10' });
  expect(s.line).toMatch(/^£[\d,.]+ left · payday in 17 days$/);
});
