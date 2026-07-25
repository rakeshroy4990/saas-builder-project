<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { NotificationItem } from '@saas-builder/hospital-api-client';
import { ServiceRegistry } from '../../core/registry/ServiceRegistry';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';
import { resolveNotificationAction } from '../../configs/hospital/notification-config';

defineProps<{
  config?: Record<string, unknown>;
}>();

const PANEL_MAX_WIDTH = 380;
const PANEL_OFFSET_Y = 8;
const PAGE_HORIZONTAL_PADDING = 16;
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore(pinia);
const rootRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const panelStyle = ref<{ top: string; left: string }>({
  top: '0px',
  left: '0px'
});
const panelPositioned = ref(false);

const notificationsState = computed(() => {
  return (appStore.getData('hospital', 'Notifications') ?? {}) as {
    items?: NotificationItem[];
    unreadCount?: number;
    panelOpen?: boolean;
    isLoading?: boolean;
  };
});

const unreadCount = computed(() => Math.max(0, Number(notificationsState.value.unreadCount ?? 0)));
const hasUnread = computed(() => unreadCount.value > 0);
const badgeText = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)));
const panelOpen = computed(() => Boolean(notificationsState.value.panelOpen));
const isLoading = computed(() => Boolean(notificationsState.value.isLoading));
const items = computed(() =>
  Array.isArray(notificationsState.value.items) ? notificationsState.value.items : []
);

const groupedItems = computed(() => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<'today' | 'yesterday' | 'earlier', NotificationItem[]> = {
    today: [],
    yesterday: [],
    earlier: []
  };
  for (const item of items.value) {
    const bucket = new Date(item.createdAt).toDateString();
    if (bucket === today) groups.today.push(item);
    else if (bucket === yesterday) groups.yesterday.push(item);
    else groups.earlier.push(item);
  }
  return groups;
});

async function runService(serviceId: string, data: Record<string, unknown> = {}) {
  const service = ServiceRegistry.getInstance().get('hospital', serviceId);
  if (!service) return null;
  return service.execute({ data });
}

function setPanelOpen(open: boolean) {
  const current = notificationsState.value;
  appStore.setData('hospital', 'Notifications', { ...current, panelOpen: open });
}

async function togglePanel() {
  const next = !panelOpen.value;
  setPanelOpen(next);
  if (next) {
    appStore.setData('hospital', 'Notifications', {
      ...notificationsState.value,
      panelOpen: true,
      isLoading: true
    });
    await runService('load-notifications');
    await positionPanelAfterOpen();
  }
}

function getViewportMetrics() {
  const visualViewport = window.visualViewport;
  return {
    width: visualViewport?.width ?? window.innerWidth,
    offsetLeft: visualViewport?.offsetLeft ?? 0
  };
}

function findPageRoot(): HTMLElement | null {
  let node: HTMLElement | null | undefined = rootRef.value;
  while (node) {
    const id = node.id ?? '';
    if (id.endsWith('-page') && !id.endsWith('-page-host')) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Left edge shared by header, hero, and section cards (`hosp.page.root` horizontal padding). */
function getSiteCardAlignmentLeft(): number {
  const pageRoot = findPageRoot();
  if (pageRoot) {
    const rect = pageRoot.getBoundingClientRect();
    const padLeft = Number.parseFloat(window.getComputedStyle(pageRoot).paddingLeft) || 0;
    return rect.left + padLeft;
  }

  let node: HTMLElement | null | undefined = rootRef.value;
  while (node) {
    const id = node.id ?? '';
    if (id.includes('hospital-public-header') && !id.includes('actions') && !id.includes('nav')) {
      return node.getBoundingClientRect().left;
    }
    node = node.parentElement;
  }

  const { offsetLeft } = getViewportMetrics();
  return offsetLeft + PAGE_HORIZONTAL_PADDING;
}

function getSiteCardAlignmentRight(): number {
  const pageRoot = findPageRoot();
  if (pageRoot) {
    const rect = pageRoot.getBoundingClientRect();
    const padRight = Number.parseFloat(window.getComputedStyle(pageRoot).paddingRight) || 0;
    return rect.right - padRight;
  }

  const { width, offsetLeft } = getViewportMetrics();
  return offsetLeft + width - PAGE_HORIZONTAL_PADDING;
}

function measurePanelWidth(): number {
  const panel = panelRef.value;
  if (panel) {
    const measured = panel.getBoundingClientRect().width;
    if (measured > 0) return measured;
  }
  const { width } = getViewportMetrics();
  return Math.min(width * 0.92, PANEL_MAX_WIDTH);
}

async function positionPanelAfterOpen() {
  panelPositioned.value = false;
  await nextTick();
  updatePanelPosition();
  await nextTick();
  updatePanelPosition();
  panelPositioned.value = true;
}

function updatePanelPosition() {
  const root = rootRef.value;
  if (!root || !panelOpen.value) return;

  const bellRect = root.getBoundingClientRect();
  const panelWidth = measurePanelWidth();
  const isMobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  const cardLeft = getSiteCardAlignmentLeft();
  const cardRight = getSiteCardAlignmentRight();

  let left: number;
  if (isMobile) {
    left = cardLeft;
  } else {
    left = bellRect.right - panelWidth;
    if (left < cardLeft) {
      left = cardRight - panelWidth;
    }
    left = Math.max(cardLeft, left);
  }

  panelStyle.value = {
    top: `${bellRect.bottom + PANEL_OFFSET_Y}px`,
    left: `${left}px`
  };
}

async function markAllRead() {
  await runService('mark-all-notifications-read');
}

function formatTimeAgo(value: string): string {
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

async function navigateForNotification(notification: NotificationItem) {
  if (!notification.isRead) {
    await runService('mark-notification-read', { notificationId: notification.externalId });
  }
  setPanelOpen(false);

  const mapping = resolveNotificationAction(notification.eventType);
  if (!mapping) return;

  const entityId =
    mapping.entityKey === 'entityExternalId'
      ? String(notification.entityExternalId ?? '').trim()
      : String(notification.entityRefId ?? notification.entityExternalId ?? '').trim();

  const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
  const role = String(authSession.role ?? 'PATIENT').trim().toUpperCase();

  if (mapping.actionId === 'navigate-profile') {
    await router.push('/profile');
    return;
  }

  if (mapping.actionId === 'set-dashboard-admin-tab') {
    appStore.setData('hospital', 'DashboardNav', { activeItem: 'admin' });
    await router.push('/dashboard');
    return;
  }

  if (mapping.actionId === 'open-notification-dashboard-appointments') {
    appStore.setData('hospital', 'DashboardNav', { activeItem: 'appointments' });
    await router.push('/dashboard');
    return;
  }

  if (mapping.actionId === 'open-notification-video-call' && entityId) {
    await runService('open-appointment-video-call', { appointmentId: entityId });
    return;
  }

  if (mapping.actionId === 'open-notification-appointment') {
    appStore.setData('hospital', 'DashboardNav', { activeItem: 'appointments' });
    if (entityId) {
      appStore.setData('hospital', 'NotificationUiState', { highlightAppointmentId: entityId });
    }
    await router.push('/dashboard');
  }
}

const onPointerDownCapture = (event: PointerEvent) => {
  if (!panelOpen.value) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (rootRef.value?.contains(target)) return;
  if (panelRef.value?.contains(target)) return;
  setPanelOpen(false);
};

watch(panelOpen, async (open) => {
  if (!open) {
    panelPositioned.value = false;
    return;
  }
  await positionPanelAfterOpen();
});

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDownCapture, true);
  window.addEventListener('resize', updatePanelPosition);
  window.addEventListener('scroll', updatePanelPosition, true);
  window.visualViewport?.addEventListener('resize', updatePanelPosition);
  window.visualViewport?.addEventListener('scroll', updatePanelPosition);
  void runService('init-notifications');
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDownCapture, true);
  window.removeEventListener('resize', updatePanelPosition);
  window.removeEventListener('scroll', updatePanelPosition, true);
  window.visualViewport?.removeEventListener('resize', updatePanelPosition);
  window.visualViewport?.removeEventListener('scroll', updatePanelPosition);
});
</script>

<template>
  <div ref="rootRef" class="relative shrink-0" data-notification-bell-root>
    <button
      type="button"
      class="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-0 p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      :class="
        panelOpen
          ? 'bg-emerald-100 text-emerald-700'
          : hasUnread
            ? 'text-emerald-700 hover:bg-emerald-50'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
      "
      :aria-expanded="panelOpen"
      :aria-label="hasUnread ? t('notifications.bellAriaWithCount', { count: unreadCount }) : t('notifications.bellAria')"
      :title="hasUnread ? t('notifications.bellAriaWithCount', { count: unreadCount }) : t('notifications.bellAria')"
      @click="togglePanel"
    >
      <svg
        viewBox="0 0 24 24"
        class="h-5 w-5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      <span
        v-if="hasUnread"
        class="pointer-events-none absolute right-0.5 top-0.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white tabular-nums"
        aria-hidden="true"
      >
        {{ badgeText }}
      </span>
    </button>

    <Teleport to="body">
      <div
        v-if="panelOpen"
        ref="panelRef"
        class="fixed z-[1000] w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        :class="panelPositioned ? '' : 'invisible'"
        :style="panelStyle"
      >
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 class="text-sm font-semibold text-slate-900">{{ t('notifications.title') }}</h3>
        <button
          v-if="hasUnread"
          type="button"
          class="text-xs font-medium text-sky-700 hover:text-sky-900"
          @click="markAllRead"
        >
          {{ t('notifications.markAllRead') }}
        </button>
      </div>

      <div v-if="isLoading" class="px-4 py-8 text-center text-sm text-slate-500">
        {{ t('notifications.loading') }}
      </div>

      <div v-else-if="items.length === 0" class="flex flex-col items-center px-4 py-10 text-slate-400">
        <svg viewBox="0 0 24 24" class="mb-2 h-8 w-8 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        <p class="text-sm">{{ t('notifications.empty') }}</p>
      </div>

      <div v-else class="max-h-[480px] overflow-y-auto">
        <template v-for="group in ([
          { key: 'today', label: t('notifications.groups.today') },
          { key: 'yesterday', label: t('notifications.groups.yesterday') },
          { key: 'earlier', label: t('notifications.groups.earlier') }
        ] as const)" :key="group.key">
          <template v-if="groupedItems[group.key].length">
            <div class="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {{ group.label }}
            </div>
            <button
              v-for="notification in groupedItems[group.key]"
              :key="notification.externalId"
              type="button"
              class="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50"
              :class="notification.isRead ? '' : 'border-l-[3px] border-l-sky-700 bg-sky-50/70'"
              @click="navigateForNotification(notification)"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-slate-900">{{ notification.title }}</p>
                <p class="mt-0.5 line-clamp-2 text-xs text-slate-600">{{ notification.message }}</p>
                <span class="mt-1 block text-[11px] text-slate-400">{{ formatTimeAgo(notification.createdAt) }}</span>
              </div>
              <span
                v-if="!notification.isRead"
                class="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-700"
                aria-hidden="true"
              />
            </button>
          </template>
        </template>
      </div>
    </div>
    </Teleport>
  </div>
</template>
