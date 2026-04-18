<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { usePopupStore } from '../../store/usePopupStore';
import { PageRegistry } from '../../core/registry/PageRegistry';
import { resolveStyle } from '../../core/engine/StyleResolver';
import DynamicContainer from '../renderer/DynamicContainer.vue';
import { resolvePageRootDomId } from '../../core/utils/domId';
import { pageRegistryRevision } from '../../core/registry/pageRegistryRevision';
import { hospitalPages } from '../../configs/hospital/pages';
import { pinia } from '../../store/pinia';
import { ActionEngine } from '../../core/engine/ActionEngine';

const popupStore = usePopupStore(pinia);
const router = useRouter();

const normalizePopupValue = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim();
  if (!normalized || normalized === '/' || normalized === '\\') return fallback;
  return normalized;
};

const activePopupRequest = computed(() => {
  const req = popupStore.activeRequest;
  if (req) return req;
  // Backward-compatible fallback if store was initialized before activeRequest existed.
  return {
    packageName: popupStore.activePackageName ?? popupStore.packageName,
    pageId: popupStore.activePageId ?? popupStore.pageId,
    title: popupStore.title
  };
});

const resolvePopupPage = (packageName: string, pageId: string, title?: string) => {
  const registry = PageRegistry.getInstance();
  if (packageName === 'hospital') {
    if (title?.toLowerCase() === 'login') {
      const login = hospitalPages.find((page) => page.pageId === 'login-popup');
      if (login) return login;
    }
    const localExact = hospitalPages.find((page) => page.pageId === pageId);
    if (localExact) return localExact;
  }

  const found = registry.get(packageName, pageId);
  if (found) return found;
  return null;
};

const pageConfig = computed(() => {
  void pageRegistryRevision.value;
  if (!popupStore.isOpen || popupStore.isError) return null;

  const packageName = normalizePopupValue(activePopupRequest.value.packageName, 'hospital');
  const pageId = normalizePopupValue(activePopupRequest.value.pageId, '');
  if (!pageId) return null;

  return resolvePopupPage(packageName, pageId, activePopupRequest.value.title);
});

const backdropClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.backdrop' }));
const panelClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.panel' }));
const errorTitleClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.errorTitle' }));
const errorBodyClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.errorBody' }));
const closeButtonClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.closeButton' }));
const missingPageClass = computed(() => resolveStyle({ styleTemplate: 'system.popup.missingPage' }));
const inlineErrorClass = computed(() =>
  resolveStyle({
    // Do not use hosp.form.errorText here: it includes a left margin for inline field errors.
    utilityClasses:
      'mt-3 block w-full rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-left text-sm text-red-600'
  })
);

const isChatPopup = computed(() => {
  const pageId = normalizePopupValue(activePopupRequest.value.pageId, '');
  return pageId === 'chat-popup';
});

/** Popups skip `DynamicPage`; run `initializeActions` here (e.g. `chat-connect` for chat-popup). */
let popupInitGeneration = 0;
let lastInitializedPopupKey = '';
watch(
  () =>
    [
      popupStore.isOpen,
      popupStore.isError,
      normalizePopupValue(activePopupRequest.value.packageName, 'hospital'),
      normalizePopupValue(activePopupRequest.value.pageId, ''),
      pageConfig.value
    ] as const,
  async ([isOpen, isError, packageName, pageId, cfg]) => {
    if (!isOpen) {
      lastInitializedPopupKey = '';
      return;
    }
    if (isError || !cfg?.initializeActions?.length) return;
    const initKey = normalizePopupValue(activePopupRequest.value?.initKey ?? '', '') || 'static';
    const popupKey = `${packageName}:${pageId}:${initKey}`;
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

const popupPageRootId = computed(() => {
  if (!popupStore.isOpen || popupStore.isError) return 'system-popup-page';

  const packageName = normalizePopupValue(activePopupRequest.value.packageName, 'hospital');
  const pageId = normalizePopupValue(activePopupRequest.value.pageId, '');
  const cfg = pageConfig.value;
  return resolvePageRootDomId({
    packageName,
    pageId,
    pageDomId: cfg?.domId,
    containerDomId: cfg?.container.domId,
    fallbackId: `${packageName}-${pageId}-popup-page`
  });
});

const getPopupButtons = (): HTMLButtonElement[] => {
  const panel = document.getElementById('system-popup-panel');
  if (!panel) return [];
  return Array.from(panel.querySelectorAll('button')).filter((button) => !button.disabled);
};

const isPrimaryButton = (button: HTMLButtonElement): boolean => {
  const id = button.id.toLowerCase();
  const text = (button.textContent ?? '').trim().toLowerCase();
  if (button.dataset.popupPrimary === 'true') return true;
  if (/(submit|login$|register|book|confirm|save|ok)/i.test(id)) return true;
  return /(submit|login|register|book|confirm|save|ok)/i.test(text);
};

const isSecondaryButton = (button: HTMLButtonElement): boolean => {
  const id = button.id.toLowerCase();
  const text = (button.textContent ?? '').trim().toLowerCase();
  if (button.dataset.popupSecondary === 'true') return true;
  if (/(cancel|close|secondary)/i.test(id)) return true;
  return /(cancel|close|back|no)/i.test(text);
};

const resolvePrimaryButton = (): HTMLButtonElement | null => {
  const buttons = getPopupButtons();
  return buttons.find(isPrimaryButton) ?? buttons[buttons.length - 1] ?? null;
};

const resolveSecondaryButton = (): HTMLButtonElement | null => {
  const buttons = getPopupButtons();
  return buttons.find(isSecondaryButton) ?? buttons[0] ?? null;
};

const onGlobalKeydown = (event: KeyboardEvent): void => {
  if (!popupStore.isOpen) return;

  if (event.key === 'Enter') {
    const target = resolvePrimaryButton();
    if (target) {
      event.preventDefault();
      target.click();
    }
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    const target = resolveSecondaryButton();
    if (target) {
      target.click();
      return;
    }
    popupStore.close();
  }
};

watch(
  () => popupStore.isOpen,
  async (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', onGlobalKeydown);
      await nextTick();
      document.getElementById('system-popup-panel')?.focus();
      return;
    }
    window.removeEventListener('keydown', onGlobalKeydown);
  }
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="popupStore.isOpen && !isChatPopup"
      id="system-popup-backdrop"
      :class="backdropClass"
      @click.self="popupStore.close"
    >
      <div id="system-popup-panel" :class="panelClass" tabindex="-1">
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
          <p
            v-if="popupStore.inlineErrorMessage"
            id="system-popup-inline-error"
            role="alert"
            aria-live="assertive"
            :class="inlineErrorClass"
          >
            {{ popupStore.inlineErrorMessage }}
          </p>
        </template>
        <template v-else>
          <div id="system-popup-missing-page" :class="missingPageClass">
            Popup page not found:
            {{ normalizePopupValue(activePopupRequest.packageName, 'hospital') }}/{{
              normalizePopupValue(activePopupRequest.pageId, '')
            }}
          </div>
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
          <p
            v-if="popupStore.inlineErrorMessage"
            id="system-popup-inline-error"
            role="alert"
            aria-live="assertive"
            :class="inlineErrorClass"
          >
            {{ popupStore.inlineErrorMessage }}
          </p>
        </template>
        <template v-else>
          <div id="system-popup-missing-page" :class="missingPageClass">
            Popup page not found:
            {{ normalizePopupValue(activePopupRequest.packageName, 'hospital') }}/{{
              normalizePopupValue(activePopupRequest.pageId, '')
            }}
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
