// Ask Crest: questions about your money in plain words ("Can I afford £80 on Friday?"), answered from your own figures.
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { askLoop, type Msg } from '../ai/ask';
import { askService, newInstallId } from '../ai/cloud';
import { useKitty } from '../store/KittyState';
import { Btn, Chip, Sheet } from '../ui/kit';
import { C } from '../ui/theme';

const IDEAS = [
  'Can I afford £80 on Friday?',
  'What did I spend most on this pay month?',
  'How much have I spent on eating out in the last 30 days?',
  'Which bills are coming up this week?',
  'When will my debts be paid off?',
  'Where is this pay month heading?',
];

type Turn = { q: string; a: string };

export function AskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { S, today, update } = useKitty();
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const on = !!S.settings.ai?.on && !!S.settings.ai?.install;

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy || !S.settings.ai?.install) return;
    setBusy(true); setErr(''); setQ('');
    // Earlier questions and answers as plain text, so "and last month?" makes sense
    const prior: Msg[] = turns.slice(-3).flatMap((t) => [{ role: 'user' as const, content: t.q }, { role: 'assistant' as const, content: t.a }]);
    try {
      const install = S.settings.ai.install;
      const a = await askLoop(text, prior, S, today, (messages) => askService(messages, today, S.settings.currency, install));
      setTurns((ts) => [...ts, { q: text, a }]);
    } catch (e) {
      setErr(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Crest couldn’t reach its AI service. Check you’re online and try again.');
      setQ(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Ask Crest">
      {!on ? (
        <>
          <Text style={s.hint}>Ask about your money in your own words. Claude answers using figures Crest works out on your phone: your question and those figures go to Crest's AI service, your list of payments stays here, and nothing is kept.</Text>
          <Btn label="Turn on Ask Crest" primary onPress={() => update((d) => { d.settings.ai = { on: true, install: d.settings.ai?.install || newInstallId() }; })} />
          <Text style={s.meta}>This also turns on Smart sorting for alerts Crest can't sort. You can turn both off in More.</Text>
        </>
      ) : (
        <>
          {turns.length === 0 && (
            <View style={s.ideas}>
              {IDEAS.map((i) => <Chip key={i} label={i} onPress={() => ask(i)} />)}
            </View>
          )}
          {turns.map((t, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text style={s.q}>{t.q}</Text>
              <Text style={s.a}>{t.a}</Text>
            </View>
          ))}
          {busy && <View style={[s.row, { gap: 10 }]}><ActivityIndicator color={C.gold} /><Text style={s.meta}>Working it out…</Text></View>}
          {!!err && <Text style={[s.hint, { color: C.warn }]}>{err}</Text>}
          <View style={s.row}>
            <TextInput value={q} onChangeText={setQ} placeholder="Ask about your money" placeholderTextColor={C.faint} style={s.field}
              returnKeyType="send" onSubmitEditing={() => ask(q)} editable={!busy} accessibilityLabel="Your question" />
            <Btn label="Ask" primary small disabled={busy || !q.trim()} onPress={() => ask(q)} />
          </View>
          <Text style={s.meta}>Tap the microphone on your keyboard to ask out loud. Answers can be wrong; the figures in Crest are the ones to trust.</Text>
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  hint: { color: C.muted, fontSize: 14, lineHeight: 20 },
  meta: { color: C.faint, fontSize: 12, lineHeight: 17 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  q: { color: C.muted, fontSize: 13, fontWeight: '700' },
  a: { color: C.fg, fontSize: 16, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: { flex: 1, backgroundColor: C.surface2, color: C.fg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
