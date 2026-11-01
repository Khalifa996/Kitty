// Everything logged, newest first, grouped by day.
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { billWindowAt } from '../engine/budget';
import { categories, catName, inName, inTypes } from '../engine/cats';
import type { Tx } from '../engine/types';
import { useKitty } from '../store/KittyState';
import { Btn, CatIcon, Chip, Label, Sheet } from '../ui/kit';
import { SwipeRow } from '../ui/SwipeRow';
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
  const [form, setForm] = useState({ name: '', amt: '', cat: '', all: true, side: false, pot: '' });
  const cur = S.settings.currency;
  const openTx = (t: Tx) => { setOpen(t); setForm({ name: t.merchant, amt: (t.amt / 100).toFixed(2), cat: t.cat, all: true, side: !!t.fromSide, pot: t.potId || '' }); };

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

  const icon = (t: Tx) => t.checkin ? 'search' : t.potIn || t.potId ? 'piggy' : t.billId ? 'receipt' : t.kind === 'in' ? (inTypes(S.settings).find((x) => x.id === t.cat)?.i || 'wallet') : (categories(S.settings).find((c) => c.id === t.cat)?.i || 'more');
  const colour = (t: Tx) => t.billId ? C.bill : t.kind === 'in' ? (inTypes(S.settings).find((x) => x.id === t.cat)?.c || C.good) : (categories(S.settings).find((c) => c.id === t.cat)?.c || C.muted);
  const sub = (t: Tx) => {
    const bill = t.billId ? S.bills.find((b) => b.id === t.billId) : null;
    const pot = t.potId || t.potIn ? S.pots.find((p) => p.id === (t.potId || t.potIn)) : null;
    const first = t.checkin ? 'Found at balance check'
      : t.potIn ? 'Moved to pot'
      : pot ? `From pot: ${pot.name}`
      : bill ? (t.auto ? 'Direct Debit' : { bill: 'Bill', sub: 'Subscription', debt: 'Debt repayment' }[bill.type])
      : t.kind === 'in' ? inName(t.cat)
      : (t.sub || (t.merchant ? catName(S.settings, t.cat) : ''));
    return [first, t.time, t.fromSide ? 'Side income' : '', t.bank, t.note].filter(Boolean).join(' · ');
  };

  const del = (t: Tx) => {
    // A Direct Debit Kitty ticked off would come back the next time the app opens, so remember it was removed
    const skipKey = t.auto && t.billId ? `${t.billId}:${billWindowAt(t.date, S.settings).start}` : null;
    update((d) => {
      d.tx = d.tx.filter((x) => x.id !== t.id);
      if (skipKey) d.settings.ddSkip = { ...(d.settings.ddSkip || {}), [skipKey]: true };
    });
    setOpen(null);
    onDone('Deleted', () => update((d) => {
      d.tx.push(t);
      if (skipKey && d.settings.ddSkip) delete d.settings.ddSkip[skipKey];
    }));
  };

  const pennies = Math.round(parseFloat(form.amt.replace(/[^0-9.]/g, '')) * 100);
  // Other entries from the same place with the old category: fixing one fixes them all, and Kitty remembers it
  const same = open && open.merchant && form.cat !== open.cat && !open.billId
    ? S.tx.filter((x) => x.id !== open.id && x.kind === open.kind && !x.billId && x.cat === open.cat && x.merchant.trim().toLowerCase() === open.merchant.trim().toLowerCase())
    : [];
  const save = () => {
    if (!open || !(pennies > 0)) return;
    const was = open, others = form.all ? same : [];
    const before = new Map(others.map((x) => [x.id, x.cat]));
    update((d) => {
      for (const x of d.tx) if (before.has(x.id)) x.cat = form.cat;
      const t = d.tx.find((x) => x.id === was.id);
      if (!t) return;
      t.merchant = form.name.trim();
      t.amt = pennies;
      if (t.kind === 'out' && !t.billId && !t.biz) { if (form.side) t.fromSide = true; else delete t.fromSide; }
      if (t.kind === 'out' && !t.billId && !t.potIn) { if (form.pot) t.potId = form.pot; else delete t.potId; }
      if (!t.billId && form.cat) { t.cat = form.cat; t.biz = t.kind === 'in' ? form.cat === 'side' : t.biz; }
    });
    setOpen(null);
    onDone(others.length ? `Saved, and ${others.length} more from ${was.merchant}` : 'Saved', () => update((d) => {
      d.tx = d.tx.map((x) => (x.id === was.id ? was : before.has(x.id) ? { ...x, cat: before.get(x.id) as string } : x));
    }));
  };
  const pickList = open && !open.billId && !open.checkin ? (open.kind === 'in' ? inTypes(S.settings) : categories(S.settings)) : [];

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={<View style={{ marginBottom: 6 }}><Text style={s.h1}>Activity</Text>{S.tx.length > 0 && <Text style={s.hint}>Swipe left to delete, right to edit</Text>}</View>}
        ListEmptyComponent={<Text style={s.hint}>Nothing logged yet.</Text>}
        renderSectionHeader={({ section }) => (
          <View style={s.ghd}>
            <Text style={s.ghdT}>{dayLabel(section.title)}</Text>
            <Text style={s.ghdN}>{[section.spent ? money(section.spent, cur) + ' spent' : '', section.bills ? money(section.bills, cur) + ' bills' : ''].filter(Boolean).join(' · ')}</Text>
          </View>
        )}
        renderItem={({ item: t, index, section }) => (
          <SwipeRow onDelete={() => del(t)} onEdit={() => openTx(t)} style={[index === 0 && s.first, index === section.data.length - 1 && s.last]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t.merchant || catName(S.settings, t.cat)} ${money(t.amt, cur)}`} onPress={() => openTx(t)}
            style={({ pressed }) => [s.row, index > 0 && s.sep, pressed && { backgroundColor: C.surface2 }]}>
            <CatIcon icon={icon(t)} colour={colour(t)} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name} numberOfLines={1}>{t.merchant || (t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat))}</Text>
              <Text style={s.meta} numberOfLines={1}>{sub(t)}</Text>
            </View>
            <Text style={[s.amt, t.kind === 'in' && { color: C.good }]}>{t.kind === 'in' ? '+' : ''}{money(t.amt, cur)}</Text>
          </Pressable>
          </SwipeRow>
        )}
      />
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? (open.merchant || 'Entry') : ''}>
        {open && <Text style={s.hint}>{dayLabel(open.date)} · {sub(open)}</Text>}
        <Label>{open?.kind === 'in' ? 'From' : 'Where'}</Label>
        <TextInput value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Name" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Name" />
        <Label>Amount</Label>
        <TextInput value={form.amt} onChangeText={(amt) => setForm({ ...form, amt })} keyboardType="decimal-pad" style={s.field} accessibilityLabel="Amount" selectTextOnFocus />
        {pickList.length > 0 && <>
          <Label>{open?.kind === 'in' ? 'Type' : 'Category'}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {pickList.map((c) => <Chip key={c.id} label={'long' in c ? (c as { long: string }).long : c.n} colour={c.c} icon={c.i} on={form.cat === c.id} onPress={() => setForm({ ...form, cat: c.id })} />)}
          </View>
        </>}
        {open && open.kind === 'out' && !open.billId && !open.potIn && S.pots.some((p) => !p.closed) && <>
          <Label>Paid from</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Daily budget" on={!form.pot} onPress={() => setForm({ ...form, pot: '' })} />
            {S.pots.filter((p) => !p.closed).map((p) => <Chip key={p.id} label={`Pot: ${p.name}`} icon="piggy" colour={C.pot} on={form.pot === p.id} onPress={() => setForm({ ...form, pot: p.id })} />)}
          </View>
        </>}
        {open && S.settings.sideIncome && open.kind === 'out' && !open.billId && !open.biz && (
          <Chip label="Paid from side income" on={form.side} onPress={() => setForm({ ...form, side: !form.side })} />
        )}
        {same.length > 0 && (
          <Chip label={`Also change ${same.length} other ${open?.merchant} ${same.length === 1 ? 'entry' : 'entries'}`} on={form.all} onPress={() => setForm({ ...form, all: !form.all })} />
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {open && <Btn label="Delete" danger onPress={() => del(open)} />}
          <Btn label="Save" primary style={{ flex: 1 }} disabled={!(pennies > 0)} onPress={save} />
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: C.fg, fontSize: 26, fontWeight: '700', marginBottom: 2 },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  field: { backgroundColor: C.surface2, borderRadius: 12, height: 44, paddingHorizontal: 12, color: C.fg, fontSize: 16 },
  ghd: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 16, paddingBottom: 7 },
  ghdT: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  ghdN: { color: C.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, paddingHorizontal: 14, paddingVertical: 11 },
  first: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  last: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  sep: { borderTopWidth: 1, borderTopColor: C.line },
  name: { color: C.fg, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { color: C.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
