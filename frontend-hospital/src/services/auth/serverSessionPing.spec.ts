import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateServerSessionPingCache, pingServerSession } from './serverSessionPing';

describe('pingServerSession', () => {
  beforeEach(() => {
    invalidateServerSessionPingCache();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateServerSessionPingCache();
  });

  it('reuses a recent successful ping for the same user', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await expect(pingServerSession('user-1')).resolves.toBe(true);
    await expect(pingServerSession('user-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pings again when the cached user changes', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await pingServerSession('user-1');
    await pingServerSession('user-2');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forces a fresh ping when requested', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({ ok: true } as Response);

    await pingServerSession('user-1');
    await pingServerSession('user-1', { force: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache failed pings', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: false } as Response).mockResolvedValueOnce({ ok: true } as Response);

    await expect(pingServerSession('user-1')).resolves.toBe(false);
    await expect(pingServerSession('user-1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
