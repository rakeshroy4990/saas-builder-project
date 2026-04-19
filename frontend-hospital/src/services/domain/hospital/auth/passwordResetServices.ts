import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';

export const passwordResetHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-password-reset-popup',
    execute: async () => {
      const app = useAppStore(pinia);
      const auth = (app.getData('hospital', 'AuthForm') ?? {}) as Record<string, unknown>;
      const identity = String(auth.identity ?? '').trim();
      app.setProperty('hospital', 'PasswordResetForm', 'emailId', identity);
      app.setProperty('hospital', 'PasswordResetForm', 'oldPassword', '');
      app.setProperty('hospital', 'PasswordResetForm', 'newPassword', '');
      app.setProperty('hospital', 'PasswordResetForm', 'confirmPassword', '');
      app.setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
      app.setProperty('hospital', 'PasswordResetForm', 'saving', false);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-password-reset-email-id',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'emailId', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-password-reset-old-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'oldPassword', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-password-reset-new-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'newPassword', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-password-reset-confirm-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'confirmPassword', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'submit-password-reset',
    responseCodes: { failure: ['PASSWORD_RESET_FAILED'] },
    execute: async (request) => {
      const app = useAppStore(pinia);
      const emailId = String(request.data.emailId ?? '').trim();
      const oldPassword = String(request.data.oldPassword ?? '');
      const newPassword = String(request.data.newPassword ?? '');
      const confirmPassword = String(request.data.confirmPassword ?? '');

      if (newPassword !== confirmPassword) {
        app.setProperty('hospital', 'PasswordResetForm', 'errorMessage', 'New password and confirmation do not match.');
        return { responseCode: 'PASSWORD_RESET_FAILED', message: 'Confirm mismatch' };
      }
      if (newPassword.length < 8) {
        app.setProperty('hospital', 'PasswordResetForm', 'errorMessage', 'New password must be at least 8 characters.');
        return { responseCode: 'PASSWORD_RESET_FAILED', message: 'Weak password' };
      }

      app.setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
      app.setProperty('hospital', 'PasswordResetForm', 'saving', true);
      try {
        const response = await apiClient.post(URLRegistry.paths.changePassword, {
          EmailId: emailId,
          OldPassword: oldPassword,
          NewPassword: newPassword
        });
        const body = (response.data ?? {}) as Record<string, unknown>;
        const successMsg =
          pickString(body, ['message', 'Message']).trim() ||
          'Your password has been updated successfully. Please log in with your new password.';
        useToastStore(pinia).show(successMsg, 'success');
        usePopupStore(pinia).close();
        app.setProperty('hospital', 'PasswordResetForm', 'oldPassword', '');
        app.setProperty('hospital', 'PasswordResetForm', 'newPassword', '');
        app.setProperty('hospital', 'PasswordResetForm', 'confirmPassword', '');
        app.setProperty('hospital', 'PasswordResetForm', 'errorMessage', '');
        app.setProperty('hospital', 'AuthForm', 'identity', emailId);
        app.setProperty('hospital', 'AuthForm', 'password', '');
        app.setProperty('hospital', 'AuthForm', 'emailError', '');
        app.setProperty('hospital', 'AuthForm', 'authError', '');
        app.setProperty('hospital', 'AuthForm', 'loginInfoMessage', successMsg);
        usePopupStore(pinia).open({
          packageName: 'hospital',
          pageId: 'login-popup',
          title: 'login',
          initKey: String(Date.now())
        });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message', 'error']).trim()
          : '';
        app.setProperty(
          'hospital',
          'PasswordResetForm',
          'errorMessage',
          message || 'Unable to update your password. Please try again.'
        );
        return { responseCode: 'PASSWORD_RESET_FAILED', message: message || 'Change password failed' };
      } finally {
        app.setProperty('hospital', 'PasswordResetForm', 'saving', false);
      }
    }
  }
];
