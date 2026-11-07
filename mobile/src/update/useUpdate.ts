// Test builds only: tells the person when a newer build is on GitHub Releases, so nobody tests an old version.
// CI fills in the build number and the releases address; Play Store builds leave them empty and this does nothing.
// The check sends nothing about the person: it's a plain request for the latest release, at most every six hours.
import { useEffect, useState } from 'react';
import { getItem, setItem } from '../store/kv';

// @ts-ignore process.env is provided by Expo
const BUILD = Number((process.env.EXPO_PUBLIC_KITTY_BUILD as string | undefined) || 0);
// @ts-ignore process.env is provided by Expo
const API: string = (process.env.EXPO_PUBLIC_KITTY_RELEASES as string | undefined) || '';
const KEY = 'kitty.update';
const EVERY = 6 * 3600 * 1000;

export type Update = { build: number; url: string };
type Cached = { at: number; build: number; url: string };

const cached = (): Cached | null => { try { return JSON.parse(getItem(KEY) || 'null'); } catch { return null; } };
const newer = (c: Cached | null): Update | null => (c && BUILD && c.build > BUILD ? { build: c.build, url: c.url } : null);

/** The build number at the end of a release tag like "app-v0.1.37". */
export const buildOf = (tag: string) => Number((tag.match(/(\d+)\s*$/) || [])[1] || 0);

export function useUpdate(): Update | null {
  const [u, setU] = useState<Update | null>(() => newer(cached()));
  useEffect(() => {
    if (!API || !BUILD) return;
    const c = cached();
    if (c && Date.now() - c.at < EVERY) return;
    let live = true;
    fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j || !live) return;
        const apk = (j.assets || []).find((a: { name: string }) => /\.apk$/i.test(a.name));
        const next: Cached = { at: Date.now(), build: buildOf(String(j.tag_name || '')), url: apk?.browser_download_url || j.html_url || '' };
        try { setItem(KEY, JSON.stringify(next)); } catch { /* best effort */ }
        setU(newer(next));
      })
      .catch(() => { /* offline: try again next time */ });
    return () => { live = false; };
  }, []);
  return u;
}
