// Bring data across from the web app, switch on bank alerts, back up.
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isMoneyApp } from '../capture/useCapture';
import { aiAvailable, newInstallId } from '../ai/cloud';
import { aiSortedCount } from '../ai/useSmartSort';
import { KittyNotifications } from '../../modules/kitty-notifications';
import type { Capture } from '../capture/useCapture';
import type { State } from '../engine/types';
import { useKitty } from '../store/KittyState';
import { alertLog, parseBackup } from '../store/storage';
import { morningMessage } from '../engine/morning';
import { Btn, Card, Chip, Label } from '../ui/kit';
import { C, moneyS } from '../ui/theme';

const VERSION = '0.12';
// @ts-ignore process.env is provided by Expo
const BUILD: string = (process.env.EXPO_PUBLIC_KITTY_BUILD as string | undefined) || '';

export function MoreScreen({ cap, onDone }: { cap: Capture; onDone: (msg: string) => void }) {
  const { S, replace, update, today } = useKitty();
  const morning = S.settings.morning, canMorning = !!KittyNotifications?.setMorning;
  const [notifyOk, setNotifyOk] = useState(() => KittyNotifications?.canNotify?.() ?? true);
  const morningOn = async (on: boolean) => {
    if (on && Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) { setNotifyOk(false); onDone('Notifications are off for Crest. Turn them on in settings'); return; }
    }
    setNotifyOk(KittyNotifications?.canNotify?.() ?? true);
    update((d) => { d.settings.morning = { on, hour: d.settings.morning?.hour ?? 8 }; });
    onDone(on ? `Morning message on, at ${morning?.hour ?? 8}am` : 'Morning message off');
  };
  const morningNow = () => {
    const m = morningMessage(S, today, (p) => moneyS(p, S.settings.currency));
    KittyNotifications?.showNow?.(m.title, m.body || 'Nothing else to flag today.');
  };
  const aiOn = !!S.settings.ai?.on;
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
          <>
            <Text style={s.hint}>On. Crest reads payment alerts from the main UK banks and card apps, and from Google Wallet. They never leave your phone. It never reads chats, texts, email or social apps.</Text>
            <View style={[s.row, { alignItems: 'center' }]}>
              <Text style={[s.hint, { flex: 1, color: C.fg }]}>{S.settings.autoAdd !== false ? 'Adds the payments it\'s sure about by itself. You can check or change them in Review' : 'Waits for you to add every payment in Review'}</Text>
              <Btn label={S.settings.autoAdd !== false ? 'Ask me first' : 'Add by itself'} small onPress={() => update((d) => { d.settings.autoAdd = d.settings.autoAdd === false; })} />
            </View>
            {(S.settings.bizAccounts || []).map((n) => (
              <View key={n} style={[s.row, { alignItems: 'center' }]}>
                <Text style={[s.hint, { flex: 1, color: C.fg }]}>{n} is your business account: money in there is side income</Text>
                <Btn label="It isn't" small onPress={() => update((d) => {
                  d.settings.bizAccounts = (d.settings.bizAccounts || []).filter((x) => x !== n);
                  d.settings.notBizAccounts = [...(d.settings.notBizAccounts || []), n];
                })} />
              </View>
            ))}
            {cap.watched.map((a) => (
              <View key={a.pkg} style={[s.row, { alignItems: 'center' }]}>
                <Text style={[s.hint, { flex: 1, color: C.fg }]}>Also reading {a.label}</Text>
                <Btn label="Stop" small onPress={() => cap.watchApp(a.pkg, false)} />
              </View>
            ))}
            {cap.spotted.filter(isMoneyApp).map((a) => (
              <View key={a.pkg} style={[s.row, { alignItems: 'center' }]}>
                <Text style={[s.hint, { flex: 1 }]}>{a.label} posts money alerts</Text>
                <Btn label="Read them" small onPress={() => cap.watchApp(a.pkg, true)} />
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={[s.hint, { color: C.fg }]}>Off. Tap Allow access, find Crest and switch it on.</Text>
            <Text style={s.hint}>If Crest is greyed out, tap Open App info, then ⋮ at the top right, then "Allow restricted settings", and try again.</Text>
            <View style={s.row}>
              <Btn label="Allow access" primary onPress={() => KittyNotifications?.openSettings()} />
              <Btn label="Open App info" onPress={() => KittyNotifications?.openAppInfo()} />
            </View>
          </>
        )}
      </Card>

      {canMorning && (
        <Card style={{ gap: 10 }}>
          <Label>Morning message</Label>
          <Text style={s.hint}>{morning?.on ? `On, at ${morning.hour}am.` : 'Off.'} A notification each morning with what's safe to spend that day, bills going out and any category running fast. It's worked out when Crest was last open; if bank alerts came in since, it says so.</Text>
          {morning?.on && (
            <View style={[s.row, { flexWrap: 'wrap' }]}>
              {[7, 8, 9].map((h) => <Chip key={h} label={`${h}am`} on={morning.hour === h} onPress={() => update((d) => { d.settings.morning = { on: true, hour: h }; })} />)}
            </View>
          )}
          {morning?.on && !notifyOk && (
            <View style={{ gap: 8 }}>
              <Text style={[s.hint, { color: C.warn }]}>Notifications are off for Crest, so the message can't show.</Text>
              <Btn label="Open notification settings" onPress={() => { KittyNotifications?.openNotificationSettings?.(); setTimeout(() => setNotifyOk(KittyNotifications?.canNotify?.() ?? true), 4000); }} />
            </View>
          )}
          <View style={s.row}>
            <Btn label={morning?.on ? 'Turn off' : 'Turn on'} primary={!morning?.on} onPress={() => morningOn(!morning?.on)} />
            {morning?.on && <Btn label="Show today's now" onPress={morningNow} />}
          </View>
        </Card>
      )}

      {aiAvailable && (
        <Card style={{ gap: 10 }}>
          <Label>Smart sorting with AI</Label>
          <Text style={s.hint}>{aiOn ? `On. ${aiSortedCount()} alerts sorted so far.` : 'Off.'} When Crest can't tell what an alert is, or which category a shop belongs in, it can ask an AI.</Text>
          <Text style={s.hint}>Only that alert's text is sent, with account numbers removed. Your balance, history, bills and settings are never sent. It goes to Crest's AI service and is read by Claude, Anthropic's AI. Crest's service keeps no copy.</Text>
          <Btn label={aiOn ? 'Turn off' : 'Turn on smart sorting'} primary={!aiOn} onPress={() => {
            update((d) => { d.settings.ai = { on: !aiOn, install: d.settings.ai?.install || newInstallId() }; });
            onDone(aiOn ? 'Smart sorting is off. Nothing more will be sent' : 'Smart sorting is on');
          }} />
        </Card>
      )}

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

      <Text style={[s.hint, { textAlign: 'center' }]}>Crest {VERSION} · test build{BUILD ? ` 0.1.${BUILD}` : ''}. It checks GitHub for a newer test build every few hours, without sending anything about you.</Text>
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
