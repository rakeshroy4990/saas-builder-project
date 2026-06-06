import type { NotificationItem } from '@saas-builder/hospital-api-client';
import { create } from 'zustand';

type NotificationStore = {
  items: NotificationItem[];
  unreadCount: number;
  panelVisible: boolean;
  isLoading: boolean;
  setItems: (items: NotificationItem[]) => void;
  setUnreadCount: (count: number) => void;
  setPanelVisible: (visible: boolean) => void;
  setLoading: (loading: boolean) => void;
  upsertItem: (item: NotificationItem) => void;
  markReadLocal: (externalId: string) => void;
  markAllReadLocal: () => void;
  reset: () => void;
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  items: [],
  unreadCount: 0,
  panelVisible: false,
  isLoading: false,
  setItems: (items) =>
    set({
      items,
      unreadCount: items.filter((entry) => !entry.isRead).length
    }),
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  setPanelVisible: (visible) => set({ panelVisible: visible }),
  setLoading: (loading) => set({ isLoading: loading }),
  upsertItem: (item) => {
    const current = get().items;
    const index = current.findIndex((entry) => entry.externalId === item.externalId);
    const next =
      index >= 0
        ? current.map((entry, i) => (i === index ? { ...entry, ...item } : entry))
        : [item, ...current];
    set({
      items: next.slice(0, 50),
      unreadCount: next.filter((entry) => !entry.isRead).length
    });
  },
  markReadLocal: (externalId) => {
    const next = get().items.map((entry) =>
      entry.externalId === externalId ? { ...entry, isRead: true } : entry
    );
    set({
      items: next,
      unreadCount: next.filter((entry) => !entry.isRead).length
    });
  },
  markAllReadLocal: () => {
    set({
      items: get().items.map((entry) => ({ ...entry, isRead: true })),
      unreadCount: 0
    });
  },
  reset: () =>
    set({
      items: [],
      unreadCount: 0,
      panelVisible: false,
      isLoading: false
    })
}));
