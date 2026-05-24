import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type AuthBusyOverlayProps = {
  message: string;
};

/** Blocks interaction on auth screens while sign-in or redirect is in progress. */
export function AuthBusyOverlay({ message }: AuthBusyOverlayProps) {
  return (
    <View style={styles.overlay} accessibilityLiveRegion="polite" accessibilityLabel={message}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20,
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  card: {
    alignItems: 'center',
    gap: 16,
    maxWidth: 280
  },
  message: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22
  }
});
