import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { registerUserHospitalServices } from '../registerUserService';

vi.mock('../../../../http/apiClient', () => ({
  apiClient: { post: vi.fn() }
}));

import { apiClient } from '../../../../http/apiClient';

describe('register-user service', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(apiClient.post).mockReset();
  });

  it('fails when terms are not accepted', async () => {
    const svc = registerUserHospitalServices.find((s) => s.serviceId === 'register-user')!;
    const res = await svc.execute({
      data: {
        firstName: 'A',
        lastName: 'B',
        emailId: 'a@b.com',
        password: 'pw',
        address: 'addr',
        gender: 'M',
        mobileNumber: '1',
        department: '',
        acceptTerms: false
      }
    });
    expect(res.responseCode).toBe('REGISTER_FAILED');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('returns SUCCESS on 201 registration', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ status: 201, data: { data: {} } } as never);

    const svc = registerUserHospitalServices.find((s) => s.serviceId === 'register-user')!;
    const res = await svc.execute({
      data: {
        firstName: 'A',
        lastName: 'B',
        emailId: 'a@b.com',
        password: 'pw',
        address: 'addr',
        gender: 'M',
        mobileNumber: '1',
        department: 'Cardiology',
        acceptTerms: true
      }
    });
    expect(res.responseCode).toBe('SUCCESS');
    expect(apiClient.post).toHaveBeenCalled();
  });
});
