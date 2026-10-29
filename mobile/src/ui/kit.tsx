// Small building blocks shared by every screen.
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { C, R } from './theme';

export function Btn({ label, onPress, primary, danger, small, style, disabled }: {
  label: string; onPress: () => void; primary?: boolean; danger?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        k.btn, small && k.btnSmall, primary && { backgroundColor: C.gold }, disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }, style,
      ]}>
      <Text style={[k.btnT, small && { fontSize: 13 }, primary && { color: C.goldInk }, danger && { color: C.bad }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[k.card, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={k.label}>{children}</Text>;
}

export function Dot({ colour }: { colour: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colour }} />;
}

export function Chip({ label, on, colour, onPress }: { label: string; on?: boolean; colour?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [k.chip, on && { backgroundColor: C.fg }, pressed && { opacity: 0.7 }]}>
      {colour ? <Dot colour={colour} /> : null}
      <Text style={[k.chipT, on && { color: C.bg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** A panel that slides up from the bottom. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={k.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={k.sheet}>
        <View style={k.grab} />
        <Text style={k.sheetT}>{title}</Text>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </Modal>
  );
}

export const k = StyleSheet.create({
  btn: { backgroundColor: C.surface2, borderRadius: R.btn, paddingHorizontal: 16, height: 46, justifyContent: 'center', alignItems: 'center' },
  btnSmall: { height: 36, paddingHorizontal: 12 },
  btnT: { color: C.fg, fontWeight: '800', fontSize: 15 },
  card: { backgroundColor: C.surface, borderRadius: R.card, padding: 16 },
  label: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 12, height: 34, maxWidth: 220 },
  chipT: { color: C.fg, fontWeight: '700', fontSize: 13 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, maxHeight: '88%' },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 14 },
  sheetT: { color: C.fg, fontSize: 20, fontWeight: '700', marginBottom: 12 },
});
