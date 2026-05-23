import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';

const FAB_SIZE = 56;
const TAB_BAR_CLEARANCE = 64;

type ChatFabProps = {
  /** Extra bottom offset when tab bar is visible (default: above tab bar). */
  bottomOffset?: number;
};

/** Floating Chat AI entry — mirrors web `ChatFab.vue`, fixed bottom-right. */
export function ChatFab({ bottomOffset }: ChatFabProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const accessToken = useSessionStore((s) => s.accessToken);
  const bottom = bottomOffset ?? insets.bottom + TAB_BAR_CLEARANCE;

  if (pathname.includes('/chat')) {
    return null;
  }

  function onPress() {
    if (!accessToken) {
      router.push('/(auth)/login');
      return;
    }
    router.push('/(app)/(tabs)/chat' as never);
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.fab, { bottom }]}
      accessibilityRole="button"
      accessibilityLabel={t('nav.chat')}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>AI</Text>
      </View>
      <Ionicons name="chatbubbles" size={28} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 50
  },
  badge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: 0.5
  }
});
