// Kitty: safe to spend today. Tabs: Log, Review (bank alerts), Activity, More.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { suggest } from './src/capture/toEntry';
import { useCapture } from './src/capture/useCapture';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { LogScreen } from './src/screens/LogScreen';
import { MoreScreen } from './src/screens/MoreScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { KittyProvider, useKitty } from './src/store/KittyState';
import { C } from './src/ui/theme';

type Tab = 'log' | 'review' | 'activity' | 'more';
const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'review', label: 'Review' },
  { id: 'activity', label: 'Activity' },
  { id: 'more', label: 'More' },
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
  const { S } = useKitty();
  const cap = useCapture();
  const [tab, setTab] = useState<Tab>(S.settings.setupDone ? 'log' : 'more');
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pending = cap.parsed.filter((p) => !p.duplicateOf && suggest(S, p, 'x').action !== 'skip').length;

  const show = (msg: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, undo });
    timer.current = setTimeout(() => setToast(null), undo ? 5000 : 2600);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {tab === 'log' && <LogScreen onSaved={show} />}
        {tab === 'review' && <ReviewScreen cap={cap} onDone={show} goSetup={() => setTab('more')} />}
        {tab === 'activity' && <ActivityScreen onDone={show} />}
        {tab === 'more' && <MoreScreen cap={cap} onDone={(m) => show(m)} />}
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
          <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={`${t.label} tab`} accessibilityState={{ selected: tab === t.id }} onPress={() => setTab(t.id)} style={s.tab}>
            <View style={s.tabTop}>
              <View style={[s.tabMark, tab === t.id && { backgroundColor: C.gold }]} />
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
  screen: { flex: 1, backgroundColor: C.bg },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 6 },
  tabTop: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabMark: { width: 18, height: 4, borderRadius: 2, backgroundColor: C.surface2 },
  badge: { color: C.goldInk, backgroundColor: C.gold, borderRadius: 9, minWidth: 18, height: 18, lineHeight: 18, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingHorizontal: 5, overflow: 'hidden' },
  tabT: { color: C.faint, fontSize: 12, fontWeight: '700' },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 86, backgroundColor: C.fg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  toastT: { flex: 1, color: C.bg, fontWeight: '700', fontSize: 14 },
  undo: { color: C.bg, fontWeight: '800', fontSize: 14, textDecorationLine: 'underline' },
});
