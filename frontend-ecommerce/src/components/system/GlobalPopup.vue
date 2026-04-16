<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePopupStore } from '../../store/usePopupStore';
import { PageRegistry } from '../../core/registry/PageRegistry';
import { resolveStyle } from '../../core/engine/StyleResolver';
import DynamicContainer from '../renderer/DynamicContainer.vue';
import { resolvePageRootDomId } from '../../core/utils/domId';
import { pageRegistryRevision } from '../../core/registry/pageRegistryRevision';
import { ActionEngine } from '../../core/engine/ActionEngine';

const popupStore = usePopupStore();
const router = useRouter();
const pageConfig = computed(() => {
  void pageRegistryRevision.value;
  if (!popupStore.pageId || !popupStore.packageName) return null;
  return PageRegistry.getInstance().get(popupStore.packageName, popupStore.pageId) ?? null;
});

const backdropClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.backdrop' }));
const panelClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.panel' }));
const errorTitleClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.errorTitle' }));
const errorBodyClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.errorBody' }));
const closeButtonClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.closeButton' }));

const isChatPopup = computed(() => popupStore.pageId === 'chat-popup' && popupStore.packageName === 'ecommerce');

const popupPageRootId = computed(() => {
  if (!popupStore.packageName || !popupStore.pageId) return 'system-popup-page';
  const cfg = pageConfig.value;
  return resolvePageRootDomId({
    packageName: popupStore.packageName,
    pageId: popupStore.pageId,
    pageDomId: cfg?.domId,
    containerDomId: cfg?.container.domId,
    fallbackId: `${popupStore.packageName}-${popupStore.pageId}-popup-page`
  });
});

/** Popups skip `DynamicPage`; run `initializeActions` here (e.g. `chat-connect` for chat-popup). */
let popupInitGeneration = 0;
let lastInitializedPopupKey = '';
watch(
  () =>
    [
      popupStore.isOpen,
      popupStore.isError,
      popupStore.packageName ?? '',
      popupStore.pageId ?? '',
      pageConfig.value
    ] as const,
  async ([isOpen, isError, packageName, pageId, cfg]) => {
    if (!isOpen) {
      lastInitializedPopupKey = '';
      return;
    }
    if (isError || !cfg?.initializeActions?.length) return;
    const popupKey = `${packageName}:${pageId}`;
    if (popupKey === lastInitializedPopupKey) return;
    lastInitializedPopupKey = popupKey;
    const generation = ++popupInitGeneration;
    await nextTick();
    if (generation !== popupInitGeneration) return;
    const engine = new ActionEngine(cfg, router);
    for (const action of cfg.initializeActions) {
      await engine.execute(action);
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="popupStore.isOpen && !isChatPopup"
      id="system-popup-backdrop"
      :class="backdropClass"
    >
      <div id="system-popup-panel" :class="panelClass">
        <template v-if="popupStore.isError">
          <h2 id="system-popup-error-title" :class="errorTitleClass">Error</h2>
          <p id="system-popup-error-body" :class="errorBodyClass">{{ popupStore.errorMessage }}</p>
          <button
            id="system-popup-close"
            type="button"
            :class="closeButtonClass"
            @click="popupStore.close"
          >
            Close
          </button>
        </template>
        <template v-else-if="pageConfig">
          <DynamicContainer
            :config="pageConfig.container"
            :page-config="pageConfig"
            :html-id="popupPageRootId"
          />
        </template>
      </div>
    </div>

    <div v-else-if="popupStore.isOpen && isChatPopup" id="system-popup-chat-backdrop">
      <div
        id="system-popup-panel"
        :class="resolveStyle({ styleTemplate: 'system.popup.panel.chatWidget' })"
        tabindex="-1"
      >
        <template v-if="popupStore.isError">
          <h2 id="system-popup-error-title" :class="errorTitleClass">Error</h2>
          <p id="system-popup-error-body" :class="errorBodyClass">{{ popupStore.errorMessage }}</p>
          <button
            id="system-popup-close"
            type="button"
            :class="closeButtonClass"
            @click="popupStore.close"
          >
            Close
          </button>
        </template>
        <template v-else-if="pageConfig">
          <DynamicContainer
            :config="pageConfig.container"
            :page-config="pageConfig"
            :html-id="popupPageRootId"
          />
        </template>
      </div>
    </div>
  </Teleport>
</template>
