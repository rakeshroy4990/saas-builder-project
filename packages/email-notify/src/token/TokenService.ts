import { createHash, randomBytes } from 'crypto';
import { ITokenStore } from '../types';

export class TokenService {
  constructor(
    private readonly store: ITokenStore,
    private readonly ttlSeconds: number = 3600
  ) {}

  async generate(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.store.save(hashedToken, userId, expiresAt);
    return rawToken;
  }

  async validate(rawToken: string): Promise<string | null> {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.store.find(hashedToken);

    if (!record) {
      return null;
    }

    if (record.expiresAt < new Date()) {
      await this.store.invalidate(hashedToken);
      return null;
    }

    await this.store.invalidate(hashedToken);
    return record.userId;
  }
}
