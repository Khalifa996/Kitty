// The one number: safe to spend today.
import { StyleSheet, Text, View } from 'react-native';
import { safeInfo } from '../engine/budget';
import { useKitty } from '../store/KittyState';
import { C, moneyS } from './theme';

export function SafeStrip({ extraLine }: { extraLine?: string }) {
  const { S, today } = useKitty();
  if (!S.settings.setupDone) return null;
  const si = safeInfo(S, today), cur = S.settings.currency, over = si.safe < 0;
  const right = extraLine
    ?? (over ? (si.tomorrow === null ? 'Last day of the cycle' : si.tomorrow < 0 ? 'Cycle budget used up' : `${moneyS(si.tomorrow, cur)}/day from tomorrow`)
      : `${moneyS(si.allowance, cur)} daily budget`);
  return (
    <View style={s.strip} accessibilityLabel={`${over ? 'Over budget today' : 'Safe to spend today'} ${moneyS(Math.abs(si.safe), cur)}`}>
      <View style={{ flexShrink: 0 }}>
        <Text style={s.k}>{over ? 'Over budget today' : 'Safe to spend today'}</Text>
        <Text style={[s.big, over && { color: C.bad }]}>{moneyS(Math.abs(si.safe), cur)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text style={s.k}>Day {si.dayN} of {si.c.days}</Text>
        <Text style={[s.after, over && si.tomorrow !== null && si.tomorrow < 0 && { color: C.bad }]}>{right}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  strip: { backgroundColor: C.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  k: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  big: { color: C.good, fontSize: 26, fontWeight: '700', marginTop: 3, fontVariant: ['tabular-nums'] },
  after: { color: C.muted, fontSize: 13, marginTop: 4, textAlign: 'right' },
});
