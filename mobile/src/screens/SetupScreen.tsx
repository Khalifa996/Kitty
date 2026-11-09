// First run: when you're paid, what you take home, your bills, savings and money now. About a minute.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addDays, hm, parse, ymd } from '../engine/dates';
import { applySetup, newDraft, preview, type Draft } from '../engine/setup';
import type { Settings } from '../engine/types';
import { uid, useKitty } from '../store/KittyState';
import { Icon } from '../ui/Icon';
import { Btn, Card, Chip, Label, Sheet, useKeyboardHeight } from '../ui/kit';
import { C, moneyS } from '../ui/theme';

const FREQS: { id: Settings['payFreq']; n: string }[] = [
  { id: 'monthly', n: 'Monthly, on a date' }, { id: 'lastwd', n: 'Last working day' },
  { id: 'weekly', n: 'Every week' }, { id: 'fortnightly', n: 'Every 2 weeks' }, { id: 'fourweekly', n: 'Every 4 weeks' },
];
const ord = (n: number) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const pence = (s: string) => { const v = Math.round(parseFloat(s.replace(/[^0-9.]/g, '')) * 100); return v > 0 ? v : 0; };
const pounds = (p: number) => (p ? (p / 100).toFixed(p % 100 ? 2 : 0) : '');
const dfmt = (d: string) => parse(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function Money({ value, onChange, label }: { value: number; onChange: (p: number) => void; label: string }) {
  const [txt, setTxt] = useState(pounds(value));
  return (
    <View style={s.money}>
      <Text style={s.moneySym}>£</Text>
      <TextInput value={txt} onChangeText={(t) => { setTxt(t); onChange(pence(t)); }} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint}
        style={s.moneyIn} accessibilityLabel={label} />
    </View>
  );
}

export function SetupScreen({ onImport }: { onImport: () => void }) {
  const { today, replace } = useKitty();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => newDraft(today));
  const [dayFor, setDayFor] = useState<number | 'payday' | null>(null);
  const kb = useKeyboardHeight();
  const p = useMemo(() => preview(d, today), [d, today]);
  const set = (o: Partial<Draft>) => setD({ ...d, ...o });
  const setBill = (i: number, o: Partial<Draft['bills'][number]>) => setD({ ...d, bills: d.bills.map((b, k) => (k === i ? { ...b, ...o } : b)) });
  const recent = Array.from({ length: 28 }, (_, k) => ymd(addDays(parse(today), -k)));
  const weekly = d.payFreq === 'weekly' || d.payFreq === 'fortnightly' || d.payFreq === 'fourweekly';

  const canNext = step !== 2 || d.income > 0;
  const finish = () => replace(applySetup(d, today, hm(new Date()), uid));

  const nav = (
    <View style={s.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(step - 1)} style={s.back}><Icon name="chev" size={20} colour={C.fg} /></Pressable>
      <View style={s.dots} accessibilityLabel={`Step ${step} of 4`}>{[1, 2, 3, 4].map((i) => <View key={i} style={[s.dot, i <= step && { backgroundColor: C.gold }]} />)}</View>
      <View style={{ width: 40 }} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.wrap, { paddingBottom: 24 + kb }]} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <View style={{ flex: 1, minHeight: 40 }} />
            <Card style={{ gap: 4 }}>
              <Label>Safe to spend today</Label>
              <Text style={[s.big, { color: C.good }]}>£24.50</Text>
              <Text style={s.hint}>Day 9 of 31 · £21.80 daily budget</Text>
            </Card>
            <Text style={s.h1}>Know what's safe to spend today</Text>
            <Text style={s.lead}>Tell Crest when you're paid and what your bills are. It works out how much you can spend each day until payday, and adjusts as you go.</Text>
            <Btn label="Get started" primary onPress={() => setStep(1)} style={{ height: 52 }} />
            <Btn label="I have a Crest backup" onPress={onImport} />
            <Text style={[s.hint, { textAlign: 'center' }]}>No account and no bank login. Everything stays on this phone.</Text>
          </>
        )}

        {step === 1 && (
          <>
            {nav}
            <Text style={s.h1}>When do you get paid?</Text>
            <View style={s.wrapRow}>{FREQS.map((f) => <Chip key={f.id} label={f.n} on={d.payFreq === f.id} onPress={() => set({ payFreq: f.id })} />)}</View>
            {d.payFreq === 'monthly' && (
              <>
                <Label>Payday</Label>
                <Pressable accessibilityRole="button" onPress={() => setDayFor('payday')} style={s.field}><Text style={s.fieldT}>{ord(d.payday)} of the month</Text></Pressable>
                <Text style={s.hint}>In shorter months, a 29th to 31st payday moves to the last day.</Text>
              </>
            )}
            {d.payFreq === 'lastwd' && <Text style={s.hint}>Weekends are skipped. Bank holidays are not yet.</Text>}
            {weekly && (
              <>
                <Label>When were you last paid?</Label>
                <View style={s.wrapRow}>{recent.slice(0, d.payFreq === 'weekly' ? 7 : d.payFreq === 'fortnightly' ? 14 : 28).map((x) => (
                  <Chip key={x} label={x === today ? 'Today' : dfmt(x)} on={d.payAnchor === x} onPress={() => set({ payAnchor: x })} />
                ))}</View>
                <Text style={s.hint}>Crest counts forward from this date.</Text>
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {nav}
            <Text style={s.h1}>How much do you take home each payday?</Text>
            <Text style={s.lead}>After tax. If it changes, use a typical amount. Crest switches to the real figure when your pay arrives.</Text>
            <Money value={d.income} onChange={(income) => set({ income })} label="Take-home pay" />
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: d.sideIncome }} onPress={() => set({ sideIncome: !d.sideIncome })} style={s.toggle}>
              <View style={[s.box, d.sideIncome && { backgroundColor: C.gold, borderColor: C.gold }]}>{d.sideIncome && <Icon name="check" size={14} colour={C.goldInk} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleT}>I also have side income or I'm self-employed</Text>
                <Text style={s.hint}>Keeps work income and costs out of your personal budget, and shows what to keep back for tax.</Text>
              </View>
            </Pressable>
          </>
        )}

        {step === 3 && (
          <>
            {nav}
            <Text style={s.h1}>Your regular bills</Text>
            <Text style={s.lead}>Fill in what you pay each month and leave the rest blank. You can change these any time.</Text>
            {d.bills.map((b, i) => (
              <View key={i} style={s.billRow}>
                <TextInput value={b.name} onChangeText={(name) => setBill(i, { name })} style={[s.input, { flex: 1, minWidth: 0 }]} placeholder="Bill name" placeholderTextColor={C.faint} accessibilityLabel="Bill name" />
                <TextInput defaultValue={pounds(b.amt)} onChangeText={(t) => setBill(i, { amt: pence(t) })} style={[s.input, { width: 76, textAlign: 'right' }]} keyboardType="decimal-pad" placeholder="£0" placeholderTextColor={C.faint} accessibilityLabel={`${b.name} amount`} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${b.name} due on the ${ord(b.day)}`} onPress={() => setDayFor(i)} style={[s.input, { width: 56, justifyContent: 'center' }]}>
                  <Text style={[s.fieldT, { fontSize: 14, textAlign: 'center' }]}>{ord(b.day)}</Text>
                </Pressable>
              </View>
            ))}
            <Btn label="Add another bill" onPress={() => set({ bills: [...d.bills, { name: '', amt: 0, day: 1, type: 'bill' }] })} />
          </>
        )}

        {step === 4 && (
          <>
            {nav}
            <Text style={s.h1}>Anything to save?</Text>
            <Text style={s.lead}>Crest sets this aside on payday, so it never counts as spending money. Zero is fine.</Text>
            <Money value={d.savings} onChange={(savings) => set({ savings })} label="Savings each payday" />
            {p.mid && (
              <>
                <Text style={[s.h1, { fontSize: 21 }]}>How much money do you have right now?</Text>
                <Text style={s.lead}>You're part-way to your next payday on {dfmt(p.next)}. Check your banking app and enter what you have to last until then.</Text>
                <Money value={d.balance || 0} onChange={(v) => set({ balance: v })} label="Money you have now" />
              </>
            )}
            <Card style={{ gap: 8 }}>
              {p.mid ? (
                d.balance == null ? <Text style={s.hint}>Enter what you have now to see your daily budget until {dfmt(p.next)}.</Text> : (
                  <>
                    <Row k="You have now" v={moneyS(d.balance)} />
                    <Row k="Bills still to come" v={'−' + moneyS(p.rem)} />
                    <Row k={(p.first as number) >= 0 ? 'To spend until payday' : 'Short by'} v={moneyS(Math.abs(p.first as number))} c={(p.first as number) >= 0 ? C.good : C.bad} bold />
                    <Text style={s.hint}>{(p.first as number) >= 0 ? `About ${moneyS(Math.round((p.first as number) / p.daysLeft))} a day for the next ${p.daysLeft} days.` : `That won't cover the bills still to come before ${dfmt(p.next)}.`} From {dfmt(p.next)}: about {moneyS(Math.round(p.left / p.days))} a day.</Text>
                  </>
                )
              ) : (
                <>
                  <Row k="Take-home pay" v={moneyS(d.income)} />
                  <Row k="Bills" v={'−' + moneyS(p.bills)} />
                  <Row k="Savings" v={'−' + moneyS(d.savings)} />
                  <Row k={p.left >= 0 ? 'To spend' : 'Short by'} v={moneyS(Math.abs(p.left))} c={p.left >= 0 ? C.good : C.bad} bold />
                  <Text style={s.hint}>{p.left >= 0 ? `About ${moneyS(Math.round(p.left / p.days))} a day for food, travel and everything else.` : 'Your bills and savings are more than your pay. Try a smaller savings amount, or check your bills.'}</Text>
                </>
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {step > 0 && (
        <View style={s.foot}>
          {step < 4
            ? <Btn label="Next" primary disabled={!canNext} onPress={() => setStep(step + 1)} style={{ height: 52 }} />
            : <Btn label="Start using Crest" primary disabled={p.mid && d.balance == null} onPress={finish} style={{ height: 52 }} />}
        </View>
      )}

      <Sheet open={dayFor !== null} onClose={() => setDayFor(null)} title={dayFor === 'payday' ? 'Payday' : 'Due on the'}>
        <View style={s.wrapRow}>
          {Array.from({ length: 31 }, (_, k) => k + 1).map((n) => (
            <Chip key={n} label={ord(n)} on={dayFor === 'payday' ? d.payday === n : typeof dayFor === 'number' && d.bills[dayFor]?.day === n}
              onPress={() => { if (dayFor === 'payday') set({ payday: n }); else if (typeof dayFor === 'number') setBill(dayFor, { day: n }); setDayFor(null); }} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

function Row({ k, v, c, bold }: { k: string; v: string; c?: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[s.rowK, bold && { color: C.fg, fontWeight: '700' }]}>{k}</Text>
      <Text style={[s.rowV, c ? { color: c } : null, bold && { fontWeight: '800' }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, padding: 18, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: C.surface2 },
  h1: { color: C.fg, fontSize: 26, fontWeight: '700', lineHeight: 32 },
  lead: { color: C.muted, fontSize: 15, lineHeight: 21 },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  big: { fontSize: 30, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { backgroundColor: C.surface, borderRadius: 12, height: 48, paddingHorizontal: 14, justifyContent: 'center' },
  fieldT: { color: C.fg, fontSize: 16, fontWeight: '600' },
  money: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 16, height: 60 },
  moneySym: { color: C.muted, fontSize: 24, marginRight: 6 },
  moneyIn: { flex: 1, color: C.fg, fontSize: 26, fontWeight: '700' },
  toggle: { flexDirection: 'row', gap: 12, backgroundColor: C.surface, borderRadius: 14, padding: 14 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: C.faint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  toggleT: { color: C.fg, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  billRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: C.surface, borderRadius: 12, height: 46, paddingHorizontal: 10, color: C.fg, fontSize: 15 },
  rowK: { color: C.muted, fontSize: 14.5 },
  rowV: { color: C.fg, fontSize: 14.5, fontVariant: ['tabular-nums'] },
  foot: { paddingHorizontal: 18, paddingBottom: 12, paddingTop: 6 },
});
