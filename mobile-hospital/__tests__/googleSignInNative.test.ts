import { statusCodes } from '@react-native-google-signin/google-signin';

import { mapNativeGoogleSignInError } from '../src/features/auth/googleSignInErrors';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    getTokens: jest.fn()
  },
  isErrorWithCode: (err: unknown) =>
    Boolean(err && typeof err === 'object' && 'code' in (err as Record<string, unknown>)),
  isSuccessResponse: jest.fn(),
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE'
  }
}));

describe('mapNativeGoogleSignInError', () => {
  it('maps cancelled sign-in', async () => {
    const err = await mapNativeGoogleSignInError({ code: statusCodes.SIGN_IN_CANCELLED });
    expect(err.message).toContain('cancelled');
  });
});
