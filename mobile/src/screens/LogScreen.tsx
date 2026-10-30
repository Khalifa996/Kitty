// Log a spend or money in: amount on the keypad, where, category, save. Three taps for a regular.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { safeInfo } from '../engine/budget';
import { categories, inTypes } from '../engine/cats';
import { addDays, hm, ymd } from '../engine/dates';
import type { Tx } from '../engine/types';
import { uid, useKitty } from '../store/KittyState';
import { Btn, CatIcon, Chip } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { SafeStrip } from '../ui/SafeStrip';
import { C, moneyS, money, symbol } from '../ui/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
const norm = (s: string) => s.trim().toLowerCase();

export function LogScreen({ onSaved }: { onSaved: (msg: string, undo: () => void) => void }) {
  const { S, today, update } = useKitty();
  const [mode, setMode] = useState<'out' | 'in'>('out');
  const [amt, setAmt] = useState('');
  const [merchant, setMerchant] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [when, setWhen] = useState<'today' | 'yesterday'>('today');
  const cur = S.settings.currency;
  const p = Math.round(parseFloat(amt || '0') * 100) || 0;

  const cats = mode === 'out' ? categories(S.settings) : inTypes(S.settings);
  const chosen = cat ?? (mode === 'out' ? (cats.find((c) => c.id === 'food') || cats[0]).id : 'salary');

  // Places you've logged before, most used first; the last category used for each
  const memory = useMemo(() => {
    const m = new Map<string, { name: string; cat: string; n: number }>();
    for (const t of S.tx) {
      if (t.kind !== mode || !t.merchant || t.billId || t.checkin || t.potIn) continue;
      const k = norm(t.merchant), e = m.get(k) || { name: t.merchant.trim(), cat: t.cat, n: 0 };
      e.cat = t.cat; e.n++; m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [S.tx, mode]);
  const q = norm(merchant);
  const sugg = (q ? memory.filter((e) => norm(e.name).includes(q)) : memory).slice(0, 8);

  const key = (v: string) => {
    let a = amt;
    if (v === 'del') a = a.slice(0, -1);
    else if (v === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
    else {
      if (a === '0') a = '';
      const [i, dec] = a.split('.');
      if (dec !== undefined && dec.length >= 2) return;
      if (dec === undefined && i.length >= 7) return;
      a += v;
    }
    setAmt(a);
  };

  const pick = (name: string, c: string) => { setMerchant(name); setCat(c); };
  const typed = (v: string) => {
    setMerchant(v);
    const hit = memory.find((e) => norm(e.name) === norm(v));
    if (hit) setCat(hit.cat);
  };

  const si = S.settings.setupDone ? safeInfo(S, today) : null;
  let line: string | undefined;
  if (si && p > 0 && mode === 'out') {
    const a = si.safe - p;
    line = a >= 0 ? `${moneyS(a, cur)} left today after this` : si.daysLeft > 1 ? `${moneyS(Math.round((si.left - p) / (si.daysLeft - 1)), cur)}/day from tomorrow` : 'Last day of the cycle';
  }

  const save = () => {
    if (p <= 0) return;
    const date = when === 'today' ? today : ymd(addDays(new Date(today + 'T12:00:00'), -1));
    const t: Tx = { id: uid(), kind: mode, amt: p, cat: chosen, sub: null, merchant: merchant.trim(), note: '', date, time: when === 'today' ? hm(new Date()) : '12:00', biz: false, billId: null };
    update((d) => { d.tx.push(t); });
    setAmt(''); setMerchant(''); setCat(null);
    onSaved(`Saved ${money(p, cur)}${t.merchant ? ' · ' + t.merchant : ''}`, () => update((d) => { d.tx = d.tx.filter((x) => x.id !== t.id); }));
  };

  const [ip, dp] = amt.split('.');
  const rows = [KEYS.slice(0, 3), KEYS.slice(3, 6), KEYS.slice(6, 9), KEYS.slice(9)];
  return (
    // Fits one screen: the keypad takes whatever height is left, so Save is always in view
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <SafeStrip extraLine={line} />
      <View style={s.toggles}>
        <View style={s.seg}>
          {(['out', 'in'] as const).map((m) => (
            <Pressable key={m} accessibilityRole="button" accessibilityLabel={m === 'out' ? 'Spent' : 'Received'} accessibilityState={{ selected: mode === m }} onPress={() => { setMode(m); setCat(null); }} style={[s.segB, mode === m && s.segOn]}>
              <Text style={[s.segT, mode === m && { color: C.fg }]}>{m === 'out' ? 'Spent' : 'Received'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.seg}>
          {(['today', 'yesterday'] as const).map((w) => (
            <Pressable key={w} accessibilityRole="button" accessibilityLabel={w === 'today' ? 'Today' : 'Yesterday'} accessibilityState={{ selected: when === w }} onPress={() => setWhen(w)} style={[s.segB, when === w && s.segOn]}>
              <Text style={[s.segT, when === w && { color: C.fg }]}>{w === 'today' ? 'Today' : 'Yesterday'}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={[s.amount, mode === 'in' && { color: C.good }]} accessibilityLiveRegion="polite" numberOfLines={1} adjustsFontSizeToFit>
        <Text style={s.cur}>{symbol(cur).trim()} </Text>
        {amt ? `${Number(ip || 0).toLocaleString('en-GB')}${dp !== undefined ? '.' + dp : ''}` : <Text style={{ color: C.faint }}>0</Text>}
      </Text>
      <TextInput value={merchant} onChangeText={typed} placeholder={mode === 'out' ? 'Where? e.g. Lidl' : 'From? e.g. Salary'} placeholderTextColor={C.faint}
        style={s.field} accessibilityLabel="Where" returnKeyType="done" />
      {sugg.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
          {sugg.map((e) => { const c = cats.find((x) => x.id === e.cat); return <Chip key={e.name} label={e.name} on={norm(e.name) === q} colour={c?.c || C.muted} icon={c?.i} onPress={() => pick(e.name, e.cat)} />; })}
        </ScrollView>
      )}
      <View style={s.cats}>
        {cats.slice(0, 10).map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.n} accessibilityState={{ selected: c.id === chosen }} onPress={() => setCat(c.id)} style={[s.cat, c.id === chosen && s.catOn]}>
            <CatIcon icon={c.i} colour={c.c} size={34} on={c.id === chosen} />
            <Text style={[s.catT, c.id === chosen && { color: C.fg }]} numberOfLines={1}>{c.n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.keys}>
        {rows.map((r, i) => (
          <View key={i} style={s.keyRow}>
            {r.map((v) => (
              <Pressable key={v} accessibilityRole="button" accessibilityLabel={v === 'del' ? 'Delete digit' : v === '.' ? 'Decimal point' : v} onPress={() => key(v)}
                style={({ pressed }) => [s.key, pressed && { backgroundColor: C.surface2 }]}>
                {v === 'del' ? <Icon name="back" size={24} colour={C.fg} /> : <Text style={s.keyT}>{v}</Text>}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <Btn label={p > 0 ? `Save ${money(p, cur)}` : 'Save'} primary={p > 0} disabled={p <= 0} onPress={save} style={{ height: 50 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 8 },
  toggles: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 999, padding: 3 },
  segB: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  segOn: { backgroundColor: C.surface2 },
  segT: { color: C.muted, fontWeight: '700', fontSize: 13 },
  amount: { color: C.fg, fontSize: 42, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  cur: { fontSize: 22, color: C.muted },
  field: { backgroundColor: C.surface, borderRadius: 12, height: 44, paddingHorizontal: 12, color: C.fg, fontSize: 16 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 2 },
  cat: { width: '20%', alignItems: 'center', gap: 3, paddingVertical: 4, borderRadius: 12 },
  catOn: { backgroundColor: C.surface },
  catT: { color: C.muted, fontSize: 11, fontWeight: '700', paddingHorizontal: 2 },
  keys: { flex: 1, minHeight: 176, gap: 6, justifyContent: 'flex-end' },
  keyRow: { flex: 1, maxHeight: 64, flexDirection: 'row', gap: 6 },
  key: { flex: 1, minHeight: 40, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  keyT: { color: C.fg, fontSize: 24, fontWeight: '500' },
});
