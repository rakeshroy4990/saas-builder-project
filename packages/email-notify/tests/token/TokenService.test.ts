import { createHash } from 'crypto';
import { ITokenStore } from '../../src/types';
import { TokenService } from '../../src/token/TokenService';

class InMemoryTokenStore implements ITokenStore {
  private db = new Map<string, { userId: string; expiresAt: Date }>();

  async save(token: string, userId: string, expiresAt: Date): Promise<void> {
    this.db.set(token, { userId, expiresAt });
  }

  async find(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    return this.db.get(token) ?? null;
  }

  async invalidate(token: string): Promise<void> {
    this.db.delete(token);
  }

  has(token: string): boolean {
    return this.db.has(token);
  }
}

describe('TokenService', () => {
  it('generates a token and validates it successfully', async () => {
    const store = new InMemoryTokenStore();
    const service = new TokenService(store, 3600);

    const raw = await service.generate('user-1');
    const userId = await service.validate(raw);

    expect(userId).toBe('user-1');
  });

  it('returns null for expired tokens', async () => {
    const store = new InMemoryTokenStore();
    const service = new TokenService(store, -1);

    const raw = await service.generate('user-1');
    const userId = await service.validate(raw);

    expect(userId).toBeNull();
  });

  it('invalidates token after single use', async () => {
    const store = new InMemoryTokenStore();
    const service = new TokenService(store, 3600);

    const raw = await service.generate('user-1');
    const first = await service.validate(raw);
    const second = await service.validate(raw);

    expect(first).toBe('user-1');
    expect(second).toBeNull();
  });

  it('returns null for unknown tokens', async () => {
    const store = new InMemoryTokenStore();
    const service = new TokenService(store, 3600);

    const userId = await service.validate('does-not-exist');
    expect(userId).toBeNull();
  });

  it('stores only the hashed token, not the raw', async () => {
    const store = new InMemoryTokenStore();
    const service = new TokenService(store, 3600);

    const raw = await service.generate('user-1');
    const hashed = createHash('sha256').update(raw).digest('hex');

    expect(store.has(raw)).toBe(false);
    expect(store.has(hashed)).toBe(true);
  });
});
