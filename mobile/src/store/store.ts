// Crest's data in memory, shared by the app and the background brain. When both are alive they run in the same
// JavaScript runtime, so there is only ever one copy and one writer; every change is saved straight away.
import { dueDirectDebits } from '../engine/budget';
import type { State } from '../engine/types';
import { loadState, saveState } from './storage';

let cur: State | null = null;
const subs = new Set<() => void>();
const copy = (S: State): State => JSON.parse(JSON.stringify(S));

export function getState(): State {
  if (!cur) cur = loadState();
  return cur;
}

export function setState(next: State): void {
  cur = next;
  saveState(next);
  subs.forEach((f) => f());
}

/** Change the data. The function gets a copy it can edit freely. */
export function updateState(fn: (draft: State) => void): State {
  const next = copy(getState());
  fn(next);
  setState(next);
  return next;
}

export function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

/** Direct Debits that have come due are ticked off whenever the app opens or the brain runs. */
export function tickDirectDebits(today: string): void {
  const due = dueDirectDebits(getState(), today);
  if (due.length) updateState((d) => { d.tx.push(...due); });
}

// Other parts of the app (the capture queue) listen for "the brain just ran"
const ranSubs = new Set<() => void>();
export const onBrainRan = (f: () => void) => { ranSubs.add(f); return () => { ranSubs.delete(f); }; };
export const brainRan = () => ranSubs.forEach((f) => f());
