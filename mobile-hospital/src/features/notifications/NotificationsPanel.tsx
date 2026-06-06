import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

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
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            {unreadCount > 0 ? (
              <Pressable onPress={() => void onMarkAllRead()}>
                <Text style={styles.markAll}>{t('notifications.markAllRead')}</Text>
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <Text style={styles.empty}>{t('notifications.loading')}</Text>
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t('notifications.empty')}</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: 12
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '78%',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
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
