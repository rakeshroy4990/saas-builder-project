import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';
import { openMainTab } from '@/navigation/openTab';

function initialsFromUser(displayName: string, email: string): string {
  const name = displayName.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const local = email.split('@')[0]?.trim() ?? '';
  return local.slice(0, 2).toUpperCase() || '?';
}

export function UserHeaderButton() {
  const user = useSessionStore((s) => s.user);
  const accessToken = useSessionStore((s) => s.accessToken);

  if (!accessToken || !user) return null;

  const label = user.displayName?.trim() || user.email?.trim() || 'Account';
  const initials = initialsFromUser(user.displayName ?? '', user.email ?? '');

  return (
    <Pressable
      onPress={() => openMainTab('profile')}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Guest: login affordance in header. */
export function GuestHeaderButton({ signInLabel }: { signInLabel: string }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/(auth)/login')}
      style={styles.guestWrap}
      accessibilityRole="button"
      accessibilityLabel={signInLabel}
    >
      <View style={[styles.avatar, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>?</Text>
      </View>
      <Text style={[styles.name, { color: colors.primary }]} numberOfLines={1}>
        {signInLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 160,
    marginRight: 8
  },
  guestWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1
  }
});
