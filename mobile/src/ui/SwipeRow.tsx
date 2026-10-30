// A list row you can swipe: left to delete, right to edit. Screen readers get the same two actions.
import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { C } from './theme';

export function SwipeRow({ children, onDelete, onEdit, style }: { children: ReactNode; onDelete: () => void; onEdit: () => void; style?: StyleProp<ViewStyle> }) {
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(360);
  const cb = useRef({ onDelete, onEdit });
  cb.current = { onDelete, onEdit };

  const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const w = width.current;
      if (g.dx < -w * 0.35 || (g.vx < -1.2 && g.dx < -40)) {
        Animated.timing(x, { toValue: -w, duration: 150, useNativeDriver: true }).start(() => cb.current.onDelete());
      } else if (g.dx > w * 0.22 || (g.vx > 1.2 && g.dx > 40)) {
        back();
        cb.current.onEdit();
      } else back();
    },
    onPanResponderTerminate: back,
  })).current;

  const editOn = x.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });
  const delOn = x.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={[{ overflow: 'hidden' }, style]} onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
      accessible={false}>
      <Animated.View style={[StyleSheet.absoluteFill, s.edit, { opacity: editOn }]}>
        <Icon name="pencil" size={18} colour={C.goldInk} /><Text style={[s.t, { color: C.goldInk }]}>Edit</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, s.del, { opacity: delOn }]}>
        <Text style={[s.t, { color: C.fg }]}>Delete</Text><Icon name="trash" size={18} colour={C.fg} />
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}
        accessibilityActions={[{ name: 'edit', label: 'Edit' }, { name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'delete' ? onDelete() : onEdit())}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  edit: { backgroundColor: C.gold, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  del: { backgroundColor: C.bad, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingHorizontal: 20 },
  t: { fontWeight: '800', fontSize: 14 },
});
