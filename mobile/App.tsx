// Kitty capture preview: shows the bank alerts Kitty can read on this phone.
// This is the first native build. The full app moves across screen by screen after it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { KittyNotifications } from './modules/kitty-notifications';
import { parseAll, type ParsedAlert, type RawAlert } from './src/parse/bankAlerts';

const C = {
  bg: '#0A0C0F', surface: '#15181D', surface2: '#1F232A', line: '#272C34',
  fg: '#F1F3F6', muted: '#8D95A1', faint: '#59606B',
  gold: '#F2C14E', goldInk: '#1C1505', good: '#3DD68C', warn: '#FF9A3D', bad: '#FF5C6C',
};

const money = (p?: number) => (p == null ? '' : '£' + (p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const timeOf = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const hm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? hm : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${hm}`;
};
const KIND: Record<ParsedAlert['kind'], { label: string; colour: string }> = {
  spent: { label: 'Spent', colour: C.fg },
  received: { label: 'Money in', colour: C.good },
  transfer: { label: 'Transfer', colour: C.muted },
  bill: { label: 'Direct Debit', colour: '#B9A3FF' },
  ignore: { label: 'Skipped', colour: C.faint },
};

function readCaptured(): RawAlert[] {
  if (!KittyNotifications) return [];
  try { return JSON.parse(KittyNotifications.getCaptured()) as RawAlert[]; } catch { return []; }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [enabled, setEnabled] = useState(false);
  const [raw, setRaw] = useState<RawAlert[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [note, setNote] = useState('');

  const refresh = useCallback(() => {
    if (!KittyNotifications) return;
    setEnabled(KittyNotifications.isEnabled());
    setRaw(readCaptured());
  }, []);

  useEffect(() => {
    refresh();
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    const live = KittyNotifications?.addListener('onCapture', refresh);
    return () => { app.remove(); live?.remove(); };
  }, [refresh]);

  const parsed = useMemo(() => parseAll(raw).sort((a, b) => b.time - a.time), [raw]);
  const shown = showSkipped ? parsed : parsed.filter((p) => p.kind !== 'ignore');
  const today = new Date().toDateString();
  const spentToday = parsed.filter((p) => p.kind === 'spent' && new Date(p.time).toDateString() === today).reduce((a, p) => a + (p.amount || 0), 0);

  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2600); };
  const copyForClaude = async () => {
    const sample = raw.slice(-60).map(({ pkg, title, text, time }) => ({ pkg, title, text, time }));
    await Clipboard.setStringAsync(JSON.stringify(sample, null, 1));
    flash(`Copied ${sample.length} alerts. Check them for anything private before sending`);
  };
  const clearAll = () => { KittyNotifications?.removeCaptured(raw.map((r) => r.key)); refresh(); flash('List cleared'); };

  if (!KittyNotifications) {
    return (
      <SafeAreaView style={s.screen}>
        <Text style={s.h1}>Kitty</Text>
        <Text style={s.lead}>Reading bank alerts only works in the installed Android app, not in Expo Go or on iPhone.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={shown}
        keyExtractor={(p) => p.key}
        contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 6 }}>
            <View>
              <Text style={s.h1}>Kitty</Text>
              <Text style={s.sub}>Capture preview: the payments Kitty can see</Text>
            </View>

            {enabled ? (
              <View style={s.card}>
                <Text style={s.k}>Spotted today</Text>
                <Text style={s.big}>{money(spentToday)}</Text>
                <Text style={s.x}>Listening to Barclays, Revolut, Monzo, Starling, NatWest and Google Wallet. Make a card payment and it appears here within seconds.</Text>
              </View>
            ) : (
              <View style={[s.card, { gap: 10 }]}>
                <Text style={s.h2}>Let Kitty read payment alerts</Text>
                <Text style={s.x}>Kitty only keeps alerts from bank apps, and they never leave your phone.</Text>
                <Step n="1" t="Tap Allow access, find Kitty in the list and switch it on." />
                <Step n="2" t={'If Kitty is greyed out: tap Open App info, then the ⋮ menu at the top right, then "Allow restricted settings". Come back and try step 1 again.'} />
                <View style={s.row}>
                  <Btn label="Allow access" primary onPress={() => KittyNotifications.openSettings()} />
                  <Btn label="Open App info" onPress={() => KittyNotifications.openAppInfo()} />
                </View>
              </View>
            )}

            <View style={s.row}>
              <Btn label={showSkipped ? 'Hide skipped' : 'Show skipped'} onPress={() => setShowSkipped(!showSkipped)} />
              <Btn label="Copy for Claude" onPress={copyForClaude} />
              <Btn label="Clear" onPress={clearAll} />
            </View>
            {!!note && <Text style={s.note}>{note}</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={[s.x, { textAlign: 'center', marginTop: 30 }]}>{enabled ? 'Nothing yet. Pay for something with a card and the alert will show up here.' : 'Switch on access above to start.'}</Text>}
        renderItem={({ item: p }) => {
          const k = KIND[p.kind];
          return (
            <View style={[s.item, p.kind === 'ignore' && { opacity: 0.55 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{p.merchant || (p.kind === 'spent' ? 'Shop not named' : k.label)}</Text>
                <Text style={s.meta} numberOfLines={2}>{[k.label, p.bank, timeOf(p.time), p.reason].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={[s.amt, { color: k.colour }]}>{p.kind === 'received' ? '+' : ''}{money(p.amount)}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Step({ n, t }: { n: string; t: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={s.stepN}>{n}</Text>
      <Text style={[s.x, { flex: 1, color: C.fg }]}>{t}</Text>
    </View>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, primary && { backgroundColor: C.gold }, pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }]}>
      <Text style={[s.btnT, primary && { color: C.goldInk }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
  h1: { color: C.fg, fontSize: 28, fontWeight: '700', marginTop: 8 },
  h2: { color: C.fg, fontSize: 17, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 14, marginTop: 2 },
  lead: { color: C.muted, fontSize: 15, marginTop: 12, lineHeight: 21 },
  card: { backgroundColor: C.surface, borderRadius: 18, padding: 16 },
  k: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  big: { color: C.fg, fontSize: 30, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  x: { color: C.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 14, height: 42, justifyContent: 'center' },
  btnT: { color: C.fg, fontWeight: '800', fontSize: 14 },
  note: { color: C.gold, fontSize: 13 },
  stepN: { color: C.goldInk, backgroundColor: C.gold, width: 22, height: 22, borderRadius: 11, textAlign: 'center', fontWeight: '800', fontSize: 13, lineHeight: 22, overflow: 'hidden' },
  item: { backgroundColor: C.surface, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: C.fg, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  amt: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
