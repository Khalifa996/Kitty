// The one number: safe to spend today. A colourful card that rolls to the new figure and fills a bar as the day goes.
import { StyleSheet, Text, View } from 'react-native';
import { dayInfo, safeInfo } from '../engine/budget';
import { parse } from '../engine/dates';
import { paceForecast } from '../engine/forecast';
import { useKitty } from '../store/KittyState';
import { GradientCard } from './Glow';
import { CountUp, GrowBar } from './motion';
import { C, G, moneyS } from './theme';

type Tone = 'ok' | 'low' | 'over';
const ink: Record<Tone, string> = { ok: C.good, low: C.gold, over: C.bad };

function Hero({ tone, label, value, suffix = '', cur, pill, line, lineBad, lineWarn, bar, a11y }: {
  tone: Tone; label: string; value: number; suffix?: string; cur: string; pill: string; line: string; lineBad?: boolean; lineWarn?: boolean; bar: number | null; a11y: string;
}) {
  return (
    <GradientCard colours={G[tone]} glow={ink[tone]} style={s.strip}>
      <View accessible accessibilityLabel={a11y} style={{ gap: 8 }}>
        <View style={s.row}>
          <View style={{ flexShrink: 0 }}>
            <Text style={s.k}>{label}</Text>
            <CountUp value={value} format={(n) => moneyS(n, cur) + suffix} style={[s.big, { color: ink[tone] }]} />
          </View>
          <View style={{ alignItems: 'flex-end', flexShrink: 1, gap: 5 }}>
            <View style={s.pill}><Text style={s.pillT}>{pill}</Text></View>
            <Text style={[s.after, lineWarn && { color: C.warn }, lineBad && { color: C.bad }]}>{line}</Text>
          </View>
        </View>
        {bar !== null && <GrowBar to={bar} colour={bar >= 1 ? C.bad : bar >= 0.75 ? C.gold : C.good} height={6} track={C.track} />}
      </View>
    </GradientCard>
  );
}

/** Today's safe-to-spend figure, or how a past day went when `day` is set. */
export function SafeStrip({ extraLine, day }: { extraLine?: string; day?: string | null }) {
  const { S, today } = useKitty();
  if (!S.settings.setupDone) return null;
  const cur = S.settings.currency;
  if (day && day !== today) {
    const d = dayInfo(S, day), left = d.allowance - d.todaySpent;
    const name = parse(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return <Hero tone={left < 0 ? 'over' : 'ok'} label={name} value={Math.abs(left)} suffix={left >= 0 ? ' under' : ' over'} cur={cur}
      pill={`Day ${d.dayN} of ${d.c.days}`} line={`Spent ${moneyS(d.todaySpent, cur)} of ${moneyS(Math.max(0, d.allowance), cur)}`}
      bar={d.allowance > 0 ? d.todaySpent / d.allowance : d.todaySpent > 0 ? 1 : 0}
      a11y={`${name}: ${moneyS(Math.abs(left), cur)} ${left >= 0 ? 'under' : 'over'} budget`} />;
  }
  const si = safeInfo(S, today), over = si.safe < 0;
  // The pay month's money has gone: a minus figure per day means little, so say how far over the month is and when payday comes
  if (si.left < 0) {
    const days = si.daysLeft;
    return <Hero tone="over" label="Over this pay month" value={-si.left} cur={cur} pill={`Day ${si.dayN} of ${si.c.days}`}
      line={extraLine ?? `Payday in ${days} ${days === 1 ? 'day' : 'days'}. Money in before then comes off this first`} bar={null}
      a11y={`${moneyS(-si.left, cur)} over for this pay month`} />;
  }
  // After a week, if your usual spending would run out before payday, say so here rather than only in Insights
  const pace = !over && !extraLine ? paceForecast(S, today) : null;
  const short = pace && pace.endLeft < 0 ? pace : null;
  const pounds = (p: number) => moneyS(Math.round(p / 100) * 100, cur);
  const right = extraLine
    ?? (over ? (si.tomorrow === null ? 'Last day of the cycle' : si.tomorrow < 0 ? 'Cycle budget used up' : `${moneyS(si.tomorrow, cur)}/day from tomorrow`)
      : short ? (short.runOut
        ? `At your usual ${pounds(short.perDay)} a day, it runs out ${parse(short.runOut).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
        : `At your usual ${pounds(short.perDay)} a day, ${pounds(-short.endLeft)} short by payday`)
      : `${moneyS(si.allowance, cur)} daily budget`);
  const tone: Tone = over ? 'over' : si.safe < si.allowance * 0.25 ? 'low' : 'ok';
  return <Hero tone={tone} label={over ? 'Over budget today' : 'Safe to spend today'} value={Math.abs(si.safe)} cur={cur}
    pill={`Day ${si.dayN} of ${si.c.days}`} line={right} lineBad={over && si.tomorrow !== null && si.tomorrow < 0} lineWarn={!!short}
    bar={si.allowance > 0 ? si.todaySpent / si.allowance : si.todaySpent > 0 ? 1 : 0}
    a11y={`${over ? 'Over budget today' : 'Safe to spend today'} ${moneyS(Math.abs(si.safe), cur)}`} />;
}

const s = StyleSheet.create({
  strip: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  k: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  big: { fontSize: 30, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] },
  pill: { backgroundColor: C.track, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillT: { color: C.fg, fontSize: 11, fontWeight: '800' },
  after: { color: C.muted, fontSize: 13, textAlign: 'right' },
});
