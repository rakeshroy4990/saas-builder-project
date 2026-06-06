jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { apiBaseUrl: 'https://backend-hospital-yspwmymsgq-el.a.run.app' },
      android: { package: 'com.agastya.healthcare' }
    }
  }
}));

jest.mock('expo-application', () => ({
  applicationId: 'com.agastya.healthcare'
}));

jest.mock('../src/features/auth/googleSetupHint', () => ({
  getGoogleSignInSetupLines: () => []
}));

import axios from 'axios';

import { formatBackendAuthFailure } from '../src/features/auth/authLoginErrors';

describe('formatBackendAuthFailure', () => {
  it('adds API host hint for transport failures', () => {
    const err = new axios.AxiosError('Network Error', 'ERR_NETWORK');
    const msg = formatBackendAuthFailure(err, 'fallback');
    expect(msg).toMatch(/Unable to reach the server/i);
    expect(msg).toMatch(/backend-hospital-yspwmymsgq-el\.a\.run\.app/);
    expect(msg).not.toMatch(/SHA-1/);
  });

  it('keeps server messages without OAuth setup noise', () => {
    const err = new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: new axios.AxiosHeaders() },
      data: { message: 'Google sign-in failed.' }
    });
    expect(formatBackendAuthFailure(err, 'fallback')).toBe('Google sign-in failed.');
  });
});
