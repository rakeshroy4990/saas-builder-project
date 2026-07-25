import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { NotificationsPanel } from '@/features/notifications/NotificationsPanel';
import { useNotificationStore } from '@/features/notifications/notificationStore';
import { colors } from '@/theme/colors';

export function NotificationHeaderButton() {
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const panelVisible = useNotificationStore((s) => s.panelVisible);
  const setPanelVisible = useNotificationStore((s) => s.setPanelVisible);
  const hasUnread = unreadCount > 0;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasUnread
            ? t('notifications.bellAriaWithCount', { count: unreadCount })
            : t('notifications.bellAria')
        }
        style={({ pressed }) => [
          styles.button,
          panelVisible && styles.buttonActive,
          !panelVisible && hasUnread && styles.buttonUnread,
          pressed && styles.buttonPressed
        ]}
        onPress={() => setPanelVisible(true)}
      >
        <Ionicons
          name="notifications-outline"
          size={20}
          color={panelVisible || hasUnread ? colors.primaryDark : colors.textMuted}
        />
        {hasUnread ? (
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6
  },
  buttonUnread: {
    backgroundColor: '#ecfdf5'
  },
  buttonActive: {
    backgroundColor: '#d1fae5'
  },
  buttonPressed: {
    opacity: 0.85
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f43f5e',
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700'
  }
});
