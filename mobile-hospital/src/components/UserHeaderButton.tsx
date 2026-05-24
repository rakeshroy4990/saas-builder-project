import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { initialsFromUser } from '@/auth/userInitials';
import { openMainTab } from '@/navigation/openTab';
import { colors } from '@/theme/colors';

export function UserHeaderButton() {
  const user = useSessionStore((s) => s.user);
  const accessToken = useSessionStore((s) => s.accessToken);

  if (!accessToken || !user) return null;

  const initials = initialsFromUser(user.displayName ?? '', user.email ?? '');
  const accessibilityLabel = user.displayName?.trim() || user.email?.trim() || 'Profile';

  return (
    <Pressable
      onPress={() => openMainTab('profile')}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.avatar}>
        <Text style={[styles.avatarText, initials.length > 1 && styles.avatarTextCompact]}>{initials}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 8
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  avatarTextCompact: {
    fontSize: 10,
    letterSpacing: -0.5
  }
});
