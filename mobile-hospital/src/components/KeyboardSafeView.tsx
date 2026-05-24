import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useKeyboardInset } from '@/hooks/useKeyboardInset';

type KeyboardSafeViewProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** @deprecated Kept for call-site compatibility; lift is driven by measured keyboard height. */
  keyboardVerticalOffset?: number;
};

/**
 * Lifts children by the measured keyboard height so bottom text inputs stay visible while typing.
 */
export function KeyboardSafeView({ children, style }: KeyboardSafeViewProps) {
  const keyboardInset = useKeyboardInset();

  return (
    <View style={[{ flex: 1 }, style]}>
      <View style={{ flex: 1, marginBottom: keyboardInset }}>{children}</View>
    </View>
  );
}
