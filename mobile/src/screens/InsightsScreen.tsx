// Looking back: how a single day went, and a pay month at a glance.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { cycleOf, cycleSummary, dayInfo, isSpread, sideSummary, taxYearStart } from '../engine/budget';
import { catName, categories, inName, inTypes } from '../engine/cats';
import { diffDays, nextDay, parse, prevDay } from '../engine/dates';
import { byShop, catHistory, catSpent, limitInfo, suggestLimit, type Shop } from '../engine/spending';
import { paceForecast, paceLine } from '../engine/forecast';
import { AskSheet } from './AskSheet';
import { aiAvailable } from '../ai/cloud';
import type { Tx } from '../engine/types';
import { useKitty } from '../store/KittyState';
import { Icon } from '../ui/Icon';
import { Btn, Card, CatIcon, Chip, Label, Sheet } from '../ui/kit';
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
  const [showBills, setShowBills] = useState(false);
  const [whereBy, setWhereBy] = useState<'cat' | 'shop'>('cat');
  const [allShops, setAllShops] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openShop, setOpenShop] = useState<Shop | null>(null);
  const [limitDraft, setLimitDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const cur = S.settings.currency;
  const cats = categories(S.settings), ins = inTypes(S.settings);

  const icon = (t: Tx) => t.billId ? 'receipt' : t.kind === 'in' ? (ins.find((x) => x.id === t.cat)?.i || 'wallet') : (cats.find((c) => c.id === t.cat)?.i || 'more');
  const colour = (t: Tx) => t.billId ? C.bill : t.kind === 'in' ? C.good : (cats.find((c) => c.id === t.cat)?.c || C.muted);

  // ---- Day ----
  const di = useMemo(() => dayInfo(S, day), [S, day]);
  const dayTx = useMemo(() => S.tx.filter((t) => t.date === day).sort((a, b) => a.time.localeCompare(b.time)), [S.tx, day]);
  // Money moved between your own accounts isn't money coming in, and bills never touch the daily budget, so they're kept apart
  const dayIn = dayTx.filter((t) => t.kind === 'in' && t.cat !== 'transfer').reduce((a, t) => a + t.amt, 0);
  const dayMoved = dayTx.filter((t) => t.kind === 'in' && t.cat === 'transfer').reduce((a, t) => a + t.amt, 0);
  const billTx = dayTx.filter((t) => t.kind === 'out' && t.billId), dayBills = billTx.reduce((a, t) => a + t.amt, 0);
  const spreadTx = dayTx.filter(isSpread);
  const fold = billTx.length > 1, listTx = fold ? dayTx.filter((t) => !(t.kind === 'out' && t.billId)) : dayTx;
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
  // Categories this pay month, plus any with a limit, so a limit with nothing spent yet still shows
  const limits = S.settings.catLimits || {};
  const catRows = useMemo(() => {
    const ids = new Set([...m.byCat.map((x) => x.cat), ...Object.keys(limits)]);
    return [...ids].map((cat) => ({ cat, amt: catSpent(S, cat, cycle) })).filter((x) => x.amt > 0 || limits[x.cat]).sort((a, b) => b.amt - a.amt);
  }, [S, cycle, m.byCat]); // eslint-disable-line react-hooks/exhaustive-deps
  const topCat = Math.max(1, ...catRows.map((x) => x.amt));
  const shops = useMemo(() => byShop(S, cycle), [S, cycle]);
  const topShop = shops[0]?.amt || 1;
  const hist = useMemo(() => (openCat ? catHistory(S, openCat, cycle) : null), [S, openCat, cycle]);
  const openLimit = openCat ? limits[openCat] : undefined;
  const suggested = useMemo(() => (openCat ? suggestLimit(S, openCat, today) : null), [S, openCat, today]);
  const catTx = useMemo(() => (openCat ? S.tx.filter((t) => t.kind === 'out' && !t.billId && !t.potId && !t.outside && t.cat === openCat && t.date >= cycle.start && t.date <= cycle.end)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)) : []), [S.tx, openCat, cycle]);
  const showCat = (cat: string) => { setOpenCat(cat); setLimitDraft(''); };
  const saveLimit = (cat: string, p: number | null) => update((d) => {
    const next = { ...(d.settings.catLimits || {}) };
    if (p && p > 0) next[cat] = p; else delete next[cat];
    d.settings.catLimits = next;
  });
  const draftP = Math.round(parseFloat(limitDraft.replace(/[^0-9.]/g, '')) * 100);
  const catLabel = (cat: string) => cats.find((k) => k.id === cat)?.n || catName(S.settings, cat);
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
      <View style={[s.row, { paddingVertical: 0 }]}>
        <Text style={[s.h1, { flex: 1 }]}>Insights</Text>
        {aiAvailable && <Btn label="Ask Crest" small onPress={() => setAsking(true)} />}
      </View>
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
            {spreadTx.map((t) => (
              <Text key={t.id} style={s.hint}>{t.merchant || catName(S.settings, t.cat)} ({money(t.amt, cur)}) is spread over the {di.daysLeft} {di.daysLeft === 1 ? 'day' : 'days'} left in the pay month, about {money(Math.round(t.amt / di.daysLeft), cur)} a day.</Text>
            ))}
            {(dayIn > 0 || dayBills > 0 || dayMoved > 0) && <Text style={s.hint}>{[dayIn ? `${money(dayIn, cur)} came in` : '', dayMoved ? `${money(dayMoved, cur)} moved between your accounts` : '', dayBills ? `${money(dayBills, cur)} of bills went out` : ''].filter(Boolean).join(' · ')}</Text>}
          </Card>
          {dayTx.length === 0 ? <Text style={s.hint}>Nothing logged on this day.</Text> : (
            <View style={s.list}>
              {[...listTx, ...(fold && showBills ? billTx : [])].map((t, i) => (
                <View key={t.id} style={[s.row, i > 0 && s.sep]}>
                  <CatIcon icon={icon(t)} colour={colour(t)} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{t.merchant || (t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat))}</Text>
                    <Text style={s.meta} numberOfLines={1}>{[t.billId ? 'Bill' : t.kind === 'in' ? inName(t.cat) : catName(S.settings, t.cat), t.time].join(' · ')}</Text>
                  </View>
                  <Text style={[s.amt, t.kind === 'in' && { color: C.good }]}>{t.kind === 'in' ? '+' : ''}{money(t.amt, cur)}</Text>
                </View>
              ))}
              {fold && (
                <Pressable accessibilityRole="button" accessibilityLabel={showBills ? 'Hide bills' : 'Show bills'} onPress={() => setShowBills(!showBills)}
                  style={[s.row, (listTx.length > 0 || showBills) && s.sep]}>
                  <CatIcon icon="receipt" colour={C.bill} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{billTx.length} bills</Text>
                    <Text style={s.meta} numberOfLines={1}>{showBills ? 'Hide' : 'Paid from bill money, not your daily budget'}</Text>
                  </View>
                  <Text style={s.amt}>{money(dayBills, cur)}</Text>
                </Pressable>
              )}
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
              <View style={s.cell}><Label>Money in</Label><Text style={[s.mid, { color: C.good }]}>{moneyS(m.pay + m.extra + m.business, cur)}</Text>
                <Text style={s.meta}>{[m.pay ? `Pay ${moneyS(m.pay, cur)}` : '', m.business ? `side income ${moneyS(m.business, cur)}` : '', m.extra ? `other ${moneyS(m.extra, cur)}` : ''].filter(Boolean).join(', ') || 'Nothing yet'}</Text></View>
              <View style={s.cell}><Label>Bills paid</Label><Text style={s.mid}>{moneyS(m.bills, cur)}</Text></View>
              <View style={s.cell}><Label>Day to day</Label><Text style={s.mid}>{moneyS(m.spent, cur)}</Text>
                <Text style={s.meta}>of {moneyS(m.plan, cur)} to spend</Text></View>
              <View style={s.cell}><Label>{isNow ? 'Left to spend' : m.plan - m.spent >= 0 ? 'Under plan' : 'Over plan'}</Label>
                <Text style={[s.mid, { color: m.plan - m.spent >= 0 ? C.good : C.bad }]}>{moneyS(Math.abs(m.plan - m.spent), cur)}</Text></View>
            </View>
            {isNow && (() => {
              const p = paceForecast(S, today);
              return p ? <Text style={[s.hint, { color: p.endLeft >= 0 ? C.fg : C.warn }]}>{paceLine(p, (x) => moneyS(x, cur), (d) => parse(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }))}</Text>
                : <Text style={s.meta}>After the first week of the pay month, Crest says where it's heading at your usual pace.</Text>;
            })()}
            {m.business > 0 && <Text style={s.meta}>Side income counts towards what you have to spend, less {money(sideMonth.tax, cur)} kept back for tax.</Text>}
            {back < MONTHS_BACK && prev.days.length > 0 && (
              <Text style={s.hint}>{isNow ? `By day ${n}` : 'In total'}, that's {moneyS(Math.abs(m.spent - prevSoFar), cur)} {m.spent <= prevSoFar ? 'less' : 'more'} than the pay month before.</Text>
            )}
          </Card>

          {sideOn && (
            <Card style={{ gap: 10 }}>
              <Label>Side income</Label>
              <Text style={s.hint}>This pay month: {money(sideMonth.income, cur)} in, {money(sideMonth.costs, cur)} business costs. Side income counts in your daily budget, less {money(sideMonth.tax, cur)} kept back for tax.</Text>
              <View style={s.grid}>
                <View style={s.cell}><Label>Profit this tax year</Label><Text style={s.mid}>{moneyS(sideYear.profit, cur)}</Text>
                  <Text style={s.meta}>Since {short(ty)}</Text></View>
                <View style={s.cell}><Label>Keep for tax</Label><Text style={[s.mid, { color: C.warn }]}>{moneyS(sideYear.tax, cur)}</Text>
                  <Text style={s.meta}>{sideYear.rate}% of profit</Text></View>
              </View>
              <Text style={s.hint}>
                {sideYear.profit <= 0
                  ? `The business has spent ${money(-sideYear.profit, cur)} more than it made since ${short(ty)}. No tax to keep back yet.`
                  : `Crest keeps ${sideYear.rate}% of your side income profit out of your daily budget, so the tax bill is covered when it comes. Since ${short(ty)} that's ${money(sideYear.tax, cur)}.`}
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

          {(catRows.length > 0 || shops.length > 0) && (
            <Card style={{ gap: 12 }}>
              <View style={[s.row, { paddingVertical: 0 }]}>
                <View style={{ flex: 1 }}><Label>Where it went</Label></View>
                <View style={s.seg}>
                  {(['cat', 'shop'] as const).map((k) => (
                    <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: whereBy === k }} onPress={() => setWhereBy(k)} style={[s.segB, { paddingVertical: 5, paddingHorizontal: 12 }, whereBy === k && s.segOn]}>
                      <Text style={[s.segT, whereBy === k && { color: C.fg }]}>{k === 'cat' ? 'Categories' : 'Shops'}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {whereBy === 'cat' ? catRows.map((x) => {
                const c = cats.find((k) => k.id === x.cat), lim = limits[x.cat];
                const pace = lim && isNow ? limitInfo(S, x.cat, today)?.pace : lim && x.amt > lim ? 'over' : 'ok';
                const barC = !lim ? c?.c || C.muted : pace === 'over' ? C.bad : pace === 'fast' ? C.warn : c?.c || C.muted;
                return (
                  <Pressable key={x.cat} style={{ gap: 5 }} accessibilityRole="button" accessibilityLabel={`${c?.n || x.cat}: ${money(x.amt, cur)}${lim ? ` of ${money(lim, cur)}` : ''}`} onPress={() => showCat(x.cat)}>
                    <View style={s.row}>
                      <CatIcon icon={c?.i || 'more'} colour={c?.c || C.muted} size={28} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.name, { fontSize: 14 }]} numberOfLines={1}>{c?.n || catName(S.settings, x.cat)}</Text>
                        {!!lim && (
                          <Text style={[s.meta, pace === 'over' && { color: C.bad }, pace === 'fast' && { color: C.warn }]} numberOfLines={1}>
                            {x.amt > lim ? `${money(x.amt - lim, cur)} over its ${moneyS(lim, cur)} limit` : `${money(lim - x.amt, cur)} left of ${moneyS(lim, cur)}`}{pace === 'fast' ? ' · Running fast' : ''}
                          </Text>
                        )}
                      </View>
                      <Text style={[s.amt, { fontSize: 14 }]}>{money(x.amt, cur)}</Text>
                    </View>
                    <View style={s.track}><View style={[s.fill, { width: `${Math.min(100, (x.amt / (lim || topCat)) * 100)}%`, backgroundColor: barC }]} /></View>
                  </Pressable>
                );
              }) : (
                <>
                  {(allShops ? shops : shops.slice(0, 12)).map((x) => {
                    const c = cats.find((k) => k.id === x.cat);
                    return (
                      <Pressable key={x.key} style={{ gap: 5 }} accessibilityRole="button" accessibilityLabel={`${x.name || c?.n}: ${money(x.amt, cur)}`} onPress={() => setOpenShop(x)}>
                        <View style={s.row}>
                          <CatIcon icon={c?.i || 'more'} colour={c?.c || C.muted} size={28} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[s.name, { fontSize: 14 }]} numberOfLines={1}>{x.name || `${c?.n || 'Other'}, no name`}</Text>
                            <Text style={s.meta}>{x.n} payment{x.n === 1 ? '' : 's'}</Text>
                          </View>
                          <Text style={[s.amt, { fontSize: 14 }]}>{money(x.amt, cur)}</Text>
                        </View>
                        <View style={s.track}><View style={[s.fill, { width: `${(x.amt / topShop) * 100}%`, backgroundColor: c?.c || C.muted }]} /></View>
                      </Pressable>
                    );
                  })}
                  {shops.length > 12 && <Btn label={allShops ? 'Show fewer' : `Show all ${shops.length}`} small onPress={() => setAllShops(!allShops)} />}
                </>
              )}
              <Text style={s.meta}>Day-to-day spending. Bills, pots and anything paid from savings are left out. Tap one to see more{whereBy === 'cat' ? ' or set a limit' : ''}.</Text>
            </Card>
          )}
        </>
      )}

      <Sheet open={!!openCat} onClose={() => setOpenCat(null)} title={openCat ? catLabel(openCat) : ''}>
        {openCat && hist && (() => {
          const maxH = Math.max(1, ...hist.months.map((x) => x.amt), hist.avg || 0, openLimit || 0);
          const li = isNow && openLimit ? limitInfo(S, openCat, today) : null;
          const colourC = cats.find((k) => k.id === openCat)?.c || C.gold;
          return (
            <>
              <View>
                <Text style={s.meta}>{isNow ? 'This pay month so far' : `${short(cycle.start)} to ${short(cycle.end)}`}</Text>
                <Text style={[s.big, { color: C.fg }]}>{money(hist.months[hist.months.length - 1].amt, cur)}</Text>
              </View>
              <View style={s.hBars}>
                {hist.avg !== null && hist.avg > 0 && <View style={[s.hLine, { bottom: `${(hist.avg / maxH) * 100}%`, borderColor: C.muted }]} />}
                {!!openLimit && <View style={[s.hLine, { bottom: `${(openLimit / maxH) * 100}%`, borderColor: C.gold }]} />}
                {hist.months.map((x, i) => (
                  <View key={x.c.start} style={s.hCol}>
                    <View style={[s.hBar, { height: `${Math.max(1, (x.amt / maxH) * 100)}%`, backgroundColor: i === hist.months.length - 1 ? colourC : C.faint }]} />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row' }}>
                {hist.months.map((x) => <Text key={x.c.start} style={[s.meta, { flex: 1, textAlign: 'center' }]}>{short(x.c.start)}</Text>)}
              </View>
              <Text style={s.hint}>
                {hist.avg === null ? 'Crest needs one full pay month of yours before it can say what is usual here.'
                  : `Usually ${money(hist.avg, cur)} a pay month (grey line${openLimit ? ', your limit is the gold one' : ''}).`}
              </Text>

              <Label>Limit</Label>
              {openLimit && !limitDraft ? (
                <>
                  <Text style={s.hint}>
                    {money(openLimit, cur)} a pay month.{li ? ` ${li.left >= 0 ? `${money(li.left, cur)} left` : `${money(-li.left, cur)} over`}, ${li.daysLeft} day${li.daysLeft === 1 ? '' : 's'} to go.${li.pace === 'fast' ? ' At this rate it will run out before payday.' : ''}` : ''}
                  </Text>
                  <View style={[s.row, { justifyContent: 'flex-end', paddingVertical: 0 }]}>
                    <Btn label="Remove" small onPress={() => saveLimit(openCat, null)} />
                    <Btn label="Change" small onPress={() => setLimitDraft(String(openLimit / 100))} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.hint}>Optional. Your daily figure stays the main number; a limit just tells you when this category is eating into it. It also shows in the morning message.</Text>
                  <View style={[s.row, { paddingVertical: 0 }]}>
                    <TextInput value={limitDraft} onChangeText={setLimitDraft} keyboardType="decimal-pad" placeholder="Amount a pay month" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Limit a pay month" />
                    <Btn label="Save" primary small disabled={!(draftP > 0)} onPress={() => { saveLimit(openCat, draftP); setLimitDraft(''); }} />
                  </View>
                  {suggested !== null && <View style={{ flexDirection: 'row' }}><Chip label={`Usual: ${moneyS(suggested, cur)}`} onPress={() => setLimitDraft(String(suggested / 100))} /></View>}
                </>
              )}

              {catTx.length > 0 && <Label>{isNow ? 'This pay month' : 'That pay month'}</Label>}
              <View style={s.list}>
                {catTx.map((t, i) => (
                  <View key={t.id} style={[s.row, i > 0 && s.sep]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.name} numberOfLines={1}>{t.merchant || catLabel(t.cat)}</Text>
                      <Text style={s.meta}>{short(t.date)}{t.bank ? ` · ${t.bank}` : ''}</Text>
                    </View>
                    <Text style={s.amt}>{money(t.amt, cur)}</Text>
                  </View>
                ))}
              </View>
            </>
          );
        })()}
      </Sheet>

      <AskSheet open={asking} onClose={() => setAsking(false)} />

      <Sheet open={!!openShop} onClose={() => setOpenShop(null)} title={openShop?.name || 'No name'}>
        {openShop && (
          <>
            <Text style={s.hint}>{money(openShop.amt, cur)} over {openShop.n} payment{openShop.n === 1 ? '' : 's'} {isNow ? 'this pay month' : `from ${short(cycle.start)} to ${short(cycle.end)}`}.</Text>
            <View style={s.list}>
              {[...openShop.tx].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).map((t, i) => (
                <View key={t.id} style={[s.row, i > 0 && s.sep]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{short(t.date)}, {t.time}</Text>
                    <Text style={s.meta}>{[catLabel(t.cat), t.bank].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text style={s.amt}>{money(t.amt, cur)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Sheet>
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
  hBars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 12, position: 'relative' },
  hCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  hBar: { borderRadius: 6, minHeight: 2 },
  hLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed', zIndex: 1 },
  field: { flex: 1, backgroundColor: C.surface2, color: C.fg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  fill: { height: '100%', borderRadius: 3 },
});
