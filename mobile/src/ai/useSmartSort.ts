// Sends alerts Kitty couldn't sort to the AI service (only when the person has turned it on), and remembers the answers.
import { useEffect, useRef, useState } from 'react';
import { categories, inTypes } from '../engine/cats';
import type { State } from '../engine/types';
import { getItem, setItem } from '../store/kv';
import { aiAvailable, sortAlerts, type AiAlert, type AiResult } from './cloud';

const KEY = 'kitty.ai';
const load = (): Record<string, AiResult> => { try { return JSON.parse(getItem(KEY) || '{}'); } catch { return {}; } };
const save = (m: Record<string, AiResult>) => {
  const keys = Object.keys(m);
  const kept = keys.length > 500 ? Object.fromEntries(keys.slice(-500).map((k) => [k, m[k]])) : m;
  setItem(KEY, JSON.stringify(kept));
};

export function useSmartSort(S: State, want: AiAlert[]) {
  const on = aiAvailable && !!S.settings.ai?.on && !!S.settings.ai?.install;
  const [results, setResults] = useState<Record<string, AiResult>>(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tried = useRef(new Set<string>());
  const sig = want.map((a) => a.key).join('|');

  useEffect(() => {
    if (!on || busy) return;
    const todo = want.filter((a) => !results[a.key] && !tried.current.has(a.key)).slice(0, 20);
    if (!todo.length) return;
    todo.forEach((a) => tried.current.add(a.key));
    setBusy(true);
    sortAlerts(todo, categories(S.settings), inTypes(S.settings), S.settings.ai?.install as string)
      .then((got) => { setResults((cur) => { const next = { ...cur, ...got }; save(next); return next; }); setError(''); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Smart sorting failed'))
      .finally(() => setBusy(false));
  }, [on, sig, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  return { on, results, busy, error };
}

export const aiSortedCount = () => Object.keys(load()).length;
