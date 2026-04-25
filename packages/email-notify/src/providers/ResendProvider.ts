import { Resend } from 'resend';
import { EmailMessage, IEmailProvider } from './IEmailProvider';
import { SendResult } from '../types';

export class ResendProvider implements IEmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<SendResult> {
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
    } catch (error: unknown) {
      const messageText =
        error instanceof Error ? error.message : 'Unexpected Resend SDK failure';
      return { success: false, error: messageText };
    }
  }
}
