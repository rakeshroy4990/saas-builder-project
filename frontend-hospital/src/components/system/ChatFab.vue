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

const openChat = () => {
  if (!isLoggedIn.value) {
    popupStore.open({ packageName: 'hospital', pageId: 'login-popup', title: 'Login' });
    return;
  }
  popupStore.open({ packageName: 'hospital', pageId: 'chat-popup', title: 'Chat' });
};

const isChatOpen = computed(() => popupStore.isOpen && popupStore.pageId === 'chat-popup');

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
    class="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-700 text-white shadow-xl transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200"
    :aria-label="isChatOpen ? 'Close chat' : 'Open chat'"
    @click="onFabClick"
  >
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

