import { defineStore } from 'pinia';
import type { PopupRequest } from '../core/types/ActionConfig';
import { emitLoggedInSessionSummary, SessionSummaryKind } from '../services/analytics/sessionSummary';

interface PopupState {
  isOpen: boolean;
  pageId?: string;
  packageName?: string;
  activeRequest?: PopupRequest;
  activePageId?: string;
  activePackageName?: string;
  title?: string;
  isError: boolean;
  errorMessage?: string;
  inlineErrorMessage?: string;
}

const initialState = (): PopupState => ({
  isOpen: false,
  pageId: undefined,
  packageName: undefined,
  activeRequest: undefined,
  activePageId: undefined,
  activePackageName: undefined,
  title: undefined,
  isError: false,
  inlineErrorMessage: undefined
});

export const usePopupStore = defineStore('popup', {
  state: initialState,
  actions: {
    open(req: PopupRequest) {
      const normalizePopupValue = (value: string | undefined, fallback = '') => {
        const normalized = value?.trim();
        if (!normalized || normalized === '/' || normalized === '\\') return fallback;
        return normalized;
      };
      const requestedPackageName = normalizePopupValue(req?.packageName);
      const requestedPageId = normalizePopupValue(req?.pageId);
      const packageName = requestedPackageName || 'hospital';
      const pageId = normalizePopupValue(
        requestedPageId,
        req?.title?.trim().toLowerCase() === 'login' ? 'login-popup' : ''
      );
      // Ignore malformed open requests instead of opening a popup with empty target.
      if (!pageId) return;

      this.$patch({
        isOpen: true,
        isError: false,
        inlineErrorMessage: undefined,
        packageName,
        pageId,
        activeRequest: { packageName, pageId, title: req?.title, initKey: req?.initKey },
        activePackageName: packageName,
        activePageId: pageId,
        title: req?.title
      });
      void emitLoggedInSessionSummary({
        kind: SessionSummaryKind.POPUP_OPEN,
        popup_page_id: pageId,
        package_name: packageName,
        attributes: req?.title ? { title: req.title } : undefined
      });
    },
    openError(err: unknown) {
      this.$patch({
        isOpen: true,
        isError: true,
        inlineErrorMessage: undefined,
        errorMessage: err instanceof Error ? err.message : 'An unexpected error occurred'
      });
    },
    setInlineError(message: string) {
      this.$patch({
        inlineErrorMessage: message
      });
    },
    clearInlineError() {
      this.$patch({
        inlineErrorMessage: undefined
      });
    },
    close() {
      this.$patch(initialState());
    }
  }
});
