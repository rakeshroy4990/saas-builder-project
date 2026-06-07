import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardInset } from '@/hooks/useKeyboardInset';

type KeyboardSafeViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When false, children are not lifted while the keyboard is open (e.g. parent modal handles its own lift). */
  liftEnabled?: boolean;
  /** @deprecated Kept for call-site compatibility; lift is driven by measured keyboard height. */
  keyboardVerticalOffset?: number;
};

/**
 * Lifts children by the measured keyboard height so bottom text inputs stay visible while typing.
 */
export function KeyboardSafeView({ children, style, liftEnabled = true }: KeyboardSafeViewProps) {
  const keyboardInset = useKeyboardInset();
  // Android uses softwareKeyboardLayoutMode: 'resize' — the window already shrinks above the keyboard.
  const marginBottom = liftEnabled && Platform.OS === 'ios' ? keyboardInset : 0;

  return (
    <View style={[{ flex: 1 }, style]}>
      <View style={{ flex: 1, marginBottom }}>{children}</View>
    </View>
  );
}
