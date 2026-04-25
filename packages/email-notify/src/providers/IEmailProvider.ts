import { SendResult } from '../types';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface IEmailProvider {
  send(message: EmailMessage): Promise<SendResult>;
}
