// Looking ahead: bills for this period, and pots for things you're saving towards.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { billItems, debtFree, debtTip, monthlyRate, payTx, type BillItem } from '../engine/bills';
import { owedHistory, owedNow } from '../engine/debts';
import { cycleOf, fixedFor, isMonthly, potBalance, safeInfo } from '../engine/budget';
import { diffDays, hm, nextDay, parse } from '../engine/dates';
import type { Bill, Overdraft, Pot, Tx } from '../engine/types';
import { uid, useKitty } from '../store/KittyState';
import { Icon } from '../ui/Icon';
import { Btn, Card, CatIcon, Chip, Label, Sheet } from '../ui/kit';
import { GradientCard } from '../ui/Glow';
import { CountUp, GrowBar } from '../ui/motion';
import { C, G, money, moneyS, symbol } from '../ui/theme';

const ord = (n: number) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const pence = (s: string) => { const v = Math.round(parseFloat((s || '').replace(/[^0-9.]/g, '')) * 100); return v > 0 ? v : 0; };
const pounds = (p?: number | null) => (p ? (p / 100).toFixed(p % 100 ? 2 : 0) : '');
const dfmt = (d: string) => parse(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const monthLabel = (d: string) => parse(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const TYPES: { id: Bill['type']; n: string; i: string }[] = [{ id: 'bill', n: 'Bill', i: 'receipt' }, { id: 'sub', n: 'Subscription', i: 'calendar' }, { id: 'debt', n: 'Debt repayment', i: 'credit' }];

type BillForm = { id: string | null; name: string; amt: string; day: number; type: Bill['type']; dd: boolean; balance: string; rate: string; biz: boolean };
type OdForm = { id: string | null; name: string; used: string; rate: string };
type PotForm = { id: string | null; name: string; perPay: string; target: string; balance: string; fromNext: boolean };

export function PlanScreen({ onDone, openMore }: { onDone: (msg: string, undo?: () => void) => void; openMore: () => void }) {
  const { S, today, update } = useKitty();
  const [view, setView] = useState<'bills' | 'debts' | 'pots'>('bills');
  const [of, setOf] = useState<OdForm | null>(null);
  const [bf, setBf] = useState<BillForm | null>(null);
  const [pf, setPf] = useState<PotForm | null>(null);
  const [topUp, setTopUp] = useState<{ pot: Pot; amt: string } | null>(null);
  const cur = S.settings.currency, now = () => hm(new Date());

  // ---- Bills ----
  const { w, items, total, paidTotal } = billItems(S, today);
  const dueNow = items.filter((i) => !i.paid && i.due <= today), later = items.filter((i) => !i.paid && i.due > today), done = items.filter((i) => i.paid);
  const debts = S.bills.filter((b) => b.type === 'debt'), subs = S.bills.filter((b) => b.type === 'sub');
  const tip = debtTip(S, today);
  const owed = owedNow(S, today), owedTrend = owedHistory(S, today);
  const kShort = (p: number) => (p >= 100000 ? `${symbol(cur)}${(p / 100000).toFixed(1).replace(/\.0$/, '')}k` : moneyS(p, cur));
  const ods = S.overdrafts || [];
  const saveOd = () => {
    if (!of || !of.name.trim()) return;
    const f = of, used = pence(f.used), at = `${today} ${now()}`, rate = parseFloat(f.rate.replace('%', ''));
    update((d) => {
      d.overdrafts = d.overdrafts || [];
      let o = f.id ? d.overdrafts.find((x) => x.id === f.id) : undefined;
      if (!o) { o = { id: 'o' + uid(), name: '', used: 0, at, history: [] }; d.overdrafts.push(o); }
      // A new figure for today replaces one already entered today, so the trend keeps one point a day
      if (o.used !== used || !o.history.length) { o.history = [...o.history.filter((h) => h.at.slice(0, 10) !== today), { at, used }]; o.used = used; o.at = at; }
      o.name = f.name.trim();
      o.rate = rate > 0 && rate < 1000 ? rate : null;
    });
    setOf(null);
    onDone(f.id ? 'Overdraft updated' : `${f.name.trim()} added`);
  };
  const deleteOd = () => {
    if (!of?.id) return;
    const old = ods.find((o) => o.id === of.id) as Overdraft;
    update((d) => { d.overdrafts = (d.overdrafts || []).filter((o) => o.id !== old.id); });
    setOf(null);
    onDone(`${old.name} removed`, () => update((d) => { d.overdrafts = [...(d.overdrafts || []), old]; }));
  };
  const subsM = subs.reduce((a, b) => a + b.amt, 0), monthly = isMonthly(S.settings), c = cycleOf(today, S.settings);

  const pay = (list: Bill[]) => {
    const txs = list.map((b) => payTx(b, uid(), today, now()));
    update((d) => { d.tx.push(...txs); });
    const ids = new Set(txs.map((t) => t.id));
    onDone(list.length === 1 ? `${list[0].name} marked paid` : `${list.length} bills marked paid`, () => update((d) => { d.tx = d.tx.filter((t) => !ids.has(t.id)); }));
  };
  const unpay = (b: Bill) => {
    const gone = S.tx.filter((x) => x.billId === b.id && x.date >= w.start && x.date <= w.end), had = (S.settings.prepaid || {})[b.id], key = `${b.id}:${w.start}`;
    update((d) => {
      const ids = new Set(gone.map((g) => g.id));
      d.tx = d.tx.filter((x) => !ids.has(x.id));
      if (had === w.start && d.settings.prepaid) delete d.settings.prepaid[b.id];
      d.settings.ddSkip = { ...(d.settings.ddSkip || {}), [key]: true };
    });
    onDone('Marked unpaid', () => update((d) => {
      d.tx.push(...gone);
      if (had === w.start) d.settings.prepaid = { ...(d.settings.prepaid || {}), [b.id]: had };
      if (d.settings.ddSkip) delete d.settings.ddSkip[key];
    }));
  };
  const editBill = (b?: Bill) => setBf(b
    ? { id: b.id, name: b.name, amt: pounds(b.amt), day: b.day, type: b.type, dd: !!b.dd, balance: pounds(b.balance), rate: b.rate ? String(b.rate) : '', biz: !!b.biz }
    : { id: null, name: '', amt: '', day: 1, type: 'bill', dd: true, balance: '', rate: '', biz: false });
  const saveBill = () => {
    if (!bf || !bf.name.trim() || !pence(bf.amt)) return;
    const f = bf, bal = pence(f.balance);
    update((d) => {
      let b = f.id ? d.bills.find((x) => x.id === f.id) : undefined;
      if (!b) { b = { id: 'b' + uid(), name: '', amt: 0, day: 1, type: 'bill', ddFrom: today }; d.bills.push(b); }
      const balChanged = (b.balance || 0) !== bal;
      Object.assign(b, { name: f.name.trim(), amt: pence(f.amt), day: f.day, type: f.type, dd: f.dd, biz: f.biz,
        sub: f.type === 'sub' ? 'Subscription' : f.type === 'debt' ? 'Debt repayment' : f.name.trim() });
      if (f.dd && !b.ddFrom) b.ddFrom = today;
      if (f.type === 'debt' && balChanged) {
        // Keep the earlier figure as a point in the debt's history, so the trend in Debts survives a correction
        const hist = [...(b.history || [])];
        if (b.balance && b.balanceAt && !hist.some((h) => h.at === b.balanceAt)) hist.push({ at: b.balanceAt, left: b.balance });
        b.balance = bal || null; b.balanceAt = bal ? `${today} ${now()}` : null;
        if (bal) hist.push({ at: b.balanceAt as string, left: bal });
        b.history = hist;
      }
      const rate = parseFloat(f.rate.replace('%', ''));
      b.rate = f.type === 'debt' && rate > 0 && rate < 1000 ? rate : null;
      const id = b.id;
      for (const t of d.tx) if (t.billId === id) t.biz = f.biz;
    });
    setBf(null);
    onDone(f.id ? 'Bill updated' : `${f.name.trim()} added`);
  };
  const deleteBill = () => {
    if (!bf?.id) return;
    const old = S.bills.find((b) => b.id === bf.id) as Bill, idx = S.bills.indexOf(old);
    update((d) => { d.bills = d.bills.filter((b) => b.id !== old.id); });
    setBf(null);
    onDone(`${old.name} removed. Past payments stay in Activity`, () => update((d) => { d.bills.splice(idx, 0, old); }));
  };

  const BillRow = ({ i }: { i: BillItem }) => {
    const n = diffDays(today, i.due), b = i.b;
    const line = i.paid ? (i.paid.pre ? 'Paid before you started' : `Paid ${dfmt(i.paid.date)}${i.paid.auto ? ' · Direct Debit' : ''}`)
      : n < 0 ? `Overdue by ${-n} day${n === -1 ? '' : 's'}` : n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due in ${n} days`;
    const kind = [b.biz ? 'Business' : '', b.type === 'sub' ? 'Subscription' : b.type === 'debt' ? 'Debt' : ''].filter(Boolean).join(' · ');
    return (
      <View style={s.brow}>
        <View style={s.dbox}><Text style={s.dboxN}>{parse(i.due).getDate()}</Text><Text style={s.dboxM}>{parse(i.due).toLocaleDateString('en-GB', { month: 'short' })}</Text></View>
        <Pressable style={{ flex: 1, minWidth: 0 }} accessibilityRole="button" accessibilityLabel={`Edit ${b.name}`} onPress={() => editBill(b)}>
          <Text style={[s.name, i.paid && { color: C.muted }]} numberOfLines={1}>{b.name}</Text>
          <Text style={[s.meta, !i.paid && n < 0 && { color: C.bad }, !i.paid && n >= 0 && n <= 3 && !b.dd && { color: C.warn }]} numberOfLines={1}>{[kind, line].filter(Boolean).join(' · ')}</Text>
        </Pressable>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[s.amt, i.paid && { color: C.muted }]}>{money(b.amt, cur)}</Text>
          {i.paid ? <Pressable accessibilityRole="button" accessibilityLabel={`${b.name} paid. Tap to undo`} onPress={() => unpay(b)} style={s.paidTag}><Icon name="check" size={12} colour={C.good} /><Text style={[s.tagT, { color: C.good }]}>Paid</Text></Pressable>
            : b.dd && n > 0 ? <Text style={s.autoT}>Auto-pays</Text>
            : <Pressable accessibilityRole="button" onPress={() => pay([b])} style={s.payBtn}><Text style={s.tagT}>Mark paid</Text></Pressable>}
        </View>
      </View>
    );
  };
  const Section = ({ title, list, extra }: { title: string; list: BillItem[]; extra?: ReactNode }) => list.length ? (
    <View style={{ gap: 6 }}>
      <View style={s.ghd}><Label>{title}</Label>{extra}</View>
      <View style={s.list}>{list.map((i, k) => <View key={i.b.id} style={k > 0 && s.sep}><BillRow i={i} /></View>)}</View>
    </View>
  ) : null;

  // ---- Pots ----
  const pots = S.pots.filter((p) => !p.closed);
  const editPot = (p?: Pot) => setPf(p
    ? { id: p.id, name: p.name, perPay: pounds(p.perPay), target: pounds(p.target), balance: (potBalance(S, p.id, today) / 100).toFixed(2), fromNext: false }
    : { id: null, name: '', perPay: '', target: '', balance: '', fromNext: diffDays(c.start, today) > 0 });
  const savePot = () => {
    if (!pf || !pf.name.trim()) return;
    const f = pf;
    update((d) => {
      if (f.id) {
        const p = d.pots.find((x) => x.id === f.id);
        if (!p) return;
        const before = potBalance(d, p.id, today);
        Object.assign(p, { name: f.name.trim(), perPay: pence(f.perPay), target: pence(f.target) });
        p.opening = (p.opening || 0) + (Math.round(parseFloat(f.balance || '0') * 100) - before);
      } else {
        d.pots.push({ id: 'p' + uid(), name: f.name.trim(), perPay: pence(f.perPay), target: pence(f.target), opening: pence(f.balance), start: f.fromNext ? nextDay(c.end) : c.start });
      }
    });
    setPf(null);
    onDone(f.id ? 'Pot updated' : `${f.name.trim()} pot created`);
  };
  const closePot = () => {
    if (!pf?.id) return;
    const p = S.pots.find((x) => x.id === pf.id) as Pot, bal = potBalance(S, p.id, today);
    const back: Tx | null = bal > 0 ? { id: uid(), kind: 'in', amt: bal, cat: 'savings', sub: 'Pot closed', merchant: p.name, note: '', date: today, time: now(), biz: false, billId: null, potOut: p.id } : null;
    update((d) => {
      const x = d.pots.find((q) => q.id === p.id);
      if (x) { x.closed = today; x.end = nextDay(c.end); }
      if (back) d.tx.push(back);
    });
    setPf(null);
    onDone(bal > 0 ? `${p.name} closed. ${moneyS(bal, cur)} back to spend` : `${p.name} closed`, () => update((d) => {
      const x = d.pots.find((q) => q.id === p.id);
      if (x) { delete x.closed; delete x.end; }
      if (back) d.tx = d.tx.filter((t) => t.id !== back.id);
    }));
  };
  const doTopUp = () => {
    if (!topUp || !pence(topUp.amt)) return;
    const p = topUp.pot, t: Tx = { id: uid(), kind: 'out', amt: pence(topUp.amt), cat: 'other', sub: 'Moved to pot', merchant: p.name, note: '', date: today, time: now(), biz: false, billId: null, potIn: p.id };
    update((d) => { d.tx.push(t); });
    setTopUp(null);
    onDone(`${money(t.amt, cur)} added to ${p.name}`, () => update((d) => { d.tx = d.tx.filter((x) => x.id !== t.id); }));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.wrap}>
        <View style={s.head}>
          <Text style={s.h1}>Plan</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings and backups" onPress={openMore} style={s.iconBtn}><Icon name="sliders" size={20} colour={C.fg} /></Pressable>
        </View>
        <View style={s.seg}>
          {(['bills', 'debts', 'pots'] as const).map((v) => (
            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: view === v }} onPress={() => setView(v)} style={[s.segB, view === v && s.segOn]}>
              <Text style={[s.segT, view === v && { color: C.fg }]}>{v === 'bills' ? 'Bills' : v === 'debts' ? 'Debts' : 'Pots'}</Text>
            </Pressable>
          ))}
        </View>

        {view === 'bills' ? (
          <>
            <Card style={{ gap: 8 }}>
              <Label>Still to pay {dfmt(w.start)} to {dfmt(w.end)}</Label>
              <Text style={s.big}>{moneyS(total - paidTotal, cur)}</Text>
              <GrowBar to={total ? paidTotal / total : 0} colour={C.bill} height={8} track={C.track} />
              <Text style={s.hint}>{moneyS(paidTotal, cur)} of {moneyS(total, cur)} paid. {monthly ? 'Bills come off on payday, so they never eat into your daily budget.' : `Crest sets aside ${moneyS(fixedFor(S, c), cur)} from each pay for these, so they never eat into your daily budget.`}</Text>
            </Card>
            {items.length === 0 && <Card><Text style={s.hint}>No bills yet. Add rent, council tax and subscriptions so your daily budget is honest.</Text></Card>}
            <Section title="Due now" list={dueNow} extra={dueNow.length > 1 ? <Pressable accessibilityRole="button" onPress={() => pay(dueNow.map((i) => i.b))}><Text style={s.link}>Mark all {dueNow.length} paid</Text></Pressable> : undefined} />
            <Section title="Coming up" list={later} />
            {dueNow.length === 0 && later.length === 0 && items.length > 0 && (() => {
              // Everything's paid: show what comes off on payday, so it's no surprise
              const nx = billItems(S, nextDay(w.end)), first = nx.items.slice(0, 6);
              return (
                <Card style={{ gap: 8 }}>
                  <Label>After payday</Label>
                  <Text style={s.hint}>All paid for this {monthly ? 'pay month' : 'month'}. From {dfmt(nx.w.start)}, <Text style={{ color: C.fg, fontWeight: '700' }}>{moneyS(nx.total, cur)}</Text> of bills come round again.</Text>
                  {first.map((i) => (
                    <View key={i.b.id} style={[s.ghd, { paddingVertical: 2 }]}>
                      <Text style={[s.meta, { flex: 1, color: C.fg, marginTop: 0 }]} numberOfLines={1}>{i.b.name}</Text>
                      <Text style={[s.meta, { marginTop: 0, width: 56, textAlign: 'right' }]}>{dfmt(i.due)}</Text>
                      <Text style={[s.meta, { marginTop: 0, width: 84, textAlign: 'right', color: C.fg, fontWeight: '700' }]}>{money(i.b.amt, cur)}</Text>
                    </View>
                  ))}
                  {nx.items.length > first.length && <Text style={s.meta}>and {nx.items.length - first.length} more</Text>}
                </Card>
              );
            })()}
            {(debts.length > 0 || ods.length > 0) && (
              <Pressable accessibilityRole="button" onPress={() => setView('debts')}>
                <Card style={{ gap: 4 }}>
                  <Label>Debts</Label>
                  <Text style={s.hint}>You owe <Text style={{ color: C.fg, fontWeight: '700' }}>{moneyS(owed.total, cur)}</Text>{owed.missing ? ` plus ${owed.missing} without a balance` : ''}. <Text style={s.link}>See debts</Text></Text>
                </Card>
              </Pressable>
            )}
            {subs.length > 0 && <Card><Text style={s.hint}>{subs.length} subscription{subs.length === 1 ? '' : 's'}: {money(subsM, cur)} a month is <Text style={{ color: C.fg, fontWeight: '700' }}>{moneyS(subsM * 12, cur)}</Text> a year.</Text></Card>}
            <Section title={monthly ? 'Paid this pay month' : 'Paid this month'} list={done} />
            <Btn label="Add a bill" onPress={() => editBill()} />
          </>
        ) : view === 'debts' ? (
          <>
            <GradientCard colours={G.owe} glow={C.warn} style={{ padding: 16, gap: 8 }}>
              <Label>You owe</Label>
              <CountUp value={owed.total} format={(x) => money(x, cur)} style={[s.big, owed.total > 0 && { color: C.warn }]} />
              {owedTrend.length >= 2 && (() => {
                const first = owedTrend[0], ch = owed.total - first.total;
                return ch === 0 ? <Text style={s.hint}>The same as on {dfmt(first.date)}.</Text>
                  : <Text style={[s.hint, { color: ch < 0 ? C.good : C.bad }]}>{moneyS(Math.abs(ch), cur)} {ch < 0 ? 'less' : 'more'} than on {dfmt(first.date)}</Text>;
              })()}
              <Text style={s.hint}>
                {owed.never.length ? `At these payments, ${owed.never.join(' and ')} won't clear: the payment doesn't cover the interest.`
                  : owed.by ? `Cards and loans clear by ${monthLabel(owed.by)} at these payments.` : ''}
                {owed.missing ? ` ${owed.missing} debt${owed.missing === 1 ? " has" : 's have'} no balance yet: tap to add it.` : ''}
              </Text>
            </GradientCard>
            {owedTrend.length >= 2 && (() => {
              const top = Math.max(1, ...owedTrend.map((p) => p.total));
              return (
                <Card style={{ gap: 8 }}>
                  <Label>Total owed</Label>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {owedTrend.map((p) => <Text key={p.date} style={[s.meta, { flex: 1, textAlign: 'center', fontSize: 11 }]} numberOfLines={1}>{kShort(p.total)}</Text>)}
                  </View>
                  <View style={s.tBars}>
                    {owedTrend.map((p, i) => (
                      <View key={p.date} style={s.tCol}>
                        <View style={[s.tBar, { height: `${Math.max(2, (p.total / top) * 100)}%`, backgroundColor: i === owedTrend.length - 1 ? C.warn : C.faint }]} />
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {owedTrend.map((p, i) => <Text key={p.date} style={[s.meta, { flex: 1, textAlign: 'center' }]}>{i === owedTrend.length - 1 ? 'Now' : dfmt(p.date)}</Text>)}
                  </View>
                  <Text style={s.meta}>At the start of each pay month. Payments to cards and loans count as they go out; overdrafts move when you update them.</Text>
                </Card>
              );
            })()}
            {debts.length > 0 && (
              <Card style={{ gap: 10 }}>
                <Label>Cards and loans</Label>
                {debts.map((b) => {
                  const f = debtFree(S, b, today);
                  const about = (n: number) => moneyS(Math.round(n / 100) * 100, cur);
                  const line = f === null ? 'Add the balance for a payoff date'
                    : f.left === 0 ? 'Paid off'
                    : f.never ? `${moneyS(f.left, cur)} left. ${moneyS(b.amt, cur)} a month doesn't cover the interest (about ${about(f.monthlyInterest)}), so it won't go down`
                    : b.rate ? `${moneyS(f.left, cur)} left at ${b.rate}% · clear by ${monthLabel(f.by as string)} · about ${about(f.interest)} interest`
                    : `${moneyS(f.left, cur)} left · clear by ${monthLabel(f.by as string)} before interest`;
                  return (
                    <Pressable key={b.id} style={s.row} onPress={() => editBill(b)} accessibilityRole="button">
                      <CatIcon icon="credit" colour={C.warn} size={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{b.name}</Text>
                        <Text style={[s.meta, f?.never && { color: C.warn }]}>{line}</Text>
                      </View>
                      <Text style={s.amt}>{moneyS(b.amt, cur)}/mo</Text>
                    </Pressable>
                  );
                })}
                {tip && <Text style={[s.hint, { color: C.fg }]}>{tip.kind === 'move'
                  ? `When ${tip.from.name} is paid off in ${monthLabel(tip.fromBy)}, putting its ${moneyS(tip.extra, cur)} a month into ${tip.to.name} would clear it by ${monthLabel(tip.by)}${tip.saved ? ` and save about ${moneyS(Math.round(tip.saved / 100) * 100, cur)} in interest` : ''}.`
                  : `${moneyS(tip.pay, cur)} a month would clear ${tip.to.name} in ${tip.years} years.`}</Text>}
                {debts.some((b) => b.balance && !b.rate) && <Text style={s.meta}>Dates without a rate leave out interest. Tap a debt to add its rate: your lender's app or statement shows it.</Text>}
              </Card>
            )}
            <Btn label="Add a card or loan" onPress={() => setBf({ id: null, name: '', amt: '', day: 1, type: 'debt', dd: true, balance: '', rate: '', biz: false })} />
            <Card style={{ gap: 10 }}>
              <Label>Overdrafts</Label>
              {ods.length === 0 && <Text style={s.hint}>Add an overdraft you're using, with how much of it is used. Update it now and then and Crest shows the trend.</Text>}
              {ods.map((o) => {
                const mi = Math.round(o.used * monthlyRate(o.rate));
                return (
                  <Pressable key={o.id} style={s.row} accessibilityRole="button" onPress={() => setOf({ id: o.id, name: o.name, used: pounds(o.used), rate: o.rate ? String(o.rate) : '' })}>
                    <CatIcon icon="wallet" colour={C.warn} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{o.name}</Text>
                      <Text style={s.meta}>{o.rate ? `${o.rate}% a year · about ${moneyS(mi, cur)} a month in interest` : 'Add its rate to see the interest'} · updated {dfmt(o.at.slice(0, 10))}</Text>
                    </View>
                    <Text style={s.amt}>{moneyS(o.used, cur)}</Text>
                  </Pressable>
                );
              })}
            </Card>
            <Btn label="Add an overdraft" onPress={() => setOf({ id: null, name: '', used: '', rate: '' })} />
          </>
        ) : (
          <>
            {pots.length === 0 && (
              <Card style={{ gap: 8 }}>
                <Text style={s.name}>Save towards something</Text>
                <Text style={s.hint}>A pot puts money aside each payday for things like Christmas, car repairs or a holiday. It comes off your daily budget on payday, and spending from a pot later doesn't touch your daily budget.</Text>
              </Card>
            )}
            {pots.map((p) => {
              const bal = potBalance(S, p.id, today), started = p.start <= today;
              return (
                <Card key={p.id} style={{ gap: 8 }}>
                  <View style={s.row}>
                    <CatIcon icon="piggy" colour={C.pot} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{p.name}</Text>
                      <Text style={s.meta}>{p.perPay ? `${moneyS(p.perPay, cur)} each payday${started ? '' : `, from ${dfmt(p.start)}`}` : 'Top up when you like'}</Text>
                    </View>
                    <Text style={[s.amt, { fontSize: 18 }, bal < 0 && { color: C.bad }]}>{money(bal, cur)}</Text>
                  </View>
                  {p.target > 0 && (
                    <>
                      <GrowBar to={bal / p.target} colour={C.pot} height={6} track={C.track} />
                      <Text style={s.meta}>{bal >= p.target ? 'Target reached' : `${moneyS(p.target - bal, cur)} to go to ${moneyS(p.target, cur)}${p.perPay ? `, about ${Math.ceil((p.target - bal) / p.perPay)} more paydays` : ''}`}</Text>
                    </>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn label="Top up" small onPress={() => setTopUp({ pot: p, amt: '' })} />
                    <Btn label="Edit" small onPress={() => editPot(p)} />
                  </View>
                </Card>
              );
            })}
            {pots.length > 0 && <Text style={s.hint}>To pay for something from a pot, tap it in Activity and choose the pot under Paid from.</Text>}
            <Btn label="Add a pot" onPress={() => editPot()} />
          </>
        )}
      </ScrollView>

      <Sheet open={!!bf} onClose={() => setBf(null)} title={bf?.id ? 'Edit bill' : 'New bill'}>
        {bf && <>
          <Label>Name</Label>
          <TextInput value={bf.name} onChangeText={(name) => setBf({ ...bf, name })} placeholder="e.g. Council tax" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Bill name" />
          <Label>Amount each month</Label>
          <TextInput value={bf.amt} onChangeText={(amt) => setBf({ ...bf, amt })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Bill amount" />
          <Label>Due on the</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
            {Array.from({ length: 31 }, (_, k) => k + 1).map((n) => <Chip key={n} label={ord(n)} on={bf.day === n} onPress={() => setBf({ ...bf, day: n })} />)}
          </ScrollView>
          <Label>Type</Label>
          <View style={s.wrapRow}>{TYPES.map((t) => <Chip key={t.id} label={t.n} icon={t.i} colour={C.bill} on={bf.type === t.id} onPress={() => setBf({ ...bf, type: t.id })} />)}</View>
          {bf.type === 'debt' && <>
            <Label>Balance left (optional)</Label>
            <TextInput value={bf.balance} onChangeText={(balance) => setBf({ ...bf, balance })} keyboardType="decimal-pad" placeholder="For a payoff date" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Debt balance" />
            <Label>Interest rate, % a year (optional)</Label>
            <TextInput value={bf.rate} onChangeText={(rate) => setBf({ ...bf, rate })} keyboardType="decimal-pad" placeholder="e.g. 29.9" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Interest rate" />
            <Text style={s.hint}>Your lender's app or statement shows it (APR or EAR). With it, the payoff date includes interest.</Text>
          </>}
          <Chip label="Paid by Direct Debit (ticks itself off)" on={bf.dd} onPress={() => setBf({ ...bf, dd: !bf.dd })} />
          {S.settings.sideIncome && <Chip label="Business cost" on={bf.biz} onPress={() => setBf({ ...bf, biz: !bf.biz })} />}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {bf.id && <Btn label="Delete" danger onPress={deleteBill} />}
            <Btn label={bf.id ? 'Save' : 'Add bill'} primary style={{ flex: 1 }} disabled={!bf.name.trim() || !pence(bf.amt)} onPress={saveBill} />
          </View>
        </>}
      </Sheet>

      <Sheet open={!!of} onClose={() => setOf(null)} title={of?.id ? 'Update overdraft' : 'New overdraft'}>
        {of && <>
          <Label>Name</Label>
          <TextInput value={of.name} onChangeText={(name) => setOf({ ...of, name })} placeholder="e.g. Bank overdraft" placeholderTextColor={C.faint} style={s.field} maxLength={28} accessibilityLabel="Overdraft name" />
          <Label>Using now</Label>
          <TextInput value={of.used} onChangeText={(used) => setOf({ ...of, used })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Amount of the overdraft in use" selectTextOnFocus />
          <Label>Interest rate, % a year (optional)</Label>
          <TextInput value={of.rate} onChangeText={(rate) => setOf({ ...of, rate })} keyboardType="decimal-pad" placeholder="e.g. 39" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Interest rate" />
          <Text style={s.hint}>Your bank app shows how much of the overdraft you're using. This doesn't change your daily figure: overdraft interest is a bill if you've added it as one.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {of.id && <Btn label="Delete" danger onPress={deleteOd} />}
            <Btn label={of.id ? 'Save' : 'Add overdraft'} primary style={{ flex: 1 }} disabled={!of.name.trim()} onPress={saveOd} />
          </View>
        </>}
      </Sheet>

      <Sheet open={!!pf} onClose={() => setPf(null)} title={pf?.id ? 'Edit pot' : 'New pot'}>
        {pf && <>
          <Label>Name</Label>
          <TextInput value={pf.name} onChangeText={(name) => setPf({ ...pf, name })} placeholder="e.g. Christmas" placeholderTextColor={C.faint} style={s.field} maxLength={24} accessibilityLabel="Pot name" />
          <Label>Each payday</Label>
          <TextInput value={pf.perPay} onChangeText={(perPay) => setPf({ ...pf, perPay })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Each payday" />
          <Label>Target (optional)</Label>
          <TextInput value={pf.target} onChangeText={(target) => setPf({ ...pf, target })} keyboardType="decimal-pad" placeholder="None" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Target" />
          <Label>{pf.id ? 'Balance now' : 'Already saved (optional)'}</Label>
          <TextInput value={pf.balance} onChangeText={(balance) => setPf({ ...pf, balance })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Balance" />
          {!pf.id && diffDays(c.start, today) > 0 && (
            <Chip label={pf.fromNext ? `Starts on payday, ${dfmt(nextDay(c.end))}` : 'Starts now, from this pay'} on={pf.fromNext} onPress={() => setPf({ ...pf, fromNext: !pf.fromNext })} />
          )}
          <Text style={s.hint}>{pf.id ? 'Changing the balance corrects it without touching your daily budget.' : pf.fromNext ? 'Nothing comes off until your next payday.' : "The first top-up comes out of this pay's money, so your daily budget drops a little today."}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {pf.id && <Btn label="Close pot" danger onPress={closePot} />}
            <Btn label={pf.id ? 'Save' : 'Create pot'} primary style={{ flex: 1 }} disabled={!pf.name.trim()} onPress={savePot} />
          </View>
        </>}
      </Sheet>

      <Sheet open={!!topUp} onClose={() => setTopUp(null)} title={topUp ? `Add to ${topUp.pot.name}` : ''}>
        {topUp && <>
          <TextInput value={topUp.amt} onChangeText={(amt) => setTopUp({ ...topUp, amt })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.faint} style={s.field} accessibilityLabel="Amount" autoFocus />
          <Text style={s.hint}>Comes out of today's spending money. You have {moneyS(Math.max(0, safeInfo(S, today).safe), cur)} safe to spend today.</Text>
          <Btn label="Add money" primary disabled={!pence(topUp.amt)} onPress={doTopUp} />
        </>}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: C.fg, fontSize: 26, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  seg: { flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: C.surface, borderRadius: 999, padding: 3 },
  segB: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  segOn: { backgroundColor: C.surface2 },
  segT: { color: C.muted, fontWeight: '700', fontSize: 13 },
  big: { color: C.fg, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: C.good },
  ghd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  link: { color: C.gold, fontWeight: '700', fontSize: 13 },
  list: { backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 12 },
  sep: { borderTopWidth: 1, borderTopColor: C.line },
  brow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  dbox: { width: 42, height: 46, borderRadius: 10, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
  dboxN: { color: C.fg, fontSize: 17, fontWeight: '800' },
  dboxM: { color: C.muted, fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { color: C.fg, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { color: C.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  paidTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: C.good + '22' },
  payBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: C.gold },
  tagT: { color: C.goldInk, fontSize: 12, fontWeight: '800' },
  autoT: { color: C.muted, fontSize: 12, fontWeight: '700' },
  field: { backgroundColor: C.surface2, borderRadius: 12, height: 46, paddingHorizontal: 12, color: C.fg, fontSize: 16 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tBars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 8 },
  tCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  tBar: { borderRadius: 6, minHeight: 2 },
});
