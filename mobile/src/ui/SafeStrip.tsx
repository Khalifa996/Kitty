// The one number: safe to spend today.
import { StyleSheet, Text, View } from 'react-native';
import { dayInfo, safeInfo } from '../engine/budget';
import { parse } from '../engine/dates';
import { useKitty } from '../store/KittyState';
import { C, moneyS } from './theme';

/** Today's safe-to-spend figure, or how a past day went when `day` is set. */
export function SafeStrip({ extraLine, day }: { extraLine?: string; day?: string | null }) {
  const { S, today } = useKitty();
  if (!S.settings.setupDone) return null;
  if (day && day !== today) {
    const d = dayInfo(S, day), cur = S.settings.currency, left = d.allowance - d.todaySpent;
    const name = parse(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return (
      <View style={s.strip} accessibilityLabel={`${name}: ${moneyS(Math.abs(left), cur)} ${left >= 0 ? 'under' : 'over'} budget`}>
        <View style={{ flexShrink: 0 }}>
          <Text style={s.k}>{name}</Text>
          <Text style={[s.big, left < 0 && { color: C.bad }]}>{moneyS(Math.abs(left), cur)} {left >= 0 ? 'under' : 'over'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <Text style={s.k}>Day {d.dayN} of {d.c.days}</Text>
          <Text style={s.after}>Spent {moneyS(d.todaySpent, cur)} of {moneyS(Math.max(0, d.allowance), cur)}</Text>
        </View>
      </View>
    );
  }
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
