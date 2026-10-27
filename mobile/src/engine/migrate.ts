// Brings any saved or imported state up to date, the same way the web prototype's migrate() does.
import type { State } from './types';

export const DEFAULT_LIMITS: Record<string, number> = { food: 14000, groceries: 26000, transport: 22000, shopping: 15000, fun: 8000, health: 4000, home: 8000, personal: 6000, bills: 3000, other: 5000 };

export function blankState(): State {
  return {
    v: 1,
    settings: { currency: 'GBP', payFreq: 'monthly', payday: 28, payAnchor: null, income: 0, savings: 0, sideIncome: false, setupDone: false, checkEvery: 3, limits: { ...DEFAULT_LIMITS }, dismissed: {} },
    bills: [], tx: [], pots: [], accounts: [], checkins: [],
  };
}

/** Accepts anything that looks like a Kitty backup. Throws with a plain message if it doesn't. */
export function migrate(input: unknown): State {
  const d = input as Partial<State> | null;
  if (!d || d.v !== 1 || !Array.isArray(d.tx) || !Array.isArray(d.bills) || !d.settings) throw new Error("That doesn't look like a Kitty backup");
  const base = blankState();
  const S: State = { ...base, ...d, settings: { ...base.settings, ...d.settings } } as State;
  S.pots = S.pots || [];
  S.accounts = S.accounts || [];
  S.checkins = S.checkins || [];
  S.settings.limits = S.settings.limits || { ...DEFAULT_LIMITS };
  S.settings.dismissed = S.settings.dismissed || {};
  S.bills.forEach((b) => { if (!b.type) b.type = 'bill'; });
  return S;
}
