jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} }
  }
}));

import {
  getGoogleOAuthClientIds,
  isGoogleOAuthConfigured,
  isUsableConfigValue,
  pickConfigValue
} from '../src/config/env';

describe('env config helpers', () => {
  it('treats empty and placeholder values as unusable', () => {
    expect(isUsableConfigValue('')).toBe(false);
    expect(isUsableConfigValue('   ')).toBe(false);
    expect(isUsableConfigValue('your-web-client-id.apps.googleusercontent.com')).toBe(false);
    expect(isUsableConfigValue('your-android-client-id.apps.googleusercontent.com')).toBe(false);
    expect(isUsableConfigValue('REPLACE_ME')).toBe(false);
  });

  it('accepts real-looking values', () => {
    expect(isUsableConfigValue('123456789-abc.apps.googleusercontent.com')).toBe(true);
    expect(isUsableConfigValue('https://backend.example.com')).toBe(true);
  });

  it('skips placeholders when picking config values', () => {
    expect(
      pickConfigValue(
        'your-web-client-id.apps.googleusercontent.com',
        '123456789-abc.apps.googleusercontent.com'
      )
    ).toBe('123456789-abc.apps.googleusercontent.com');
  });

  it('does not treat Google placeholders as configured', () => {
    const prevWeb = process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    const prevAndroid = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID =
      'your-web-client-id.apps.googleusercontent.com';
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID =
      'your-android-client-id.apps.googleusercontent.com';

    expect(isGoogleOAuthConfigured()).toBe(false);
    expect(getGoogleOAuthClientIds()).toEqual({
      webClientId: undefined,
      androidClientId: undefined,
      iosClientId: undefined
    });

    process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID = prevWeb;
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = prevAndroid;
  });
});
