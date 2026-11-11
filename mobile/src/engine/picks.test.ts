/// <reference types="jest" />
import { places, quickPicks } from './picks';
import { blankState } from './migrate';
import type { Tx } from './types';

let n = 0;
const tx = (o: Partial<Tx>): Tx => ({ id: `p${n++}`, kind: 'out', amt: 500, cat: 'food', merchant: '', note: '', date: '2026-10-30', time: '12:30', biz: false, billId: null, ...o });

describe('quick picks', () => {
  const S = blankState();
  S.tx.push(
    tx({ merchant: 'Cot shop', cat: 'shopping', amt: 10640, date: '2026-10-01' }),                // one-off, a month ago
    tx({ merchant: 'Amazon', cat: 'shopping', source: 'alert', date: '2026-10-31' }),              // the bank caught it
    tx({ merchant: 'Lunch', amt: 1200, date: '2026-10-28' }), tx({ merchant: 'Lunch', amt: 1200, date: '2026-10-29' }), tx({ merchant: 'Lunch', amt: 1200, date: '2026-10-30' }),
    tx({ merchant: 'Bus', cat: 'transport', amt: 175, date: '2026-10-20', time: '08:10' }), tx({ merchant: 'Bus', cat: 'transport', amt: 200, date: '2026-10-22', time: '08:05' }),
    tx({ merchant: 'Corner shop', cat: 'groceries', amt: 340, date: '2026-10-31', time: '19:00' }),
    tx({ merchant: 'Phone fee', cat: 'bills', amt: 900, date: '2026-10-29' }), tx({ merchant: 'Phone fee', cat: 'bills', amt: 900, date: '2026-10-30' }), // one-off bills
  );
  it('leaves out one-offs and things the bank already caught', () => {
    const names = quickPicks(S, 'out', '2026-11-01', 12).map((p) => p.name);
    expect(names.includes('Cot shop')).toBe(false);
    expect(names.includes('Amazon')).toBe(false);
    expect(names.includes('Phone fee')).toBe(false);
    expect(names[0]).toBe('Lunch');
  });
  it('offers the usual amount when it never changes', () => {
    const p = quickPicks(S, 'out', '2026-11-01', 12);
    expect(p.find((x) => x.name === 'Lunch')?.amt).toBe(1200);
    expect(p.find((x) => x.name === 'Bus')?.amt).toBeUndefined();
  });
  it('favours what you usually log at this time of day', () => {
    expect(quickPicks(S, 'out', '2026-11-01', 8).findIndex((p) => p.name === 'Bus'))
      .toBeLessThan(quickPicks(S, 'out', '2026-11-01', 19).findIndex((p) => p.name === 'Bus'));
  });
  it('still finds everything when you type', () => {
    expect(places(S, 'out').map((p) => p.name)).toEqual(['Lunch', 'Bus', 'Phone fee', 'Cot shop', 'Amazon', 'Corner shop']);
  });
});
