import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from './notificationApi';
import { resolveNotificationRoute } from './notificationRoutes';
import { useNotificationStore } from './notificationStore';

function formatTimeAgo(value: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('notifications.time.justNow');
  if (minutes < 60) return t('notifications.time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.time.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('notifications.time.daysAgo', { count: days });
}

export function NotificationsPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const visible = useNotificationStore((s) => s.panelVisible);
  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const setPanelVisible = useNotificationStore((s) => s.setPanelVisible);
  const setItems = useNotificationStore((s) => s.setItems);
  const setLoading = useNotificationStore((s) => s.setLoading);
  const markReadLocal = useNotificationStore((s) => s.markReadLocal);
  const markAllReadLocal = useNotificationStore((s) => s.markAllReadLocal);

  const close = () => setPanelVisible(false);

  const openPanel = async () => {
    setLoading(true);
    try {
      const nextItems = await fetchNotifications();
      setItems(nextItems);
    } catch {
      // Keep existing items on failure.
    } finally {
      setLoading(false);
    }
  };

  const onShow = () => {
    void openPanel();
  };

  const onMarkAllRead = async () => {
    markAllReadLocal();
    try {
      await markAllNotificationsRead();
    } catch {
      // Optimistic UI already applied.
    }
  };

  const onPressItem = async (externalId: string) => {
    const notification = items.find((entry) => entry.externalId === externalId);
    if (!notification) return;
    if (!notification.isRead) {
      markReadLocal(externalId);
      try {
        await markNotificationRead(externalId);
      } catch {
        // no-op
      }
    }
    close();
    const route = resolveNotificationRoute(notification);
    if (route) {
      router.push(route as never);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onShow={onShow} onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t('notifications.close')} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            <View style={styles.headerActions}>
              {unreadCount > 0 ? (
                <Pressable onPress={() => void onMarkAllRead()}>
                  <Text style={styles.markAll}>{t('notifications.markAllRead')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={close}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('notifications.close')}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <Text style={styles.empty}>{t('notifications.loading')}</Text>
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t('notifications.empty')}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {items.map((notification) => (
                <Pressable
                  key={notification.externalId}
                  style={[styles.item, !notification.isRead && styles.itemUnread]}
                  onPress={() => void onPressItem(notification.externalId)}
                >
                  <Text style={styles.itemTitle}>{notification.title}</Text>
                  <Text style={styles.itemMessage}>{notification.message}</Text>
                  <Text style={styles.itemTime}>{formatTimeAgo(notification.createdAt, t)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)'
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '82%',
    minHeight: 220,
    overflow: 'hidden'
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 4
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  closeBtnText: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.textMuted,
    fontWeight: '400'
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text
  },
  markAll: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: colors.textMuted
  },
  list: {
    paddingBottom: 12
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  itemUnread: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text
  },
  itemMessage: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted
  },
  itemTime: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textMuted
  }
});
