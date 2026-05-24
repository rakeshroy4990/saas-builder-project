jest.mock('@/config/env', () => ({
  getGoogleOAuthClientIds: () => ({
    androidClientId: '148957600999-61r14rmr6ncldnnnep4aek6u7froej39.apps.googleusercontent.com',
    webClientId: '148957600999-k1e8jsn96vg893pifqchvqf241eot688.apps.googleusercontent.com'
  })
}));

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: () => 'mobilehospital://oauthredirect'
}));

jest.mock('expo-application', () => ({
  applicationId: 'com.agastya.healthcare'
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' }
}));

import { getGoogleOAuthRedirectUri, googleNativeRedirectUri } from '../src/config/oauth';

describe('oauth redirect', () => {
  it('uses reversed Google client scheme on Android', () => {
    expect(getGoogleOAuthRedirectUri()).toBe(
      'com.googleusercontent.apps.148957600999-61r14rmr6ncldnnnep4aek6u7froej39:/oauthredirect'
    );
  });

  it('builds native redirect from client id', () => {
    expect(
      googleNativeRedirectUri('abc.apps.googleusercontent.com')
    ).toBe('com.googleusercontent.apps.abc:/oauthredirect');
  });
});
