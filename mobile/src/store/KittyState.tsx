// Holds Crest's data for the whole app and saves every change. The data itself lives in store.ts, shared with the background brain.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ymd } from '../engine/dates';
import type { State } from '../engine/types';
import { getState, setState, subscribe, tickDirectDebits, updateState } from './store';

export { tickDirectDebits };

type Ctx = {
  S: State;
  today: string;
  /** Change the data. The function gets a copy it can edit freely. */
  update: (fn: (draft: State) => void) => void;
  replace: (next: State) => void;
};

const KittyCtx = createContext<Ctx | null>(null);

export function KittyProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState(() => { const t = ymd(new Date()); tickDirectDebits(t); return t; });
  const S = useSyncExternalStore(subscribe, getState, getState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const t = ymd(new Date());
      setToday(t);
      tickDirectDebits(t);
    });
    return () => sub.remove();
  }, []);

  const update = useCallback((fn: (d: State) => void) => { updateState(fn); }, []);
  const replace = useCallback((next: State) => { setState(next); tickDirectDebits(ymd(new Date())); }, []);

  const value = useMemo(() => ({ S, today, update, replace }), [S, today, update, replace]);
  return <KittyCtx.Provider value={value}>{children}</KittyCtx.Provider>;
}

export function useKitty(): Ctx {
  const c = useContext(KittyCtx);
  if (!c) throw new Error('useKitty must be used inside KittyProvider');
  return c;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
