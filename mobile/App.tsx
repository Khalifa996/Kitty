// Crest: safe to spend today. Tabs: Log, Review (bank alerts), Activity, Insights, More.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { alertTxId, alreadyLogged, isSure, settleMinutes, suggest } from './src/capture/toEntry';
import { keysFor, useCapture } from './src/capture/useCapture';
import { useSmartSort } from './src/ai/useSmartSort';
import { categories } from './src/engine/cats';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { LogScreen } from './src/screens/LogScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { KittyProvider, useKitty } from './src/store/KittyState';
import { useUpdate } from './src/update/useUpdate';
import { Icon } from './src/ui/Icon';
import { C, money } from './src/ui/theme';

type Tab = 'log' | 'review' | 'activity' | 'plan' | 'insights';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Log', icon: 'plusc' },
  { id: 'review', label: 'Review', icon: 'inbox' },
  { id: 'activity', label: 'Activity', icon: 'list' },
  { id: 'plan', label: 'Plan', icon: 'calendar' },
  { id: 'insights', label: 'Insights', icon: 'pie' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <KittyProvider>
        <Shell />
      </KittyProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { S, update } = useKitty();
  const cap = useCapture();
  // Payments Crest is sure about go in by themselves once they've settled, so the number is right without opening Review
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 5 * 60 * 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!S.settings.setupDone || S.settings.autoAdd === false) return;
    const now = Date.now();
    const sure = cap.parsed
      .filter((p) => now - p.time >= settleMinutes(p) * 60 * 1000)
      .map((p) => ({ p, sug: suggest(S, p, alertTxId(p), cap.parsed) }))
      .filter((i) => isSure(i.p, i.sug, alreadyLogged(S, i.p)));
    if (!sure.length) return;
    const stamp = new Date().toISOString();
    update((d) => {
      const have = new Set(d.tx.map((t) => t.id));
      for (const i of sure) if (i.sug.action === 'add' || i.sug.action === 'pay-bill') {
        // A shop Crest couldn't place goes in with its best guess, marked so Smart sorting can fill it in
        const guess = i.sug.action === 'add' && i.sug.guessed && i.sug.tx.kind === 'out';
        const t = { ...i.sug.tx, autoAdded: stamp, ...(guess ? { catGuess: true } : {}) };
        if (!have.has(t.id)) d.tx.push(t);
      }
    });
    cap.done(sure.flatMap((i) => keysFor(i.p, cap.parsed)));
  }, [cap.parsed, tick, S.settings.autoAdd, S.settings.setupDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smart sorting (when it's on) picks categories for shops Crest added with a guess
  const guessed = useMemo(() => S.tx.filter((t) => t.catGuess && t.kind === 'out' && t.merchant).slice(-20)
    .map((t) => ({ key: `tx:${t.id}`, app: t.bank || 'Bank', title: '', text: `You spent ${money(t.amt, S.settings.currency)} at ${t.merchant}` })), [S.tx, S.settings.currency]);
  const sorted = useSmartSort(S, guessed);
  useEffect(() => {
    if (!S.tx.some((t) => t.catGuess && sorted.results[`tx:${t.id}`])) return;
    const ok = new Set(categories(S.settings).map((c) => c.id));
    update((d) => {
      for (const t of d.tx) {
        const r = t.catGuess ? sorted.results[`tx:${t.id}`] : undefined;
        if (!r) continue;
        if (r.category !== 'other' && r.confidence !== 'low' && ok.has(r.category)) t.cat = r.category;
        delete t.catGuess;
      }
    });
  }, [sorted.results]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>('log');
  const [importing, setImporting] = useState(false);
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const newBuild = useUpdate();
  const [later, setLater] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pending = cap.parsed.filter((p) => !p.duplicateOf && suggest(S, p, 'x').action !== 'skip').length;

  const show = (msg: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, undo });
    timer.current = setTimeout(() => setToast(null), undo ? 5000 : 2600);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // A new person sets up first; someone with a backup from the web app can bring it across instead
  if (!S.settings.setupDone) {
    return (
      <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
        {importing ? (
          <View style={{ flex: 1 }}>
            <Pressable accessibilityRole="button" onPress={() => setImporting(false)} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={s.link}>Set up from scratch instead</Text>
            </Pressable>
            <MoreScreen cap={cap} onDone={(m) => show(m)} />
          </View>
        ) : <SetupScreen onImport={() => setImporting(true)} />}
        {toast && <View style={s.toast}><Text style={s.toastT}>{toast.msg}</Text></View>}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      {newBuild && !later && (
        <View style={s.update}>
          <Text style={s.updateT} numberOfLines={1}>A newer Crest is ready (0.1.{newBuild.build})</Text>
          <Pressable accessibilityRole="button" onPress={() => setLater(true)} hitSlop={8}><Text style={s.updateLater}>Later</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => Linking.openURL(newBuild.url)} hitSlop={8}><Text style={s.updateGo}>Update</Text></Pressable>
        </View>
      )}
      <View style={{ flex: 1 }}>
        {more ? (
          <View style={{ flex: 1 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setMore(false)} style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={s.link}>‹ Back</Text>
            </Pressable>
            <MoreScreen cap={cap} onDone={(m) => show(m)} />
          </View>
        ) : <>
          {tab === 'log' && <LogScreen onSaved={show} />}
          {tab === 'review' && <ReviewScreen cap={cap} onDone={show} goSetup={() => setMore(true)} />}
          {tab === 'activity' && <ActivityScreen onDone={show} />}
          {tab === 'plan' && <PlanScreen onDone={show} openMore={() => setMore(true)} />}
          {tab === 'insights' && <InsightsScreen />}
        </>}
      </View>

      {toast && (
        <View style={s.toast} accessibilityLiveRegion="polite">
          <Text style={s.toastT} numberOfLines={2}>{toast.msg}</Text>
          {toast.undo && (
            <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={() => { toast.undo?.(); setToast(null); }}>
              <Text style={s.undo}>Undo</Text>
            </Pressable>
          )}
        </View>
      )}

      <SafeAreaView edges={['bottom']} style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={`${t.label} tab`} accessibilityState={{ selected: tab === t.id }} onPress={() => { setMore(false); setTab(t.id); }} style={s.tab}>
            <View style={s.tabTop}>
              <Icon name={t.icon} size={22} colour={tab === t.id ? C.gold : C.faint} />
              {t.id === 'review' && pending > 0 && <Text style={s.badge}>{pending > 99 ? '99+' : pending}</Text>}
            </View>
            <Text style={[s.tabT, tab === t.id && { color: C.fg }]}>{t.label}</Text>
          </Pressable>
        ))}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  update: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface2, paddingHorizontal: 16, paddingVertical: 10 },
  updateT: { flex: 1, color: C.fg, fontSize: 14, fontWeight: '600' },
  updateLater: { color: C.muted, fontSize: 14, fontWeight: '600' },
  updateGo: { color: C.gold, fontSize: 14, fontWeight: '800' },
  screen: { flex: 1, backgroundColor: C.bg },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  tabTop: { height: 24, width: 24, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, left: 14, color: C.goldInk, backgroundColor: C.gold, borderRadius: 9, minWidth: 18, height: 18, lineHeight: 18, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingHorizontal: 5, overflow: 'hidden' },
  tabT: { color: C.faint, fontSize: 12, fontWeight: '700' },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 86, backgroundColor: C.fg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { color: C.gold, fontWeight: '700', fontSize: 14 },
  toastT: { flex: 1, color: C.bg, fontWeight: '700', fontSize: 14 },
  undo: { color: C.bg, fontWeight: '800', fontSize: 14, textDecorationLine: 'underline' },
});
