"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const TokenService_1 = require("../../src/token/TokenService");
class InMemoryTokenStore {
    constructor() {
        this.db = new Map();
    }
    async save(token, userId, expiresAt) {
        this.db.set(token, { userId, expiresAt });
    }
    async find(token) {
        return this.db.get(token) ?? null;
    }
    async invalidate(token) {
        this.db.delete(token);
    }
    has(token) {
        return this.db.has(token);
    }
}
describe('TokenService', () => {
    it('generates a token and validates it successfully', async () => {
        const store = new InMemoryTokenStore();
        const service = new TokenService_1.TokenService(store, 3600);
        const raw = await service.generate('user-1');
        const userId = await service.validate(raw);
        expect(userId).toBe('user-1');
    });
    it('returns null for expired tokens', async () => {
        const store = new InMemoryTokenStore();
        const service = new TokenService_1.TokenService(store, -1);
        const raw = await service.generate('user-1');
        const userId = await service.validate(raw);
        expect(userId).toBeNull();
    });
    it('invalidates token after single use', async () => {
        const store = new InMemoryTokenStore();
        const service = new TokenService_1.TokenService(store, 3600);
        const raw = await service.generate('user-1');
        const first = await service.validate(raw);
        const second = await service.validate(raw);
        expect(first).toBe('user-1');
        expect(second).toBeNull();
    });
    it('returns null for unknown tokens', async () => {
        const store = new InMemoryTokenStore();
        const service = new TokenService_1.TokenService(store, 3600);
        const userId = await service.validate('does-not-exist');
        expect(userId).toBeNull();
    });
    it('stores only the hashed token, not the raw', async () => {
        const store = new InMemoryTokenStore();
        const service = new TokenService_1.TokenService(store, 3600);
        const raw = await service.generate('user-1');
        const hashed = (0, crypto_1.createHash)('sha256').update(raw).digest('hex');
        expect(store.has(raw)).toBe(false);
        expect(store.has(hashed)).toBe(true);
    });
});
