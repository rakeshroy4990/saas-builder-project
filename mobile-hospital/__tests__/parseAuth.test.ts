import { parseAuthLoginPayload, unwrapEnvelope } from '@saas-builder/hospital-api-client';

describe('hospital-api-client', () => {
  it('unwraps envelope data', () => {
    const payload = unwrapEnvelope({ success: true, data: { Role: 'PATIENT' } });
    expect(payload).toEqual({ Role: 'PATIENT' });
  });

  it('parses login tokens and role', () => {
    const parsed = parseAuthLoginPayload(
      {
        success: true,
        data: {
          accessToken: 'a.b.c',
          refreshToken: 'rt',
          UserId: 'u1',
          Email: 'p@example.com',
          FirstName: 'Pat',
          LastName: 'User',
          Role: 'PATIENT',
          expiresInSeconds: 900
        }
      },
      'p@example.com'
    );
    expect(parsed.accessToken).toBe('a.b.c');
    expect(parsed.refreshToken).toBe('rt');
    expect(parsed.role).toBe('PATIENT');
    expect(parsed.displayName).toBe('Pat User');
  });
});
