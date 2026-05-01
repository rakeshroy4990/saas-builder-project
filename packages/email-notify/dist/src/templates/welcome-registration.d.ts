import { WelcomeRegistrationPayload } from '../types';
export declare function buildWelcomeRegistrationEmail(payload: WelcomeRegistrationPayload, appBaseUrl: string): {
    subject: string;
    html: string;
    text: string;
};
