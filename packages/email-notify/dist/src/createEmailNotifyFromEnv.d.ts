import { EmailNotifyService } from './EmailNotifyService';
import { ITokenStore } from './types';
export interface EmailEnvConfig {
    resendApiKey?: string;
    emailFromAddress?: string;
    appBaseUrl?: string;
    tokenTtlSeconds?: number;
}
export declare function createEmailNotifyFromEnv(tokenStore: ITokenStore, env?: EmailEnvConfig): EmailNotifyService;
