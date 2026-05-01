import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { authLoginHospitalServices } from '../authLoginService';

vi.mock('../../../../http/apiClient', () => ({
  apiClient: { post: vi.fn() }
}));

vi.mock('../../../../auth/authToken', () => ({
  parseJwtSubject: vi.fn(() => 'user-1'),
  setAuthTokens: vi.fn()
}));

vi.mock('../../../../auth/authSessionStore', () => ({
  persistAuthSessionProfile: vi.fn(),
  syncHospitalUserIdFromAccessToken: vi.fn()
}));

vi.mock('../../shared/hospitalWebRtcInbound', () => ({
  ensureHospitalWebRtcInboundConnected: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../chat/chatServices', () => ({
  ensureHospitalAdminSupportInboxReady: vi.fn().mockResolvedValue(undefined)
}));

import { apiClient } from '../../../../http/apiClient';

describe('auth-login service', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(apiClient.post).mockReset();
  });

  it('returns AUTH_FAILED when credentials are missing', async () => {
    const svc = authLoginHospitalServices.find((s) => s.serviceId === 'auth-login')!;
    const res = await svc.execute({ data: { identity: '', password: '' } });
    expect(res.responseCode).toBe('AUTH_FAILED');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('persists session fields on successful login', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 200,
      data: {
        data: {
          accessToken: 'header.payload.sig',
          refreshToken: 'refresh',
          Email: 'a@b.com',
          UserId: 'user-1',
          FirstName: 'Ann',
          LastName: 'Lee',
          Role: 'patient'
        }
      }
    } as never);

    const svc = authLoginHospitalServices.find((s) => s.serviceId === 'auth-login')!;
    const res = await svc.execute({ data: { identity: 'a@b.com', password: 'secret' } });
    expect(res.responseCode).toBe('SUCCESS');
    expect(apiClient.post).toHaveBeenCalled();
  });
});
