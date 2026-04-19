import { describe, it, expect } from 'vitest';
import { URLRegistry } from '../URLRegistry';

describe('URLRegistry', () => {
  it('uses stable auth and appointment path prefixes for clients and mocks', () => {
    expect(URLRegistry.paths.login).toBe('/api/auth/login');
    expect(URLRegistry.paths.register).toBe('/api/auth/register');
    expect(URLRegistry.paths.appointmentGet).toBe('/api/appointment/get');
    expect(URLRegistry.paths.medicalDepartmentGet).toBe('/api/medical-department/get');
  });
});
