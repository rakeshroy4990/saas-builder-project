import { describe, it, expect, beforeEach } from 'vitest';
import { clearEphemeralRefreshToken, getEphemeralRefreshToken, setEphemeralRefreshToken } from './refreshTokenEphemeral';

describe('refreshTokenEphemeral', () => {
  beforeEach(() => {
    clearEphemeralRefreshToken();
  });

  it('starts with no token', () => {
    expect(getEphemeralRefreshToken()).toBeNull();
  });

  it('stores trimmed token', () => {
    setEphemeralRefreshToken('  abc  ');
    expect(getEphemeralRefreshToken()).toBe('abc');
  });

  it('clears on empty or null', () => {
    setEphemeralRefreshToken('x');
    setEphemeralRefreshToken('');
    expect(getEphemeralRefreshToken()).toBeNull();
    setEphemeralRefreshToken('y');
    setEphemeralRefreshToken(null);
    expect(getEphemeralRefreshToken()).toBeNull();
  });
});
