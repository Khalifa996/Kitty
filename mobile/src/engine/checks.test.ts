import { likelyDuplicates, quietBanks } from './checks';
import { blankState } from './migrate';
import type { Tx } from './types';

const tx = (o: Partial<Tx>): Tx => ({ id: Math.random().toString(36).slice(2), kind: 'out', amt: 1000, cat: 'food', merchant: '', note: '', date: '2026-11-02', time: '10:00', biz: false, billId: null, ...o });

it('spots something added by hand that a bank alert added too', () => {
  const S = blankState();
  const mine = tx({ kind: 'in', amt: 23140, cat: 'expenses', merchant: 'Trip money back', date: '2026-10-29' });
  const bank = tx({ kind: 'in', amt: 23140, cat: 'expenses', merchant: 'Money in', date: '2026-10-29', source: 'alert', bank: 'Barclays' });
  S.tx.push(mine, bank, tx({ amt: 450, source: 'alert', bank: 'Barclays' }), tx({ amt: 9900, merchant: 'Rent', billId: 'b1' }));
  expect(likelyDuplicates(S, '2026-11-07')).toEqual([[mine, bank]]);
  // Once the person says to keep both, it isn't raised again
  S.settings.dismissed = { [`dup:${mine.id}:${bank.id}`]: true };
  expect(likelyDuplicates(S, '2026-11-07')).toEqual([]);
});

it('notices a bank that usually sends alerts going quiet', () => {
  const S = blankState();
  for (const d of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) S.tx.push(tx({ date: d, source: 'alert', bank: 'Barclays' }));
  S.tx.push(tx({ date: '2026-10-24', source: 'alert', bank: 'Monzo' }));
  expect(quietBanks(S, '2026-10-26')).toEqual([]);
  expect(quietBanks(S, '2026-10-27')).toEqual([{ bank: 'Barclays', last: '2026-10-24' }]);
  // An alert waiting in Review means it isn't quiet
  expect(quietBanks(S, '2026-10-27', ['Barclays'])).toEqual([]);
});
