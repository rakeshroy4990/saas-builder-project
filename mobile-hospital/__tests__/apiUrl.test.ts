jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { apiBaseUrl: 'https://api.example.com' } }
  }
}));

import { getConfiguredApiBaseUrl } from '../src/config/apiUrl';

describe('getConfiguredApiBaseUrl', () => {
  const prevUrl = process.env.EXPO_PUBLIC_API_URL;
  const prevBase = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = prevUrl;
    if (prevBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = prevBase;
  });

  it('prefers EXPO_PUBLIC_API_URL over legacy base url env', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://primary.example.com';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://legacy.example.com';
    expect(getConfiguredApiBaseUrl()).toBe('https://primary.example.com');
  });

  it('falls back to extra.apiBaseUrl from app config', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(getConfiguredApiBaseUrl()).toBe('https://api.example.com');
  });
});
