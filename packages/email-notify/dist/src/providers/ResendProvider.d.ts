import { EmailMessage, IEmailProvider } from './IEmailProvider';
import { SendResult } from '../types';
export declare class ResendProvider implements IEmailProvider {
    private client;
    constructor(apiKey: string);
    send(message: EmailMessage): Promise<SendResult>;
}
