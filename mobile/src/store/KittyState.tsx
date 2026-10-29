// Holds Kitty's data for the whole app and saves every change.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { dueDirectDebits } from '../engine/budget';
import { ymd } from '../engine/dates';
import type { State } from '../engine/types';
import { loadState, saveState } from './storage';

type Ctx = {
  S: State;
  today: string;
  /** Change the data. The function gets a copy it can edit freely. */
  update: (fn: (draft: State) => void) => void;
  replace: (next: State) => void;
};

const KittyCtx = createContext<Ctx | null>(null);
const copy = (S: State): State => JSON.parse(JSON.stringify(S));

/** Direct Debits that have come due are ticked off whenever the app opens. */
function withDirectDebits(S: State, today: string): State {
  const due = dueDirectDebits(S, today);
  if (!due.length) return S;
  const next = copy(S);
  next.tx.push(...due);
  saveState(next);
  return next;
}

export function KittyProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(() => ymd(new Date()));
  const [S, setS] = useState<State>(() => withDirectDebits(loadState(), ymd(new Date())));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const t = ymd(new Date());
      setToday(t);
      setS((cur) => withDirectDebits(cur, t));
    });
    return () => sub.remove();
  }, []);

  const update = useCallback((fn: (d: State) => void) => {
    setS((cur) => { const next = copy(cur); fn(next); saveState(next); return next; });
  }, []);
  const replace = useCallback((next: State) => { saveState(next); setS(withDirectDebits(next, ymd(new Date()))); }, []);

  const value = useMemo(() => ({ S, today, update, replace }), [S, today, update, replace]);
  return <KittyCtx.Provider value={value}>{children}</KittyCtx.Provider>;
}

export function useKitty(): Ctx {
  const c = useContext(KittyCtx);
  if (!c) throw new Error('useKitty must be used inside KittyProvider');
  return c;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
