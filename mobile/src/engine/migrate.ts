// Brings any saved or imported state up to date, the same way the web prototype's migrate() does.
import type { State } from './types';

export const DEFAULT_LIMITS: Record<string, number> = { food: 14000, groceries: 26000, transport: 22000, shopping: 15000, fun: 8000, health: 4000, home: 8000, personal: 6000, bills: 3000, other: 5000 };

export function blankState(): State {
  return {
    v: 1,
    settings: { currency: 'GBP', payFreq: 'monthly', payday: 28, payAnchor: null, income: 0, savings: 0, sideIncome: false, setupDone: false, checkEvery: 3, limits: { ...DEFAULT_LIMITS }, dismissed: {} },
    bills: [], tx: [], pots: [], accounts: [], checkins: [], overdrafts: [],
  };
}

/** Accepts anything that looks like a Crest backup. Throws with a plain message if it doesn't. */
/** Tidy a saved shop name. Safe to run again and again. */
export function tidyOld(name: string): string {
  const t = name
    .replace(/\s+you['’]?ve (spent|received)\b.*$/i, '')
    .replace(/\.\s+travel charge.*$/i, '')
    .replace(/^your (purchase|order|payment) (from|to|at) /i, '')
    .replace(/\s+(GBP|EUR|USD)$/, '')
    .replace(/(\s+|,\s*)#?\d{3,}(-\d+)?$/, '')
    .trim();
  return t || name;
}

export function migrate(input: unknown): State {
  const d = input as Partial<State> | null;
  if (!d || d.v !== 1 || !Array.isArray(d.tx) || !Array.isArray(d.bills) || !d.settings) throw new Error("That doesn't look like a Crest backup");
  const base = blankState();
  const S: State = { ...base, ...d, settings: { ...base.settings, ...d.settings } } as State;
  S.pots = S.pots || [];
  S.accounts = S.accounts || [];
  S.checkins = S.checkins || [];
  S.overdrafts = S.overdrafts || [];
  S.settings.limits = S.settings.limits || { ...DEFAULT_LIMITS };
  S.settings.dismissed = S.settings.dismissed || {};
  if (S.settings.autoAdd === undefined) S.settings.autoAdd = true;
  S.bills.forEach((b) => { if (!b.type) b.type = 'bill'; });
  // Business income is always a business item, even if an older version left the flag off
  S.tx.forEach((t) => { if (t.kind === 'in' && t.cat === 'side') t.biz = true; });
  // Shop names saved before Crest's name cleaning got better: running totals, currency and store numbers on the end
  S.tx.forEach((t) => { if (t.merchant && t.source === 'alert') t.merchant = tidyOld(t.merchant); });
  return S;
}
