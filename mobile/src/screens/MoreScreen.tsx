// Bring data across from the web app, switch on bank alerts, back up.
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KittyNotifications } from '../../modules/kitty-notifications';
import type { Capture } from '../capture/useCapture';
import type { State } from '../engine/types';
import { useKitty } from '../store/KittyState';
import { alertLog, parseBackup } from '../store/storage';
import { Btn, Card, Label } from '../ui/kit';
import { C } from '../ui/theme';

const VERSION = '0.4';

export function MoreScreen({ cap, onDone }: { cap: Capture; onDone: (msg: string) => void }) {
  const { S, replace } = useKitty();
  const [paste, setPaste] = useState('');
  const [found, setFound] = useState<State | null>(null);
  const [err, setErr] = useState('');

  const check = () => {
    setErr('');
    try { setFound(parseBackup(paste)); } catch (e) { setFound(null); setErr((e as Error).message); }
  };
  const doImport = () => {
    if (!found) return;
    replace(found); setFound(null); setPaste('');
    onDone(`Brought across ${found.tx.length} entries and ${found.bills.length} bills`);
  };
  const pasteNow = async () => { const t = await Clipboard.getStringAsync(); setPaste(t); setFound(null); setErr(''); };
  const copyBackup = async () => { await Clipboard.setStringAsync(JSON.stringify(S)); onDone(`Backup copied: ${S.tx.length} entries, ${S.bills.length} bills`); };
  const copyForClaude = async () => {
    const pending = cap.raw.map(({ pkg, title, text, time }) => ({ pkg, title, text, time }));
    const all = [...alertLog(), ...pending].slice(-120);
    await Clipboard.setStringAsync(JSON.stringify(all, null, 1));
    onDone(`Copied ${all.length} alerts. Check them for anything private before sending`);
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>More</Text>

      <Card style={{ gap: 10 }}>
        <Label>Bank alerts</Label>
        {!cap.native ? (
          <Text style={s.hint}>Reading bank alerts only works in the Android app.</Text>
        ) : cap.enabled ? (
          <Text style={s.hint}>On. Kitty reads payment alerts from Barclays, Revolut, Monzo, Starling, NatWest and Google Wallet. They never leave your phone.</Text>
        ) : (
          <>
            <Text style={[s.hint, { color: C.fg }]}>Off. Tap Allow access, find Kitty and switch it on.</Text>
            <Text style={s.hint}>If Kitty is greyed out, tap Open App info, then ⋮ at the top right, then "Allow restricted settings", and try again.</Text>
            <View style={s.row}>
              <Btn label="Allow access" primary onPress={() => KittyNotifications?.openSettings()} />
              <Btn label="Open App info" onPress={() => KittyNotifications?.openAppInfo()} />
            </View>
          </>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Label>Bring your data across</Label>
        <Text style={s.hint}>In the web app: Insights, then Settings, then Copy backup. Come back here and tap Paste. This replaces what's in this app.</Text>
        <View style={s.row}>
          <Btn label="Paste" onPress={pasteNow} />
          <Btn label="Check backup" primary={!!paste && !found} disabled={!paste} onPress={check} />
        </View>
        <TextInput value={paste} onChangeText={(t) => { setPaste(t); setFound(null); setErr(''); }} multiline placeholder="Or paste the backup here" placeholderTextColor={C.faint}
          style={s.box} accessibilityLabel="Backup text" />
        {!!err && <Text style={[s.hint, { color: C.bad }]}>{err}</Text>}
        {found && (
          <View style={{ gap: 8 }}>
            <Text style={[s.hint, { color: C.fg }]}>Found {found.tx.length} entries, {found.bills.length} bills and {found.pots.length} pot{found.pots.length === 1 ? '' : 's'}. {S.tx.length ? `This replaces the ${S.tx.length} entries in this app.` : ''}</Text>
            <Btn label="Bring it across" primary onPress={doImport} />
          </View>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Label>Your data</Label>
        <Text style={s.hint}>Stored on this phone only. Copy a backup now and then, and keep it somewhere safe.</Text>
        <View style={s.row}>
          <Btn label="Copy backup" onPress={copyBackup} />
          <Btn label="Copy alerts for Claude" onPress={copyForClaude} />
        </View>
      </Card>

      <Text style={[s.hint, { textAlign: 'center' }]}>Kitty {VERSION} · test build</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  h1: { color: C.fg, fontSize: 26, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  box: { backgroundColor: C.surface2, borderRadius: 10, minHeight: 90, maxHeight: 160, padding: 10, color: C.fg, fontSize: 12, textAlignVertical: 'top' },
});
