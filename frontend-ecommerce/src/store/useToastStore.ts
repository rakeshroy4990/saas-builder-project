import { defineStore } from 'pinia';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  isVisible: boolean;
  message: string;
  type: ToastType;
  duration: number;
}

let timeoutId: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = defineStore('toast', {
  state: (): ToastState => ({
    isVisible: false,
    message: '',
    type: 'info',
    duration: 3000
  }),
  actions: {
    show(message: string, type: ToastType = 'info', duration = 3000) {
      this.$patch({ isVisible: true, message, type, duration });
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => this.hide(), duration);
    },
    hide() {
      this.$patch({ isVisible: false, message: '' });
    }
  }
});
