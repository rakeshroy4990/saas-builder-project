import { ITokenStore } from '../types';
export declare class TokenService {
    private readonly store;
    private readonly ttlSeconds;
    constructor(store: ITokenStore, ttlSeconds?: number);
    generate(userId: string): Promise<string>;
    validate(rawToken: string): Promise<string | null>;
}
