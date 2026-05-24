import { isGoogleDeveloperConfigError } from '../src/features/auth/googleDeveloperError';

describe('isGoogleDeveloperConfigError', () => {
  it('detects DEVELOPER_ERROR messages', () => {
    expect(isGoogleDeveloperConfigError('DEVELOPER_ERROR: Follow troubleshooting')).toBe(true);
    expect(isGoogleDeveloperConfigError('Something code: 10 happened')).toBe(true);
  });

  it('ignores generic failures', () => {
    expect(isGoogleDeveloperConfigError('Network request failed')).toBe(false);
  });
});
