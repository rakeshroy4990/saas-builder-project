import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapSessionCookiesFromRefresh } from './sessionCookieBootstrap';
import { clearEphemeralRefreshToken, getEphemeralRefreshToken, setEphemeralRefreshToken } from './refreshTokenEphemeral';
import { apiClient } from '../http/apiClient';
import { URLRegistry } from '../http/URLRegistry';

vi.mock('../http/apiClient', () => ({
  apiClient: { post: vi.fn() }
}));

vi.mock('./authToken', () => ({
  applyAccessExpiryHintFromAuthPayload: vi.fn()
}));

describe('bootstrapSessionCookiesFromRefresh', () => {
  beforeEach(() => {
    clearEphemeralRefreshToken();
    vi.mocked(apiClient.post).mockReset();
  });

  it('posts only DeviceId when no ephemeral refresh token', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: {} } } as never);
    await bootstrapSessionCookiesFromRefresh();
    expect(apiClient.post).toHaveBeenCalledWith(URLRegistry.paths.refresh, { DeviceId: 'browser' });
  });

  it('includes RefreshToken when ephemeral is set (cross-origin cookie fallback)', async () => {
    setEphemeralRefreshToken('ephemeral-rt');
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: {} } } as never);
    await bootstrapSessionCookiesFromRefresh();
    expect(apiClient.post).toHaveBeenCalledWith(URLRegistry.paths.refresh, {
      DeviceId: 'browser',
      RefreshToken: 'ephemeral-rt'
    });
  });

  it('updates ephemeral token from rotated refresh in response data', async () => {
    setEphemeralRefreshToken('old');
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { refreshToken: 'rotated-rt' } }
    } as never);
    await bootstrapSessionCookiesFromRefresh();
    expect(apiClient.post).toHaveBeenCalled();
    expect(getEphemeralRefreshToken()).toBe('rotated-rt');
  });
});
