import { describe, expect, it, vi } from 'vitest';
import { useAsyncBusy } from './useAsyncBusy';

describe('useAsyncBusy', () => {
  it('sets pending around fn execution', async () => {
    const { pending, runExclusive } = useAsyncBusy();
    const fn = vi.fn(async () => {
      expect(pending.value).toBe(true);
      return 42;
    });
    const p = runExclusive(fn);
    expect(pending.value).toBe(true);
    await expect(p).resolves.toBe(42);
    expect(pending.value).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clears pending when fn rejects', async () => {
    const { pending, runExclusive } = useAsyncBusy();
    const err = new Error('fail');
    await expect(
      runExclusive(async () => {
        throw err;
      })
    ).rejects.toThrow('fail');
    expect(pending.value).toBe(false);
  });

  it('does not run a second fn while pending', async () => {
    const { pending, runExclusive } = useAsyncBusy();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = runExclusive(async () => {
      await gate;
      return 1;
    });
    const second = runExclusive(async () => 2);
    await expect(second).resolves.toBeUndefined();
    expect(pending.value).toBe(true);
    release();
    await expect(first).resolves.toBe(1);
    expect(pending.value).toBe(false);
  });
});
