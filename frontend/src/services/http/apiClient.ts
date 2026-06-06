import axios from 'axios';
import type { Router } from 'vue-router';
import { usePopupStore } from '../../store/usePopupStore';
import { useToastStore } from '../../store/useToastStore';
import { pinia } from '../../store/pinia';
import { getApiBaseUrl } from './URLRegistry';
import { getOrCreateTraceId } from '../logging/traceContext';
import { logClient } from '../logging/clientLogger';
import { i18n } from '../../i18n';
import { acceptLanguageHeaderValue } from '@saas-builder/i18n-contract';

let appRouter: Router | null = null;

export const bindHttpRouter = (router: Router) => {
  appRouter = router;
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers ?? {};
  config.headers['X-Trace-Id'] = getOrCreateTraceId();
  const globalLocale = i18n.global.locale as unknown;
  const code =
    typeof globalLocale === 'string'
      ? globalLocale
      : (globalLocale as { value?: string })?.value ?? 'en';
  config.headers['Accept-Language'] = acceptLanguageHeaderValue(code);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    void logClient('ERROR', 'HTTP request failed', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    });
    const popupStore = usePopupStore(pinia);
    const toastStore = useToastStore(pinia);

    if (error.response?.status === 401) {
      toastStore.show('Session expired. Please log in again.', 'error');
      if (appRouter) appRouter.push('/login');
    } else if (error.response?.status === 403) {
      popupStore.openError(new Error('You do not have permission to perform this action.'));
    } else if (error.response?.status >= 500) {
      popupStore.openError(new Error('Server error. Please try again later.'));
    } else {
      const message = error.response?.data?.message ?? error.message;
      toastStore.show(message, 'error');
    }

    return Promise.reject(error);
  }
);
