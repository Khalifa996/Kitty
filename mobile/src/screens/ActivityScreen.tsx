// Everything logged, newest first, grouped by day.
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { categories, catName, inName, inTypes } from '../engine/cats';
import type { Tx } from '../engine/types';
import { useKitty } from '../store/KittyState';
import { Btn, Dot, Sheet } from '../ui/kit';
import { C, money } from '../ui/theme';

const dayLabel = (d: string) => {
  const now = new Date(), day = new Date(d + 'T12:00:00');
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (day.toDateString() === now.toDateString()) return 'Today';
  if (day.toDateString() === y.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
};

export function ActivityScreen({ onDone }: { onDone: (msg: string, undo?: () => void) => void }) {
  const { S, update } = useKitty();
  const [open, setOpen] = useState<Tx | null>(null);
  const cur = S.settings.currency;

  const sections = useMemo(() => {
    const list = [...S.tx].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 400);
    const out: { title: string; spent: number; bills: number; data: Tx[] }[] = [];
    for (const t of list) {
      let g = out[out.length - 1];
      if (!g || g.title !== t.date) { g = { title: t.date, spent: 0, bills: 0, data: [] }; out.push(g); }
      g.data.push(t);
      if (t.kind === 'out') { if (t.billId) g.bills += t.amt; else g.spent += t.amt; }
    }
    return out;
  }, [S.tx]);

  const colour = (t: Tx) => t.billId ? C.bill : t.kind === 'in' ? (inTypes(S.settings).find((x) => x.id === t.cat)?.c || C.good) : (categories(S.settings).find((c) => c.id === t.cat)?.c || C.muted);
  const sub = (t: Tx) => {
    const bill = t.billId ? S.bills.find((b) => b.id === t.billId) : null;
    const first = t.checkin ? 'Found at balance check'
      : bill ? ({ bill: 'Bill', sub: 'Subscription', debt: 'Debt repayment' }[bill.type] + (t.auto ? ' · Direct Debit' : ''))
      : t.kind === 'in' ? inName(t.cat)
      : (t.sub || (t.merchant ? catName(S.settings, t.cat) : ''));
    return [first, t.time, t.source === 'alert' ? 'From bank alert' : '', t.note].filter(Boolean).join(' · ');
  };

  const del = (t: Tx) => {
    update((d) => { d.tx = d.tx.filter((x) => x.id !== t.id); });
    setOpen(null);
    onDone('Deleted', () => update((d) => { d.tx.push(t); }));
  };

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={<Text style={s.h1}>Activity</Text>}
        ListEmptyComponent={<Text style={s.hint}>Nothing logged yet.</Text>}
        renderSectionHeader={({ section }) => (
          <View style={s.ghd}>
            <Text style={s.ghdT}>{dayLabel(section.title)}</Text>
            <Text style={s.ghdN}>{[section.spent ? money(section.spent, cur) + ' spent' : '', section.bills ? money(section.bills, cur) + ' bills' : ''].filter(Boolean).join(' · ')}</Text>
          </View>
        )}
        renderItem={({ item: t, index, section }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${t.merchant || catName(S.settings, t.cat)} ${money(t.amt, cur)}`} onPress={() => setOpen(t)}
            style={({ pressed }) => [s.row, index === 0 && s.first, index === section.data.length - 1 && s.last, index > 0 && s.sep, pressed && { backgroundColor: C.surface2 }]}>
            <View style={[s.ic, { backgroundColor: colour(t) + '29' }]}><Dot colour={colour(t)} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name} numberOfLines={1}>{t.merchant || (t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat))}</Text>
              <Text style={s.meta} numberOfLines={1}>{sub(t)}</Text>
            </View>
            <Text style={[s.amt, t.kind === 'in' && { color: C.good }]}>{t.kind === 'in' ? '+' : ''}{money(t.amt, cur)}</Text>
          </Pressable>
        )}
      />
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? (open.merchant || 'Entry') : ''}>
        {open && <Text style={s.hint}>{money(open.amt, cur)} · {dayLabel(open.date)} {open.time} · {sub(open)}</Text>}
        <Text style={s.hint}>Editing comes with the next build. For now you can delete and log it again.</Text>
        {open && <Btn label="Delete" danger onPress={() => del(open)} />}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: C.fg, fontSize: 26, fontWeight: '700', marginBottom: 6 },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  ghd: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 16, paddingBottom: 7 },
  ghdT: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  ghdN: { color: C.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 11 },
  first: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  last: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  sep: { borderTopWidth: 1, borderTopColor: C.line },
  ic: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  name: { color: C.fg, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { color: C.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
