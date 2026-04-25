"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailNotifyFromEnv = createEmailNotifyFromEnv;
const EmailNotifyService_1 = require("./EmailNotifyService");
function createEmailNotifyFromEnv(tokenStore, env = {
    resendApiKey: process.env.RESEND_API_KEY,
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS,
    appBaseUrl: process.env.APP_BASE_URL,
    tokenTtlSeconds: process.env.RESET_TOKEN_TTL_SECONDS
        ? Number(process.env.RESET_TOKEN_TTL_SECONDS)
        : undefined,
}) {
    const resendApiKey = env.resendApiKey?.trim();
    const fromAddress = env.emailFromAddress?.trim();
    const appBaseUrl = env.appBaseUrl?.trim();
    if (!resendApiKey) {
        throw new Error('Missing RESEND_API_KEY. Replace re_xxxxxxxxx with your real API key.');
    }
    if (!fromAddress) {
        throw new Error('Missing EMAIL_FROM_ADDRESS. Use a verified Resend sender address.');
    }
    if (!appBaseUrl) {
        throw new Error('Missing APP_BASE_URL for reset password links.');
    }
    return new EmailNotifyService_1.EmailNotifyService({
        provider: 'resend',
        resend: { apiKey: resendApiKey },
        fromAddress,
        appBaseUrl,
        tokenTtlSeconds: env.tokenTtlSeconds,
    }, tokenStore);
}
