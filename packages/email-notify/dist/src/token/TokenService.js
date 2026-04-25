"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const crypto_1 = require("crypto");
class TokenService {
    constructor(store, ttlSeconds = 3600) {
        this.store = store;
        this.ttlSeconds = ttlSeconds;
    }
    async generate(userId) {
        const rawToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const hashedToken = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
        await this.store.save(hashedToken, userId, expiresAt);
        return rawToken;
    }
    async validate(rawToken) {
        const hashedToken = (0, crypto_1.createHash)('sha256').update(rawToken).digest('hex');
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
exports.TokenService = TokenService;
