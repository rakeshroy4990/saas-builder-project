"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendProvider = void 0;
const resend_1 = require("resend");
class ResendProvider {
    constructor(apiKey) {
        this.client = new resend_1.Resend(apiKey);
    }
    async send(message) {
        try {
            const { data, error } = await this.client.emails.send({
                from: message.from,
                to: message.to,
                subject: message.subject,
                html: message.html,
                text: message.text,
            });
            if (error) {
                return {
                    success: false,
                    error: error.message || 'Resend returned an unknown error',
                };
            }
            return { success: true, messageId: data?.id };
        }
        catch (error) {
            const messageText = error instanceof Error ? error.message : 'Unexpected Resend SDK failure';
            return { success: false, error: messageText };
        }
    }
}
exports.ResendProvider = ResendProvider;
