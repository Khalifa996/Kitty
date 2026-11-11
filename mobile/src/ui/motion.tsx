// Movement and feel: springy presses, cards that rise in, numbers that count, and a little buzz under the thumb.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { C } from './theme';

/** The native driver isn't there in the browser preview. */
export const native = Platform.OS !== 'web';
const APressable = Animated.createAnimatedComponent(Pressable);

/** A light tick for choices, a firmer tap for actions, a happy buzz when something is saved. */
export const feel = {
  tick: () => { if (native) Haptics.selectionAsync().catch(() => {}); },
  tap: () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  done: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  oops: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
};

/** Pressable that squashes a little under the thumb and springs back. */
export function Pop({ children, style, onPress, scale = 0.94, haptic = 'tick', disabled, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode; style?: StyleProp<ViewStyle>; scale?: number; haptic?: 'tick' | 'tap' | 'none';
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: native, speed: 40, bounciness: x === 1 ? 12 : 0 }).start();
  return (
    <APressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => { to(scale); rest.onPressIn?.(e); }}
      onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}
      onPress={(e) => { if (haptic !== 'none') feel[haptic](); onPress?.(e); }}
      style={[style, { transform: [{ scale: v }] }]}>
      {children}
    </APressable>
  );
}

/** Fades and floats up into place when it first appears. `delay` staggers a list. */
export function Rise({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.back(1.4)), useNativeDriver: native }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** A number that rolls to its new value instead of jumping. `format` turns the number into text. */
export function CountUp({ value, format, style, duration = 650 }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value), anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (from.current === value) return;
    const start = from.current;
    anim.setValue(0);
    const id = anim.addListener(({ value: t }) => setShown(Math.round(start + (value - start) * t)));
    Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
      anim.removeListener(id); setShown(value); from.current = value;
    });
    return () => { anim.stopAnimation(); anim.removeListener(id); from.current = value; };
  }, [value, duration, anim]);
  return <Animated.Text style={style}>{format(shown)}</Animated.Text>;
}

/** A little pulse whenever `on` changes: the amount on the keypad as you type. */
export function Bump({ on, children, style }: { on: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(1)).current, first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    v.setValue(1.07);
    Animated.spring(v, { toValue: 1, useNativeDriver: native, bounciness: 14, speed: 30 }).start();
  }, [on, v]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** Grows a bar to its width. `to` is 0 to 1. */
export function GrowBar({ to, colour, height = 8, track }: { to: number; colour: string; height?: number; track: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: Math.max(0, Math.min(1, to)), duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, to]);
  return (
    <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: colour, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </Animated.View>
  );
}

/** An on/off switch with a springy knob. Clearer than a button that says "On". */
export function Toggle({ on, onChange, label, colour }: { on: boolean; onChange: (on: boolean) => void; label: string; colour: string }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: false, bounciness: 10, speed: 18 }).start(); }, [on, v]);
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} hitSlop={8}
      onPress={() => { feel.tick(); onChange(!on); }}>
      <Animated.View style={{ width: 52, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center',
        backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [C.off, colour] }) }}>
        <Animated.View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.knob,
          transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }] }} />
      </Animated.View>
    </Pressable>
  );
}
