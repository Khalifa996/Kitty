// Colour that moves: gradient hero cards, a ring for today's budget and a donut for where the money went.
import { useId, useRef, useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Rise } from './motion';
import { R } from './theme';

const svgId = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, '');

/** A card with a soft two-colour gradient and a glow in the top corner. */
export function GradientCard({ colours, glow, children, style, delay = 0 }: { colours: readonly string[]; glow?: string; children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const id = svgId(useId());
  return (
    <Rise delay={delay} style={[{ borderRadius: R.card, overflow: 'hidden' }, style]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colours[0]} />
            <Stop offset="1" stopColor={colours[1]} />
          </LinearGradient>
          {glow && (
            <RadialGradient id={`r${id}`} cx="88" cy="8" r="62" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={glow} stopOpacity="0.32" />
              <Stop offset="1" stopColor={glow} stopOpacity="0" />
            </RadialGradient>
          )}
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#g${id})`} />
        {glow && <Rect x="0" y="0" width="100" height="100" fill={`url(#r${id})`} />}
      </Svg>
      {children}
    </Rise>
  );
}

/** A ring that fills to `to` (0 to 1), with whatever goes in the middle. */
export function Ring({ to, colour, track, size = 76, width = 9, children }: { to: number; colour: string; track: string; size?: number; width?: number; children?: ReactNode }) {
  const r = (size - width) / 2, len = 2 * Math.PI * r;
  const [t, setT] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = v.addListener(({ value }) => setT(value));
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, to)), duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [to, v]);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={width} fill="none" />
        {t > 0.001 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={colour} strokeWidth={width} fill="none" strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - t)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      </Svg>
      {children}
    </View>
  );
}

/** Slices of a donut, biggest first, each in its category's colour. Spins into place. */
export function Donut({ parts, size = 132, width = 18, track, children }: { parts: { value: number; colour: string }[]; size?: number; width?: number; track: string; children?: ReactNode }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0);
  const [t, setT] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const id = v.addListener(({ value }) => setT(value));
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [total, v]);
  const c = size / 2, r = (size - width) / 2, gap = parts.length > 1 ? 0.012 : 0;
  let start = 0;
  const arcs = total > 0 ? parts.filter((p) => p.value > 0).map((p) => {
    const frac = (p.value / total) * t, a0 = start + gap / 2, a1 = start + frac - gap / 2;
    start += frac;
    if (a1 <= a0) return null;
    const pt = (f: number) => [c + r * Math.sin(f * 2 * Math.PI), c - r * Math.cos(f * 2 * Math.PI)];
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1), large = a1 - a0 > 0.5 ? 1 : 0;
    return { d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`, colour: p.colour };
  }) : [];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={width} fill="none" />
        {arcs.map((a, i) => a && <Path key={i} d={a.d} stroke={a.colour} strokeWidth={width} fill="none" strokeLinecap="butt" />)}
      </Svg>
      {children}
    </View>
  );
}
