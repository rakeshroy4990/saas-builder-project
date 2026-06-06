import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { NotificationsPanel } from '@/features/notifications/NotificationsPanel';
import { useNotificationStore } from '@/features/notifications/notificationStore';
import { colors } from '@/theme/colors';

export function NotificationHeaderButton() {
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const setPanelVisible = useNotificationStore((s) => s.setPanelVisible);
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0
            ? t('notifications.bellAriaWithCount', { count: unreadCount })
            : t('notifications.bellAria')
        }
        style={styles.button}
        onPress={() => setPanelVisible(true)}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        ) : null}
      </Pressable>
      <NotificationsPanel />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700'
  }
});
