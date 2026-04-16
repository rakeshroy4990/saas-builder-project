import { defineStore } from 'pinia';
import type { PopupRequest } from '../core/types/ActionConfig';

interface PopupState {
  isOpen: boolean;
  pageId?: string;
  packageName?: string;
  title?: string;
  isError: boolean;
  errorMessage?: string;
}

const initialState = (): PopupState => ({
  isOpen: false,
  isError: false
});

export const usePopupStore = defineStore('popup', {
  state: initialState,
  actions: {
    open(req: PopupRequest) {
      this.$patch({ isOpen: true, isError: false, ...req });
    },
    openError(err: unknown) {
      this.$patch({
        isOpen: true,
        isError: true,
        errorMessage: err instanceof Error ? err.message : 'An unexpected error occurred'
      });
    },
    close() {
      this.$patch(initialState());
    }
  }
});
