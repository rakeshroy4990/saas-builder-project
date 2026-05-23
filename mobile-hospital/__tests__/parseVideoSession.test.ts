import { parseVideoSessionPayload } from '@saas-builder/hospital-api-client';

describe('parseVideoSessionPayload', () => {
  it('parses Agora join-call fields', () => {
    const session = parseVideoSessionPayload({
      Provider: 'agora',
      RoomId: 'appt-123',
      Token: 'token-abc',
      AppId: 'app-id',
      Uid: 42,
      ExpiresAt: '2026-05-21T12:00:00Z'
    });
    expect(session).toEqual({
      provider: 'agora',
      roomId: 'appt-123',
      token: 'token-abc',
      appId: 'app-id',
      uid: 42,
      expiresAt: '2026-05-21T12:00:00Z'
    });
  });

  it('returns null when token missing', () => {
    expect(parseVideoSessionPayload({ AppId: 'x', RoomId: 'y', Uid: 1 })).toBeNull();
  });
});
