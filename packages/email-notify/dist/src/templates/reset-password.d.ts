import { ResetPasswordPayload } from '../types';
export declare function buildResetPasswordEmail(payload: ResetPasswordPayload, appBaseUrl: string): {
    subject: string;
    html: string;
    text: string;
};
