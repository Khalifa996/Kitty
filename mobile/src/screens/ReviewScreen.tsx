// Payments Kitty spotted in your bank alerts, ready to add with one tap.
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { alreadyLogged, guessCategory, knownCategory, suggest, type Suggestion } from '../capture/toEntry';
import { isMoneyApp, keysFor, type Capture } from '../capture/useCapture';
import { catName, categories, inName, inTypes } from '../engine/cats';
import type { Bill, State, Tx } from '../engine/types';
import type { AiResult } from '../ai/cloud';
import { useSmartSort } from '../ai/useSmartSort';
import { amountIn, clean, isGenericTitle, tidyName, type ParsedAlert } from '../parse/bankAlerts';
import { hm, ymd } from '../engine/dates';
import { uid, useKitty } from '../store/KittyState';
import { getItem, setItem } from '../store/kv';
import { Btn, Card, Chip, Label, Sheet } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { C, money } from '../ui/theme';

type Item = { p: ParsedAlert; sug: Suggestion; dup?: Tx };

// Categories picked on a card are kept until it's added or skipped, so leaving the tab doesn't lose them
type Picks = { cats: Record<string, string>; side: Record<string, boolean> };
const PICKS = 'kitty.picks';
const loadPicks = (): Picks => {
  try { const p = JSON.parse(getItem(PICKS) || '{}'); return { cats: p.cats || {}, side: p.side || {} }; } catch { return { cats: {}, side: {} }; }
};

/** Use the AI's answer for an alert Kitty couldn't read, or a shop it couldn't place. Kitty's own rules and your history win otherwise. */
function withAi(i: Item, r: AiResult | undefined, S: State): Item {
  if (!r || i.dup) return i;
  const valid = (id: string, kind: 'out' | 'in') => (kind === 'out' ? categories(S.settings) : inTypes(S.settings)).some((c) => c.id === id);
  const sure = r.confidence === 'high';
  if (i.sug.action === 'ask') {
    if (r.kind === 'not_payment' || r.kind === 'transfer') return { ...i, sug: { action: 'skip', reason: `Smart sorting: ${r.note.replace(/\.$/, "")}` } };
    const kind = r.kind === 'received' ? 'in' : 'out', d = new Date(i.p.time);
    const cat = valid(r.category, kind) ? r.category : kind === 'in' ? 'extra' : 'other';
    const tx: Tx = { id: `a-${i.p.key.replace(/[^a-z0-9]/gi, '').slice(-16)}`, kind, amt: i.p.amount || 0, cat, sub: null, merchant: r.name || '', note: '',
      date: ymd(d), time: hm(d), biz: cat === 'side', billId: null, source: 'alert', bank: i.p.bank };
    return { ...i, sug: { action: 'add', tx, guessed: !sure, ai: true, hint: `Smart sorting: ${r.note.replace(/\.$/, "")}` } };
  }
  // A shop Kitty couldn't place: only take the AI's answer if it names a real category and isn't a shrug
  if (i.sug.action === 'add' && i.sug.guessed && valid(r.category, i.sug.tx.kind) && r.category !== 'other' && r.confidence !== 'low') {
    return { ...i, sug: { ...i.sug, ai: true, guessed: !sure, tx: { ...i.sug.tx, cat: r.category, biz: r.category === 'side', merchant: i.sug.tx.merchant || r.name } } };
  }
  return i;
}

// Notices that might hide a real payment; adverts, declines and limits never do
const ADDABLE = /payment check|not a payment|account warning/i;

const when = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return t;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString() ? `Yesterday ${t}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${t}`;
};

export function ReviewScreen({ cap, onDone, goSetup }: { cap: Capture; onDone: (msg: string, undo?: () => void) => void; goSetup: () => void }) {
  const { S, update } = useKitty();
  const [picks, setPicks] = useState<Picks>(loadPicks);
  const { cats, side } = picks;
  const keep = (next: Picks) => {
    const live = new Set(cap.raw.map((r) => r.key));
    const prune = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([k]) => live.has(k)));
    const tidy = { cats: prune(next.cats), side: prune(next.side) };
    setPicks(tidy);
    try { setItem(PICKS, JSON.stringify(tidy)); } catch { /* best effort */ }
  };
  const setCats = (c: Record<string, string>) => keep({ ...picks, cats: c });
  const [picking, setPicking] = useState<Item | null>(null);
  // Turning an unknown Direct Debit into a monthly bill
  const [making, setMaking] = useState<{ i: Item; name: string; type: Bill['type'] } | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [showNotices, setShowNotices] = useState(false);
  const cur = S.settings.currency;

  const base: Item[] = useMemo(() => cap.parsed
    .filter((p) => p.kind !== 'ignore' || !p.duplicateOf)
    .map((p) => ({ p, sug: suggest(S, p, `a-${p.key.replace(/[^a-z0-9]/gi, '').slice(-16)}`, cap.parsed), dup: alreadyLogged(S, p) })), [cap.parsed, S]);

  // Smart sorting (opt-in): ask the AI about alerts Kitty couldn't read and shops it couldn't place
  const needHelp = useMemo(() => base.filter((i) => !i.p.duplicateOf && !i.dup && (i.sug.action === 'ask' || (i.sug.action === 'add' && i.sug.guessed && !i.sug.cash && !(i.sug.newBill && !i.p.merchant))))
    .map((i) => { const r = cap.raw.find((x) => x.key === i.p.key); return { key: i.p.key, app: i.p.bank, title: r?.title || '', text: r?.text || '' }; }), [base, cap.raw]);
  const ai = useSmartSort(S, needHelp);
  const items: Item[] = useMemo(() => base.map((i) => withAi(i, ai.results[i.p.key], S)), [base, ai.results, S]);
  const todo = items.filter((i) => i.sug.action !== 'skip' && !i.p.duplicateOf);
  const skipped = items.filter((i) => i.sug.action === 'skip' && !i.p.duplicateOf && !i.p.warning);
  // What your banks are warning you about (overdraft, low balance): newest of each kind per bank, last three days
  const warnings = cap.parsed.filter((p) => p.warning && Date.now() - p.time < 3 * 864e5)
    .filter((p, k, all) => all.findIndex((q) => q.bank === p.bank && q.warning === p.warning) === k);
  const allWarnings = cap.parsed.filter((p) => p.warning);
  // An app the person turned on that has sent only non-payments: offer to stop reading it
  const quietApps = cap.watched.filter((a) => {
    const mine = cap.parsed.filter((p) => p.bank === a.label);
    return !S.settings.dismissed?.[`keepapp:${a.pkg}`] && mine.length >= 3 && !mine.some((p) => p.kind === 'spent' || p.kind === 'received' || p.kind === 'bill' || p.unsure);
  });

  // Tidy up: things Kitty skipped by itself are cleared after three days
  useEffect(() => {
    const old = skipped.filter((i) => Date.now() - i.p.time > 3 * 864e5);
    if (old.length) cap.done(old.flatMap((i) => keysFor(i.p, cap.parsed)));
  }, [skipped.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const rawOf = (p: ParsedAlert) => cap.raw.find((r) => r.key === p.key);
  const bankText = (p: ParsedAlert) => { const r = rawOf(p); return r ? [clean(r.title), clean(r.text)].filter(Boolean).join(' · ') : p.reason || ''; };

  const txFor = (i: Item): Tx | null => {
    if (i.sug.action === 'skip' || i.sug.action === 'ask') return null;
    const t = { ...i.sug.tx };
    if (i.sug.action === 'add' && cats[i.p.key]) { t.cat = cats[i.p.key]; t.biz = t.cat === 'side'; }
    if (side[i.p.key] && t.kind === 'out' && !t.billId) t.fromSide = true;
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
  /** Remember what the person did with alerts Kitty couldn't read, so it asks less over time. */
  const learn = (bank: string, how: 'skip' | 'keep') => update((d) => {
    const L = d.settings.learned || {}, m = { ...(L[how] || {}) };
    m[bank] = (m[bank] || 0) + 1;
    d.settings.learned = { ...L, [how]: m };
  });
  const skip = (i: Item) => {
    if (i.sug.action === 'ask') learn(i.p.bank, 'skip');
    cap.done(keysFor(i.p, cap.parsed));
    onDone('Skipped');
  };
  const cashToSpend = (i: Item) => { cap.done(keysFor(i.p, cap.parsed)); onDone('Noted. Log what you buy with it on the keypad'); };
  /** A Direct Debit Kitty didn't know: add it to Plan as a monthly bill, paid today, so future ones are ticked off. */
  const makeBill = () => {
    if (!making || !making.name.trim()) return;
    const t = txFor(making.i) as Tx, name = making.name.trim(), id = 'b' + uid();
    const sub = making.type === 'sub' ? 'Subscription' : making.type === 'debt' ? 'Debt repayment' : name;
    const bill: Bill = { id, name, amt: t.amt, day: parseInt(t.date.slice(8), 10), type: making.type, sub, dd: true, ddFrom: t.date };
    const tx: Tx = { ...t, cat: 'bills', sub, merchant: name, billId: id };
    update((d) => { d.bills.push(bill); d.tx.push(tx); });
    cap.done(keysFor(making.i.p, cap.parsed));
    setMaking(null);
    onDone(`${name} added to your bills, paid ${money(t.amt, cur)}`, () => update((d) => { d.bills = d.bills.filter((b) => b.id !== id); d.tx = d.tx.filter((x) => x.id !== tx.id); }));
  };

  /** You decided what an alert was (one Kitty couldn't read, or a notice you want to add anyway). */
  const addAs = (p: ParsedAlert, kind: 'out' | 'in', amt: number) => {
    if (p.unsure) learn(p.bank, 'keep');
    const r = rawOf(p), d = new Date(p.time);
    const name = p.merchant || (r && !isGenericTitle(r.title) && !amountIn(r.title) ? tidyName(r.title) : '');
    const cat = kind === 'in' ? 'extra' : guessCategory(S, name) || knownCategory(name) || 'other';
    const t: Tx = { id: `a-${p.key.replace(/[^a-z0-9]/gi, '').slice(-16)}`, kind, amt, cat, sub: null, merchant: name, note: '', date: ymd(d), time: hm(d), biz: false, billId: null, source: 'alert', bank: p.bank };
    update((x) => { x.tx.push(t); });
    cap.done(keysFor(p, cap.parsed));
    onDone(`Added ${money(amt, cur)}${name ? ' · ' + name : ''}. Change the category in Activity if it's wrong`, () => update((x) => { x.tx = x.tx.filter((y) => y.id !== t.id); }));
  };
  /** The same amount already arrived as a payment, or is already logged: adding this would count it twice. */
  const twinOf = (p: ParsedAlert, amt: number): string | null => {
    const other = cap.parsed.find((q) => q.key !== p.key && q.kind === 'spent' && q.amount === amt && Math.abs(q.time - p.time) < 36e5);
    if (other) return `${other.merchant || other.bank}, ${money(amt, cur)} at ${when(other.time)}`;
    const t = S.tx.find((x) => x.amt === amt && Math.abs(new Date(x.date + 'T' + (x.time || '12:00')).getTime() - p.time) < 864e5);
    return t ? `${t.merchant || catName(S.settings, t.cat)}, ${money(amt, cur)} at ${when(new Date(t.date + 'T' + (t.time || '12:00')).getTime())}` : null;
  };
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
  // Things that need you: not sure what they are, or cash. Everything else can be added in one go
  const easy = todo.filter((i) => !i.dup && i.sug.action !== 'ask' && !(i.sug.action === 'add' && (i.sug.cash || i.sug.newBill || (i.sug.ai && i.sug.guessed))));
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
          {ai.on && (ai.busy || ai.error) ? <Text style={[s.sub, ai.error ? { color: C.warn } : null]}>{ai.busy ? 'Smart sorting the ones Kitty is unsure about…' : ai.error}</Text> : null}
        </View>
        {easy.length > 1 && <Btn label={`Add all ${easy.length}`} primary small onPress={() => add(easy)} />}
      </View>

      {warnings.length > 0 && (
        <Card style={{ gap: 10, borderWidth: 1, borderColor: C.warn }}>
          <View style={s.row}>
            <Icon name="info" size={18} colour={C.warn} />
            <Text style={[s.h2, { flex: 1 }]}>Your bank{warnings.length > 1 ? 's' : ''} flagged something</Text>
          </View>
          {warnings.map((p) => (
            <View key={p.key} style={{ gap: 3 }}>
              <Text style={s.meta}>{p.bank} · {when(p.time)}</Text>
              <Text style={s.quote}>{bankText(p)}</Text>
            </View>
          ))}
          {warnings.some((p) => p.warning === 'Overdraft') && (
            <Text style={s.hint}>Overdraft charges add up quickly. If money is tight, MoneyHelper has free, confidential help.</Text>
          )}
          <View style={[s.row, { justifyContent: 'flex-end' }]}>
            {warnings.some((p) => p.warning === 'Overdraft') && <Btn label="Free help" small onPress={() => Linking.openURL('https://www.moneyhelper.org.uk')} />}
            <Btn label="Got it" small primary onPress={() => cap.done(allWarnings.map((p) => p.key))} />
          </View>
        </Card>
      )}

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
        if (i.sug.action === 'ask') {
          const amt = i.p.amount || 0;
          return (
            <Card key={i.p.key} style={{ gap: 10 }}>
              <View style={s.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name}>Not sure about this one</Text>
                  <Text style={s.meta}>{i.p.bank} · {when(i.p.time)}</Text>
                </View>
                <Text style={s.amt}>{money(amt, cur)}</Text>
              </View>
              <Text style={s.quote}>{bankText(i.p)}</Text>
              <Text style={s.hint}>Is this money you spent, or money you received?</Text>
              <View style={s.row}>
                <Btn label="Skip" small onPress={() => skip(i)} />
                <View style={{ flex: 1 }} />
                <Btn label="Received" small onPress={() => addAs(i.p, 'in', amt)} />
                <Btn label="Spent" small onPress={() => addAs(i.p, 'out', amt)} />
              </View>
            </Card>
          );
        }
        const t = txFor(i) as Tx, isIn = t.kind === 'in';
        const isCash = i.sug.action === 'add' && !!i.sug.cash;
        const newBill = i.sug.action === 'add' && !!i.sug.newBill;
        const list = isIn ? inTypes(S.settings) : categories(S.settings);
        const c = list.find((x) => x.id === t.cat);
        const label = (i.sug.action === 'pay-bill' ? `Bill: ${i.sug.billName}` : isIn ? inName(t.cat) : (c?.n || 'Other')) + (t.fromSide ? ' · side income' : '') + (i.sug.action === 'add' && i.sug.ai && !cats[i.p.key] ? ' · AI' : '');
        const guessed = i.sug.action === 'add' && i.sug.guessed && !cats[i.p.key];
        return (
          <Card key={i.p.key} style={{ gap: 10 }}>
            <View style={s.row}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{t.merchant || (isIn ? 'Money in' : newBill ? 'Direct Debit' : 'Shop not named')}</Text>
                <Text style={s.meta} numberOfLines={1}>{i.p.bank} · {when(i.p.time)}</Text>
              </View>
              <Text style={[s.amt, isIn && { color: C.good }]}>{isIn ? '+' : ''}{money(t.amt, cur)}</Text>
            </View>
            {i.dup && <Text style={[s.hint, { color: C.warn }]}>Looks like you already logged this: {dupText(i.dup)}.</Text>}
            {i.sug.action === 'add' && i.sug.hint && <Text style={s.hint}>{i.sug.hint}.{newBill ? ' If it comes every month, make it a bill and Kitty will expect it from now on.' : ''}</Text>}
            {i.sug.action === 'pay-bill' && i.sug.replaces && <Text style={s.hint}>Kitty ticked this off as {money(i.sug.replaces.amt, cur)} on the day. Your bank says {money(t.amt, cur)}.</Text>}
            <View style={s.row}>
              {i.sug.action === 'pay-bill'
                ? <View style={s.tag}><Icon name="receipt" size={15} colour={C.bill} /><Text style={s.tagT}>{label}</Text></View>
                : <Chip label={guessed && !newBill ? `${label}?` : label} colour={c?.c || C.muted} icon={c?.i} onPress={() => setPicking(i)} />}
              <View style={{ flex: 1 }} />
              {newBill && !i.dup ? null : isCash ? <>
                <Btn label="Cash to spend" small onPress={() => cashToSpend(i)} />
                <Btn label="Add" small primary onPress={() => add([i])} />
              </> : i.dup ? <>
                <Btn label="Add anyway" small onPress={() => add([i])} />
                <Btn label="Same one" small primary onPress={() => same(i)} />
              </> : <>
                <Btn label="Skip" small onPress={() => skip(i)} />
                <Btn label={i.sug.action === 'pay-bill' ? (i.sug.replaces ? 'Update' : 'Mark paid') : 'Add'} small primary onPress={() => add([i])} />
              </>}
            </View>
            {newBill && !i.dup && (
              <View style={[s.row, { justifyContent: 'flex-end' }]}>
                <Btn label="Skip" small onPress={() => skip(i)} />
                <Btn label="One-off" small onPress={() => add([i])} />
                <Btn label="Make it a bill" small primary onPress={() => setMaking({ i, name: t.merchant || '', type: i.p.reason === 'Repayment' ? 'debt' : 'bill' })} />
              </View>
            )}
          </Card>
        );
      })}

      {cap.spotted.filter(isMoneyApp).filter((a) => !S.settings.dismissed?.[`app:${a.pkg}`]).slice(0, 1).map((a) => (
        <Card key={a.pkg} style={{ gap: 8 }}>
          <Text style={s.h2}>Money alerts from {a.label}</Text>
          <Text style={s.hint}>Kitty noticed {a.label} posting alerts with amounts in them. If it's one of your banks or cards, Kitty can read its alerts too. They stay on your phone.</Text>
          <View style={[s.row, { justifyContent: 'flex-end' }]}>
            <Btn label="Not mine" small onPress={() => update((d) => { d.settings.dismissed = { ...(d.settings.dismissed || {}), [`app:${a.pkg}`]: true }; })} />
            <Btn label="Read its alerts" small primary onPress={() => { cap.watchApp(a.pkg, true); onDone(`Kitty will read alerts from ${a.label}`); }} />
          </View>
        </Card>
      ))}

      {quietApps.slice(0, 1).map((a) => {
        const n = cap.parsed.filter((p) => p.bank === a.label).length;
        return (
          <Card key={a.pkg} style={{ gap: 8 }}>
            <Text style={s.h2}>{a.label} isn't sending payments</Text>
            <Text style={s.hint}>Kitty has read {n} alerts from {a.label} and none of them were money in or out. Your bank's alerts already cover payments, so it's simpler to stop reading {a.label}.</Text>
            <View style={[s.row, { justifyContent: 'flex-end' }]}>
              <Btn label="Keep reading" small onPress={() => update((d) => { d.settings.dismissed = { ...(d.settings.dismissed || {}), [`keepapp:${a.pkg}`]: true }; })} />
              <Btn label={`Stop reading ${a.label}`} small primary onPress={() => {
                cap.done(cap.parsed.filter((p) => p.bank === a.label).map((p) => p.key));
                cap.watchApp(a.pkg, false);
                onDone(`Kitty has stopped reading ${a.label}`);
              }} />
            </View>
          </Card>
        );
      })}

      {skipped.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            <Pressable style={{ flex: 1, paddingVertical: 8 }} accessibilityRole="button" accessibilityLabel="Show skipped" onPress={() => setShowSkipped(!showSkipped)}>
              <Label>{skipped.length} not added · {showSkipped ? 'hide' : 'see why'}</Label>
            </Pressable>
            {showSkipped && <Btn label="Clear all" small onPress={clearSkipped} />}
          </View>
          {showSkipped && notices.length > 0 && (
            <Pressable style={s.skipRow} accessibilityRole="button" accessibilityLabel={showNotices ? 'Hide notices' : 'Show notices'} onPress={() => setShowNotices(!showNotices)}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { fontSize: 14, color: C.muted }]}>{notices.length} bank notice{notices.length === 1 ? '' : 's'} · {showNotices ? 'hide' : 'see them'}</Text>
                <Text style={s.meta} numberOfLines={2}>{[...new Set(notices.map((i) => i.sug.action === 'skip' ? i.sug.reason : ''))].filter(Boolean).join(' · ')}</Text>
              </View>
              <Btn label="Clear" small onPress={() => cap.done(notices.flatMap((i) => keysFor(i.p, cap.parsed)))} />
            </Pressable>
          )}
          {showSkipped && showNotices && notices.map((i) => {
            const r = rawOf(i.p), amt = r ? amountIn(r.text) ?? amountIn(r.title) : undefined, twin = amt ? twinOf(i.p, amt) : null;
            return (
              <View key={i.p.key} style={[s.skipRow, { marginLeft: 14, alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={s.meta}>{i.p.bank} · {when(i.p.time)} · {i.sug.action === 'skip' ? i.sug.reason : ''}</Text>
                  <Text style={s.quote}>{bankText(i.p)}</Text>
                  {twin && <Text style={[s.meta, { color: C.warn }]}>Same amount as {twin}. Adding this would count it twice.</Text>}
                </View>
                {amt && ADDABLE.test(i.p.reason || '') ? <Btn label="Add" small onPress={() => addAs(i.p, 'out', amt)} /> : null}
              </View>
            );
          })}
          {showSkipped && skippedPay.map((i) => (
            <View key={i.p.key} style={s.skipRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.name, { fontSize: 14, color: C.muted }]} numberOfLines={1}>{i.p.merchant || i.p.bank}{i.p.amount ? ` · ${money(i.p.amount, cur)}` : ''}</Text>
                <Text style={s.meta} numberOfLines={2}>{i.sug.action === 'skip' ? i.sug.reason : ''}</Text>
                <Text style={[s.meta, { color: C.faint }]} numberOfLines={2}>{bankText(i.p)}</Text>
              </View>
              <View style={{ gap: 6 }}>
                {i.p.amount ? <Btn label="Add" small onPress={() => addAs(i.p, i.p.kind === 'received' || (i.p.kind === 'transfer' && !i.p.sent) ? 'in' : 'out', i.p.amount as number)} /> : null}
                <Btn label="Clear" small onPress={() => cap.done(keysFor(i.p, cap.parsed))} />
              </View>
            </View>
          ))}
        </View>
      )}

      <Sheet open={!!making} onClose={() => setMaking(null)} title="Make it a bill">
        {making && (() => {
          const t = txFor(making.i) as Tx, d = parseInt(t.date.slice(8), 10);
          const nth = d + (d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th');
          return <>
            <Text style={s.hint}>{money(t.amt, cur)} by Direct Debit around the {nth} of each month. Kitty marks this one paid and ticks off the next ones itself.</Text>
            <Label>What is it?</Label>
            <TextInput value={making.name} onChangeText={(name) => setMaking({ ...making, name })} placeholder="e.g. TV licence" placeholderTextColor={C.faint}
              style={s.field} autoFocus accessibilityLabel="Bill name" returnKeyType="done" onSubmitEditing={makeBill} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {([['bill', 'Bill', 'receipt'], ['sub', 'Subscription', 'calendar'], ['debt', 'Debt repayment', 'credit']] as const).map(([id, n, ic]) => (
                <Chip key={id} label={n} icon={ic} colour={C.bill} on={making.type === id} onPress={() => setMaking({ ...making, type: id })} />
              ))}
            </View>
            <Btn label="Add to my bills" primary disabled={!making.name.trim()} onPress={makeBill} />
          </>;
        })()}
      </Sheet>

      <Sheet open={!!picking} onClose={() => setPicking(null)} title="Pick a category">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {picking && (txFor(picking)?.kind === 'in' ? inTypes(S.settings) : categories(S.settings)).map((c) => (
            <Chip key={c.id} label={'long' in c ? (c as { long: string }).long : c.n} colour={c.c} icon={c.i} on={txFor(picking)?.cat === c.id}
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
  field: { backgroundColor: C.surface2, borderRadius: 12, height: 46, paddingHorizontal: 12, color: C.fg, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: C.fg, fontSize: 16, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { color: C.fg, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 12, height: 34 },
  tagT: { color: C.fg, fontWeight: '700', fontSize: 13 },
  quote: { color: C.fg, fontSize: 13.5, lineHeight: 19, backgroundColor: C.surface2, borderRadius: 10, padding: 10 },
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12 },
});
