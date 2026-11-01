// Looking back: how a single day went, and a pay month at a glance.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cycleOf, cycleSummary, dayInfo, sideSummary, taxYearStart } from '../engine/budget';
import { catName, categories, inName, inTypes } from '../engine/cats';
import { diffDays, nextDay, parse, prevDay } from '../engine/dates';
import type { Tx } from '../engine/types';
import { useKitty } from '../store/KittyState';
import { Icon } from '../ui/Icon';
import { Card, CatIcon, Chip, Label } from '../ui/kit';
import { C, money, moneyS } from '../ui/theme';

const DAYS_BACK = 60;
const MONTHS_BACK = 12;
const dayName = (d: string, today: string) => {
  if (d === today) return 'Today';
  if (d === prevDay(today)) return 'Yesterday';
  return parse(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
};
const short = (d: string) => parse(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function Stepper({ label, onPrev, onNext }: { label: string; onPrev?: () => void; onNext?: () => void }) {
  return (
    <View style={s.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Earlier" disabled={!onPrev} onPress={onPrev} style={[s.arrow, !onPrev && { opacity: 0.3 }]}>
        <Icon name="chev" size={20} colour={C.fg} />
      </Pressable>
      <Text style={s.stepT} numberOfLines={1}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Later" disabled={!onNext} onPress={onNext} style={[s.arrow, !onNext && { opacity: 0.3 }]}>
        <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chev" size={20} colour={C.fg} /></View>
      </Pressable>
    </View>
  );
}

export function InsightsScreen() {
  const { S, today, update } = useKitty();
  const [view, setView] = useState<'day' | 'month'>('day');
  const [day, setDay] = useState(() => prevDay(today));
  const [back, setBack] = useState(0); // pay months back from this one
  const cur = S.settings.currency;
  const cats = categories(S.settings), ins = inTypes(S.settings);

  const icon = (t: Tx) => t.billId ? 'receipt' : t.kind === 'in' ? (ins.find((x) => x.id === t.cat)?.i || 'wallet') : (cats.find((c) => c.id === t.cat)?.i || 'more');
  const colour = (t: Tx) => t.billId ? C.bill : t.kind === 'in' ? C.good : (cats.find((c) => c.id === t.cat)?.c || C.muted);

  // ---- Day ----
  const di = useMemo(() => dayInfo(S, day), [S, day]);
  const dayTx = useMemo(() => S.tx.filter((t) => t.date === day).sort((a, b) => a.time.localeCompare(b.time)), [S.tx, day]);
  const dayIn = dayTx.filter((t) => t.kind === 'in').reduce((a, t) => a + t.amt, 0);
  const dayBills = dayTx.filter((t) => t.kind === 'out' && t.billId).reduce((a, t) => a + t.amt, 0);
  const diff = di.allowance - di.todaySpent, isToday = day === today;

  // ---- Pay month ----
  const cycle = useMemo(() => {
    let c = cycleOf(today, S.settings);
    for (let k = 0; k < back; k++) c = cycleOf(prevDay(c.start), S.settings);
    return c;
  }, [S.settings, today, back]);
  const m = useMemo(() => cycleSummary(S, cycle, today), [S, cycle, today]);
  const prev = useMemo(() => cycleSummary(S, cycleOf(prevDay(cycle.start), S.settings), today), [S, cycle, today]);
  const inPlan = m.days.filter((d) => d.spent <= Math.max(0, d.allowance)).length;
  const maxDay = Math.max(1, ...m.days.map((d) => Math.max(d.spent, d.allowance)));
  const topCat = m.byCat[0]?.amt || 1;
  const n = m.days.length, prevSoFar = prev.days.slice(0, n).reduce((a, d) => a + d.spent, 0);
  const isNow = back === 0;
  const sideOn = S.settings.sideIncome;
  const sideMonth = useMemo(() => sideSummary(S, cycle.start, cycle.end), [S, cycle]);
  const ty = taxYearStart(today, cur), sideYear = useMemo(() => sideSummary(S, ty, today), [S, ty, today]);

  if (!S.settings.setupDone) {
    return <View style={s.wrap}><Text style={s.h1}>Insights</Text><Text style={s.hint}>Bring your data across in More first.</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.h1}>Insights</Text>
      <View style={s.seg}>
        {(['day', 'month'] as const).map((v) => (
          <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: view === v }} onPress={() => setView(v)} style={[s.segB, view === v && s.segOn]}>
            <Text style={[s.segT, view === v && { color: C.fg }]}>{v === 'day' ? 'Day' : 'Pay month'}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'day' ? (
        <>
          <Stepper label={dayName(day, today)}
            onPrev={diffDays(day, today) < DAYS_BACK ? () => setDay(prevDay(day)) : undefined}
            onNext={day < today ? () => setDay(nextDay(day)) : undefined} />
          <Card style={{ gap: 6 }}>
            <Label>{isToday ? 'So far today' : 'How it went'}</Label>
            <Text style={[s.big, { color: diff >= 0 ? C.good : C.bad }]}>{moneyS(Math.abs(diff), cur)} {diff >= 0 ? (isToday ? 'left' : 'under') : 'over'}</Text>
            <Text style={s.hint}>Spent {money(di.todaySpent, cur)} of {money(Math.max(0, di.allowance), cur)} budget for the day.{!isToday && di.tomorrow !== null ? ` Next day's budget became ${money(Math.max(0, di.tomorrow), cur)}.` : ''}</Text>
            {(dayIn > 0 || dayBills > 0) && <Text style={s.hint}>{[dayIn ? `${money(dayIn, cur)} came in` : '', dayBills ? `${money(dayBills, cur)} of bills went out` : ''].filter(Boolean).join(' · ')}</Text>}
          </Card>
          {dayTx.length === 0 ? <Text style={s.hint}>Nothing logged on this day.</Text> : (
            <View style={s.list}>
              {dayTx.map((t, i) => (
                <View key={t.id} style={[s.row, i > 0 && s.sep]}>
                  <CatIcon icon={icon(t)} colour={colour(t)} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{t.merchant || (t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat))}</Text>
                    <Text style={s.meta} numberOfLines={1}>{[t.billId ? 'Bill' : t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat), t.time].join(' · ')}</Text>
                  </View>
                  <Text style={[s.amt, t.kind === 'in' && { color: C.good }]}>{t.kind === 'in' ? '+' : ''}{money(t.amt, cur)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <Stepper label={`${short(cycle.start)} to ${short(cycle.end)}`}
            onPrev={back < MONTHS_BACK ? () => setBack(back + 1) : undefined}
            onNext={back > 0 ? () => setBack(back - 1) : undefined} />
          <Card style={{ gap: 12 }}>
            <View style={s.grid}>
              <View style={s.cell}><Label>Money in</Label><Text style={[s.mid, { color: C.good }]}>{moneyS(m.pay + m.extra, cur)}</Text>
                <Text style={s.meta}>{[m.pay ? `Pay ${moneyS(m.pay, cur)}` : '', m.extra ? `other ${moneyS(m.extra, cur)}` : ''].filter(Boolean).join(', ') || 'Nothing yet'}</Text></View>
              <View style={s.cell}><Label>Bills paid</Label><Text style={s.mid}>{moneyS(m.bills, cur)}</Text></View>
              <View style={s.cell}><Label>Day to day</Label><Text style={s.mid}>{moneyS(m.spent, cur)}</Text>
                <Text style={s.meta}>of {moneyS(m.plan, cur)} to spend</Text></View>
              <View style={s.cell}><Label>{isNow ? 'Left to spend' : m.plan - m.spent >= 0 ? 'Under plan' : 'Over plan'}</Label>
                <Text style={[s.mid, { color: m.plan - m.spent >= 0 ? C.good : C.bad }]}>{moneyS(Math.abs(m.plan - m.spent), cur)}</Text></View>
            </View>
            {m.business > 0 && <Text style={s.meta}>Business income {money(m.business, cur)}, kept out of your budget.</Text>}
            {back < MONTHS_BACK && prev.days.length > 0 && (
              <Text style={s.hint}>{isNow ? `By day ${n}` : 'In total'}, that's {moneyS(Math.abs(m.spent - prevSoFar), cur)} {m.spent <= prevSoFar ? 'less' : 'more'} than the pay month before.</Text>
            )}
          </Card>

          {sideOn && (
            <Card style={{ gap: 10 }}>
              <Label>Side income</Label>
              <Text style={s.hint}>This pay month: {money(sideMonth.income, cur)} in, {money(sideMonth.costs, cur)} business costs, {money(sideMonth.drawn, cur)} paid out for you or family.</Text>
              <View style={s.grid}>
                <View style={s.cell}><Label>Profit this tax year</Label><Text style={s.mid}>{moneyS(sideYear.profit, cur)}</Text>
                  <Text style={s.meta}>Since {short(ty)}</Text></View>
                <View style={s.cell}><Label>Keep for tax</Label><Text style={[s.mid, { color: C.warn }]}>{moneyS(sideYear.tax, cur)}</Text>
                  <Text style={s.meta}>{sideYear.rate}% of profit</Text></View>
              </View>
              <Text style={[s.hint, sideYear.left < 0 && { color: C.bad }]}>
                {sideYear.left >= 0
                  ? `After tax and ${money(sideYear.drawn, cur)} paid out, ${money(sideYear.left, cur)} of side income is still free.`
                  : `You've paid out ${money(-sideYear.left, cur)} more than your side income after tax. The tax bill would come from your pay.`}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {[20, 26, 40].map((r) => <Chip key={r} label={`${r}%`} on={sideYear.rate === r} onPress={() => update((d) => { d.settings.sideTaxRate = r; })} />)}
              </View>
              <Text style={s.meta}>Rough guide: 20% basic rate, 26% once side profit passes the National Insurance threshold, 40% higher rate. Not tax advice.</Text>
            </Card>
          )}

          {n > 0 && (
            <Card style={{ gap: 10 }}>
              <Label>Each day</Label>
              <View style={s.bars}>
                {m.days.map((d) => (
                  <Pressable key={d.date} style={s.barCol} accessibilityLabel={`${short(d.date)}: spent ${money(d.spent, cur)}`} onPress={() => { setDay(d.date); setView('day'); }}>
                    <View style={[s.bar, { height: `${Math.max(2, (d.spent / maxDay) * 100)}%`, backgroundColor: d.spent <= Math.max(0, d.allowance) ? C.good : C.bad }]} />
                  </Pressable>
                ))}
              </View>
              <Text style={s.hint}>{inPlan} of {n} day{n === 1 ? '' : 's'} within budget. Tap a day to see it.</Text>
            </Card>
          )}

          {m.byCat.length > 0 && (
            <Card style={{ gap: 12 }}>
              <Label>Where it went</Label>
              {m.byCat.map((x) => {
                const c = cats.find((k) => k.id === x.cat);
                return (
                  <View key={x.cat} style={{ gap: 5 }}>
                    <View style={s.row}>
                      <CatIcon icon={c?.i || 'more'} colour={c?.c || C.muted} size={28} />
                      <Text style={[s.name, { flex: 1, fontSize: 14 }]}>{c?.n || catName(S.settings, x.cat)}</Text>
                      <Text style={[s.amt, { fontSize: 14 }]}>{money(x.amt, cur)}</Text>
                    </View>
                    <View style={s.track}><View style={[s.fill, { width: `${(x.amt / topCat) * 100}%`, backgroundColor: c?.c || C.muted }]} /></View>
                  </View>
                );
              })}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  h1: { color: C.fg, fontSize: 26, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.surface, borderRadius: 999, padding: 3 },
  segB: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  segOn: { backgroundColor: C.surface2 },
  segT: { color: C.muted, fontWeight: '700', fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  stepT: { flex: 1, textAlign: 'center', color: C.fg, fontSize: 16, fontWeight: '700' },
  big: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  mid: { color: C.fg, fontSize: 20, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  cell: { width: '50%', paddingRight: 8 },
  list: { backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  sep: { borderTopWidth: 1, borderTopColor: C.line },
  name: { color: C.fg, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { color: C.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 2 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2, minHeight: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
