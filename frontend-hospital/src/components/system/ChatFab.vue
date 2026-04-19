<script setup lang="ts">
import { computed } from 'vue';
import { usePopupStore } from '../../store/usePopupStore';
import { useAppStore } from '../../store/useAppStore';
import { pinia } from '../../store/pinia';

const popupStore = usePopupStore(pinia);
const appStore = useAppStore(pinia);

const isLoggedIn = computed(() => {
  const userId = String(appStore.getData('hospital', 'AuthSession')?.userId ?? '').trim();
  return userId.length > 0;
});

const isAdmin = computed(() => {
  const role = String(appStore.getData('hospital', 'AuthSession')?.role ?? '').trim().toUpperCase();
  return role === 'ADMIN';
});

/** Same source as `DynChat` incoming requests — admins only. */
const incomingSupportRequestCount = computed(() => {
  if (!isLoggedIn.value || !isAdmin.value) return 0;
  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
  const arr = chat.supportRequests;
  return Array.isArray(arr) ? arr.length : 0;
});

const badgeText = computed(() => {
  const n = incomingSupportRequestCount.value;
  if (n > 99) return '99+';
  return String(n);
});

const isChatOpen = computed(() => popupStore.isOpen && popupStore.pageId === 'chat-popup');

const fabAriaLabel = computed(() => {
  const n = incomingSupportRequestCount.value;
  const pending = n > 0 ? `, ${n} pending support ${n === 1 ? 'request' : 'requests'}` : '';
  if (isChatOpen.value) return `Close chat${pending}`;
  return n > 0 ? `Open chat${pending}` : 'Open chat';
});

const openChat = () => {
  if (!isLoggedIn.value) {
    popupStore.open({ packageName: 'hospital', pageId: 'login-popup', title: 'Login' });
    return;
  }
  popupStore.open({ packageName: 'hospital', pageId: 'chat-popup', title: 'Chat' });
};

const onFabClick = () => {
  if (isChatOpen.value) {
    popupStore.close();
    return;
  }
  openChat();
};
</script>

<template>
  <button
    id="hospital-chat-fab"
    type="button"
    class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200"
    :aria-label="fabAriaLabel"
    @click="onFabClick"
  >
    <span
      v-if="incomingSupportRequestCount > 0"
      class="pointer-events-none absolute right-0 top-0 z-10 flex min-h-5 min-w-5 translate-x-1 -translate-y-1 items-center justify-center rounded-full border-2 border-white bg-amber-600 px-1 text-[11px] font-bold leading-none text-white shadow-md tabular-nums"
      aria-hidden="true"
    >
      {{ badgeText }}
    </span>
    <!-- Closed: message bubble icon -->
    <svg
      v-if="!isChatOpen"
      viewBox="0 0 24 24"
      class="h-7 w-7"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H5.17L4 17.17V4h16v12Z"
      />
      <path d="M7 7h10v2H7V7Zm0 4h7v2H7v-2Z" />
    </svg>

    <!-- Open: arrow-up icon to collapse the widget -->
    <svg
      v-else
      viewBox="0 0 24 24"
      class="h-7 w-7"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      aria-hidden="true"
    >
      <path d="M12 5v14" stroke-linecap="round" />
      <path d="M6.5 10.5 12 5l5.5 5.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

