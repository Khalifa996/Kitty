// Smart sorting: an opt-in AI service for alerts the phone couldn't sort by itself.
// Only the alert's own words are sent (account numbers removed), with the list of category names. Off by default.
import type { Cat } from '../engine/cats';
import { redact } from './redact';

// Filled in by Expo at build time from the CI settings; empty means smart sorting isn't available in this build
// @ts-ignore process.env is provided by Expo
const AI_URL: string = (process.env.EXPO_PUBLIC_KITTY_AI_URL as string | undefined) || '';
// @ts-ignore process.env is provided by Expo
const AI_KEY: string = (process.env.EXPO_PUBLIC_KITTY_AI_KEY as string | undefined) || '';

export const aiAvailable = !!AI_URL;

export type AiResult = { id: string; kind: 'spent' | 'received' | 'transfer' | 'not_payment'; name: string; category: string; confidence: 'high' | 'medium' | 'low'; note: string };
export type AiAlert = { key: string; app: string; title: string; text: string };

/** Ask the AI service about up to 20 alerts. Resolves with results keyed by the alert's key. */
export async function sortAlerts(alerts: AiAlert[], cats: Cat[], inTypes: Cat[], install: string): Promise<Record<string, AiResult>> {
  if (!AI_URL) throw new Error('Smart sorting is not available in this build');
  const list = alerts.slice(0, 20);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${AI_URL.replace(/\/$/, '')}/v1/sort`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-kitty-key': AI_KEY, 'x-kitty-install': install },
      body: JSON.stringify({
        // Short ids, not the phone's notification keys
        alerts: list.map((a, i) => ({ id: `a${i}`, app: a.app, title: redact(a.title), text: redact(a.text) })),
        categories: cats.map((c) => ({ id: c.id, name: c.n })),
        inTypes: inTypes.map((c) => ({ id: c.id, name: c.n })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Smart sorting failed (${res.status})`);
    const out: Record<string, AiResult> = {};
    for (const r of (body.results || []) as AiResult[]) {
      const a = list[Number(String(r.id).slice(1))];
      if (a) out[a.key] = { ...r, id: a.key };
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/** A random id for this install, so the service can limit how often one phone asks. */
export const newInstallId = () => Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
