// Payments Kitty spotted in your bank alerts, ready to add with one tap.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alreadyLogged, suggest, type Suggestion } from '../capture/toEntry';
import { keysFor, type Capture } from '../capture/useCapture';
import { catName, categories, inName, inTypes } from '../engine/cats';
import type { Tx } from '../engine/types';
import type { ParsedAlert } from '../parse/bankAlerts';
import { useKitty } from '../store/KittyState';
import { Btn, Card, Chip, Dot, Label, Sheet } from '../ui/kit';
import { C, money } from '../ui/theme';

type Item = { p: ParsedAlert; sug: Suggestion; dup?: Tx };

const when = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString() ? `Yesterday ${t}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${t}`;
};

export function ReviewScreen({ cap, onDone, goSetup }: { cap: Capture; onDone: (msg: string, undo?: () => void) => void; goSetup: () => void }) {
  const { S, update } = useKitty();
  const [cats, setCats] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<Item | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const cur = S.settings.currency;

  const items: Item[] = useMemo(() => cap.parsed
    .filter((p) => p.kind !== 'ignore' || !p.duplicateOf)
    .map((p) => ({ p, sug: suggest(S, p, `a-${p.key.replace(/[^a-z0-9]/gi, '').slice(-16)}`), dup: alreadyLogged(S, p) })), [cap.parsed, S]);
  const todo = items.filter((i) => i.sug.action !== 'skip' && !i.p.duplicateOf);
  const skipped = items.filter((i) => i.sug.action === 'skip' && !i.p.duplicateOf);

  // Tidy up: things Kitty skipped by itself are cleared after three days
  useEffect(() => {
    const old = skipped.filter((i) => Date.now() - i.p.time > 3 * 864e5);
    if (old.length) cap.done(old.flatMap((i) => keysFor(i.p, cap.parsed)));
  }, [skipped.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const txFor = (i: Item): Tx | null => {
    if (i.sug.action === 'skip') return null;
    const t = { ...i.sug.tx };
    if (i.sug.action === 'add' && cats[i.p.key]) { t.cat = cats[i.p.key]; t.biz = t.cat === 'side'; }
    return t;
  };

  const add = (list: Item[]) => {
    const txs = list.map(txFor).filter((t): t is Tx => !!t);
    if (!txs.length) return;
    // A Direct Debit Kitty ticked off with the usual amount is swapped for the bank's real figure
    const old = list.flatMap((i) => (i.sug.action === 'pay-bill' && i.sug.replaces ? [i.sug.replaces] : []));
    const oldIds = new Set(old.map((t) => t.id));
    update((d) => { d.tx = d.tx.filter((t) => !oldIds.has(t.id)); d.tx.push(...txs); });
    cap.done(list.flatMap((i) => keysFor(i.p, cap.parsed)));
    onDone(txs.length === 1 ? `${old.length ? 'Updated' : 'Added'} ${money(txs[0].amt, cur)}${txs[0].merchant ? ' · ' + txs[0].merchant : ''}` : `Added ${txs.length} payments`,
      () => update((d) => { const ids = new Set(txs.map((t) => t.id)); d.tx = d.tx.filter((t) => !ids.has(t.id)); d.tx.push(...old); }));
  };
  const skip = (i: Item) => { cap.done(keysFor(i.p, cap.parsed)); onDone('Skipped'); };
  /** The alert is something already logged by hand: keep that entry, with the bank's exact amount and the shop's name. */
  const same = (i: Item) => {
    const was = i.dup as Tx;
    update((d) => {
      const t = d.tx.find((x) => x.id === was.id);
      if (!t) return;
      t.amt = i.p.amount || t.amt;
      if (!t.merchant && i.p.merchant) t.merchant = i.p.merchant;
      t.bank = i.p.bank;
    });
    cap.done(keysFor(i.p, cap.parsed));
    onDone(was.amt === i.p.amount ? 'Kept the one you logged' : `Updated to ${money(i.p.amount || 0, cur)}`,
      () => update((d) => { d.tx = d.tx.map((x) => (x.id === was.id ? was : x)); }));
  };
  const clearSkipped = () => { cap.done(skipped.flatMap((i) => keysFor(i.p, cap.parsed))); setShowSkipped(false); };
  const notices = skipped.filter((i) => i.p.kind === 'ignore' && !i.p.amount);
  const skippedPay = skipped.filter((i) => !notices.includes(i));
  const dupText = (t: Tx) => `${t.merchant || (t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat))}, ${money(t.amt, cur)}, ${when(new Date(t.date + 'T' + (t.time || '12:00')).getTime())}`;

  if (!S.settings.setupDone) {
    return (
      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.h1}>To review</Text>
        <Card style={{ gap: 10 }}>
          <Text style={s.h2}>Bring your Kitty data across first</Text>
          <Text style={s.hint}>In the web app, go to Insights, Settings, Copy backup. Then paste it in More here. Payments Kitty spots will appear on this screen, ready to add.</Text>
          <Btn label="Go to More" primary onPress={goSetup} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>To review</Text>
          <Text style={s.sub}>{todo.length ? `${todo.length} payment${todo.length === 1 ? '' : 's'} from your bank alerts` : 'Payments from your bank alerts show up here'}</Text>
        </View>
        {todo.length > 1 && <Btn label={`Add all ${todo.length}`} primary small onPress={() => add(todo.filter((i) => !i.dup))} />}
      </View>

      {cap.native && cap.enabled === false && (
        <Card style={{ gap: 8 }}>
          <Text style={s.h2}>Kitty can't see your bank alerts</Text>
          <Text style={s.hint}>Switch on notification access in More, and payments will appear here as you make them.</Text>
          <Btn label="Go to More" onPress={goSetup} />
        </Card>
      )}

      {todo.length === 0 && cap.enabled !== false && (
        <Card><Text style={s.hint}>All caught up. Pay with a card and the payment shows up here within seconds.</Text></Card>
      )}

      {todo.map((i) => {
        const t = txFor(i) as Tx, isIn = t.kind === 'in';
        const list = isIn ? inTypes(S.settings) : categories(S.settings);
        const c = list.find((x) => x.id === t.cat);
        const label = i.sug.action === 'pay-bill' ? `Bill: ${i.sug.billName}` : isIn ? inName(t.cat) : (c?.n || 'Other');
        const guessed = i.sug.action === 'add' && i.sug.guessed && !cats[i.p.key];
        return (
          <Card key={i.p.key} style={{ gap: 10 }}>
            <View style={s.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{t.merchant || (isIn ? 'Money in' : 'Shop not named')}</Text>
                <Text style={s.meta} numberOfLines={1}>{i.p.bank} · {when(i.p.time)}</Text>
              </View>
              <Text style={[s.amt, isIn && { color: C.good }]}>{isIn ? '+' : ''}{money(t.amt, cur)}</Text>
            </View>
            {i.dup && <Text style={[s.hint, { color: C.warn }]}>Looks like you already logged this: {dupText(i.dup)}.</Text>}
            {i.sug.action === 'add' && i.sug.hint && <Text style={s.hint}>{i.sug.hint}.</Text>}
            {i.sug.action === 'pay-bill' && i.sug.replaces && <Text style={s.hint}>Kitty ticked this off as {money(i.sug.replaces.amt, cur)} on the day. Your bank says {money(t.amt, cur)}.</Text>}
            <View style={s.row}>
              {i.sug.action === 'pay-bill'
                ? <View style={s.tag}><Dot colour={C.bill} /><Text style={s.tagT}>{label}</Text></View>
                : <Chip label={guessed ? `${label}?` : label} colour={c?.c || C.muted} onPress={() => setPicking(i)} />}
              <View style={{ flex: 1 }} />
              {i.dup ? <>
                <Btn label="Add anyway" small onPress={() => add([i])} />
                <Btn label="Same one" small primary onPress={() => same(i)} />
              </> : <>
                <Btn label="Skip" small onPress={() => skip(i)} />
                <Btn label={i.sug.action === 'pay-bill' ? (i.sug.replaces ? 'Update' : 'Mark paid') : 'Add'} small primary onPress={() => add([i])} />
              </>}
            </View>
          </Card>
        );
      })}

      {skipped.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            <Pressable style={{ flex: 1, paddingVertical: 8 }} accessibilityRole="button" accessibilityLabel="Show skipped" onPress={() => setShowSkipped(!showSkipped)}>
              <Label>{showSkipped ? 'Hide' : 'Show'} {skipped.length} skipped automatically</Label>
            </Pressable>
            {showSkipped && <Btn label="Clear all" small onPress={clearSkipped} />}
          </View>
          {showSkipped && notices.length > 0 && (
            <View style={s.skipRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { fontSize: 14, color: C.muted }]}>{notices.length} bank notice{notices.length === 1 ? '' : 's'}</Text>
                <Text style={s.meta} numberOfLines={2}>{[...new Set(notices.map((i) => i.sug.action === 'skip' ? i.sug.reason : ''))].filter(Boolean).join(' · ')}</Text>
              </View>
              <Btn label="Clear" small onPress={() => cap.done(notices.flatMap((i) => keysFor(i.p, cap.parsed)))} />
            </View>
          )}
          {showSkipped && skippedPay.map((i) => (
            <View key={i.p.key} style={s.skipRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { fontSize: 14, color: C.muted }]} numberOfLines={1}>{i.p.merchant || i.p.bank}{i.p.amount ? ` · ${money(i.p.amount, cur)}` : ''}</Text>
                <Text style={s.meta} numberOfLines={2}>{i.sug.action === 'skip' ? i.sug.reason : ''}</Text>
              </View>
              <Btn label="Clear" small onPress={() => cap.done(keysFor(i.p, cap.parsed))} />
            </View>
          ))}
        </View>
      )}

      <Sheet open={!!picking} onClose={() => setPicking(null)} title="Pick a category">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {picking && (picking.sug.action !== 'skip' && picking.sug.tx.kind === 'in' ? inTypes(S.settings) : categories(S.settings)).map((c) => (
            <Chip key={c.id} label={'long' in c ? (c as { long: string }).long : c.n} colour={c.c} on={txFor(picking)?.cat === c.id}
              onPress={() => { setCats({ ...cats, [picking.p.key]: c.id }); setPicking(null); }} />
          ))}
        </View>
      </Sheet>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 10, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 4 },
  h1: { color: C.fg, fontSize: 26, fontWeight: '700' },
  h2: { color: C.fg, fontSize: 16, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13, marginTop: 3 },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: C.fg, fontSize: 16, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { color: C.fg, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 12, height: 34 },
  tagT: { color: C.fg, fontWeight: '700', fontSize: 13 },
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12 },
});
