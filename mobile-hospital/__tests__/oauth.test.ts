jest.mock('@/config/env', () => ({
  getGoogleOAuthClientIds: () => ({})
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

import { getGoogleOAuthRedirectUri } from '../src/config/oauth';

describe('oauth redirect', () => {
  it('uses package-based redirect on Android', () => {
    expect(getGoogleOAuthRedirectUri()).toBe('com.agastya.healthcare:/oauthredirect');
  });
});
