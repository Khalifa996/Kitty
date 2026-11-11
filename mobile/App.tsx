// Crest: safe to spend today. Tabs: Log, Review (bank alerts), Activity, Insights, More.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { suggest } from './src/capture/toEntry';
import { useCapture } from './src/capture/useCapture';
import { addAll, assess, projected, settledAdds } from './src/brain/brain';
import { applyActions, refreshSurfaces, runBrain } from './src/brain/task';
import { useSmartSort } from './src/ai/useSmartSort';
import { categories } from './src/engine/cats';
import { KittyNotifications } from './modules/kitty-notifications';
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
import { feel, native, Pop } from './src/ui/motion';
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
  // On the phone the brain does this (the same code that runs in the background when an alert arrives)
  useEffect(() => {
    if (KittyNotifications) { try { runBrain('open'); } catch { /* best effort */ } return; }
    // Browser preview: the same rules over the demo alerts
    if (!S.settings.setupDone || S.settings.autoAdd === false) return;
    const { txs, keys } = settledAdds(assess(S, cap.parsed, Date.now()), cap.parsed, new Date().toISOString());
    if (txs.length) update((d) => addAll(d, txs));
    if (keys.length) cap.done(keys);
  }, [cap.parsed, tick, S.settings.autoAdd, S.settings.setupDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Any change: hand the new figure to the widget, tile, status bar and morning message
  useEffect(() => { try { refreshSurfaces(projected(S, assess(S, cap.parsed, Date.now()))); } catch { /* best effort */ } }, [S, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Taps on notification buttons made while Crest wasn't running get applied when it opens
  useEffect(() => { try { applyActions(); } catch { /* best effort */ } }, []);

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
    feel.done();
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
        <Toast key={toast.msg} msg={toast.msg} undo={toast.undo && (() => { toast.undo?.(); setToast(null); })} />
      )}

      <SafeAreaView edges={['bottom']} style={s.tabs}>
        {TABS.map((t) => (
          <TabButton key={t.id} label={t.label} icon={t.icon} on={tab === t.id && !more} badge={t.id === 'review' ? pending : 0}
            onPress={() => { setMore(false); setTab(t.id); }} />
        ))}
      </SafeAreaView>
    </SafeAreaView>
  );
}

/** A tab with a gold pill that springs in behind the icon when it's the one showing. */
function TabButton({ label, icon, on, badge, onPress }: { label: string; icon: string; on: boolean; badge: number; onPress: () => void }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: native, bounciness: 14, speed: 16 }).start(); }, [on, v]);
  return (
    <Pop accessibilityRole="tab" accessibilityLabel={`${label} tab`} accessibilityState={{ selected: on }} onPress={onPress} style={s.tab} scale={0.88}>
      <View style={s.tabTop}>
        <Animated.View style={[s.pill, { opacity: v, transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]} />
        <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
          <Icon name={icon} size={22} colour={on ? C.gold : C.faint} />
        </Animated.View>
        {badge > 0 && <Text style={s.badge}>{badge > 99 ? '99+' : badge}</Text>}
      </View>
      <Text style={[s.tabT, on && { color: C.fg }]}>{label}</Text>
    </Pop>
  );
}

/** The message after a save, sliding up with a little bounce. */
function Toast({ msg, undo }: { msg: string; undo?: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(v, { toValue: 1, useNativeDriver: native, bounciness: 10, speed: 14 }).start(); }, [v]);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[s.toast, { opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
      <View style={s.toastTick}><Icon name="check" size={14} colour={C.goldInk} /></View>
      <Text style={s.toastT} numberOfLines={2}>{msg}</Text>
      {undo && (
        <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={undo} hitSlop={8}>
          <Text style={s.undo}>Undo</Text>
        </Pressable>
      )}
    </Animated.View>
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
  tabTop: { height: 30, width: 56, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 15, backgroundColor: C.goldSoft },
  badge: { position: 'absolute', top: -4, left: 32, color: C.goldInk, backgroundColor: C.gold, borderRadius: 9, minWidth: 18, height: 18, lineHeight: 18, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingHorizontal: 5, overflow: 'hidden' },
  tabT: { color: C.faint, fontSize: 12, fontWeight: '700' },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 92, backgroundColor: C.fg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: C.shadow, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  toastTick: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  link: { color: C.gold, fontWeight: '700', fontSize: 14 },
  toastT: { flex: 1, color: C.bg, fontWeight: '700', fontSize: 14 },
  undo: { color: C.bg, fontWeight: '800', fontSize: 14, textDecorationLine: 'underline' },
});
