import { EmailNotifyService } from '../src/EmailNotifyService';
import { IEmailProvider } from '../src/providers/IEmailProvider';
import { ITokenStore } from '../src/types';

class InMemoryTokenStore implements ITokenStore {
  private db = new Map<string, { userId: string; expiresAt: Date }>();

  async save(token: string, userId: string, expiresAt: Date): Promise<void> {
    this.db.set(token, { userId, expiresAt });
  }

  async find(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
    return this.db.get(token) ?? null;
  }

  async invalidate(token: string): Promise<void> {
    this.db.delete(token);
  }
}

describe('EmailNotifyService', () => {
  const provider: IEmailProvider = {
    send: jest.fn().mockResolvedValue({ success: true, messageId: 'msg_1' }),
  };

  const baseConfig = {
    provider: 'custom' as const,
    fromAddress: 'noreply@example.com',
    appBaseUrl: 'https://app.example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends reset password email and returns a token', async () => {
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), provider);
    const result = await service.sendResetPassword('user-1', 'user@example.com', 'Rakesh');

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it('validates a valid reset token returning userId', async () => {
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), provider);
    const { token } = await service.sendResetPassword('user-1', 'user@example.com', 'Rakesh');
    const userId = await service.validateResetToken(token);

    expect(userId).toBe('user-1');
  });

  it('rejects an expired reset token', async () => {
    const service = new EmailNotifyService(
      { ...baseConfig, tokenTtlSeconds: -1 },
      new InMemoryTokenStore(),
      provider
    );
    const { token } = await service.sendResetPassword('user-1', 'user@example.com', 'Rakesh');
    const userId = await service.validateResetToken(token);

    expect(userId).toBeNull();
  });

  it('sends appointment save email with correct subject', async () => {
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), provider);

    await service.sendAppointmentSave({
      toEmail: 'user@example.com',
      userName: 'Rakesh',
      appointmentId: 'A-1',
      appointmentDate: '2026-05-10T10:00:00Z',
      appointmentTitle: 'General Consultation',
    });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Appointment Confirmed: General Consultation',
      })
    );
  });

  it('sends appointment-created emails to patient and doctor', async () => {
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), provider);

    await service.sendAppointmentCreatedDual({
      appointmentId: 'appt-1',
      patientName: 'Jane',
      patientEmail: 'jane@example.com',
      patientPhone: '555-0100',
      doctorName: 'Dr. Smith',
      doctorEmail: 'smith@example.com',
      department: 'Pediatrics',
      preferredDate: '2026-05-10',
      preferredTimeSlot: '10:00',
      additionalNotes: 'Follow-up',
      appBaseUrl: 'https://app.example.com',
    });

    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(provider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('We received your appointment'),
        html: expect.stringContaining('Jane'),
      })
    );
    expect(provider.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: 'smith@example.com',
        subject: expect.stringContaining('New booking'),
        html: expect.stringContaining('Jane'),
      })
    );
  });

  it('sends appointment-created email to patient only when doctor email missing', async () => {
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), provider);

    await service.sendAppointmentCreatedDual({
      appointmentId: 'appt-2',
      patientName: 'Jane',
      patientEmail: 'jane@example.com',
      doctorName: 'Dr. Smith',
      doctorEmail: '',
      department: 'Pediatrics',
      preferredDate: '2026-05-10',
      preferredTimeSlot: '10:00',
      appBaseUrl: 'https://app.example.com',
    });

    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
      })
    );
  });

  it('sends appointment cancel email with cancellation reason', async () => {
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), provider);

    await service.sendAppointmentCancel({
      toEmail: 'user@example.com',
      userName: 'Rakesh',
      appointmentId: 'A-1',
      appointmentDate: '2026-05-10T10:00:00Z',
      appointmentTitle: 'General Consultation',
      cancellationReason: 'Doctor unavailable',
    });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('Doctor unavailable'),
      })
    );
  });

  it('throws when neither resend config nor custom provider given', () => {
    expect(
      () =>
        new EmailNotifyService(
          {
            provider: 'custom',
            fromAddress: 'noreply@example.com',
            appBaseUrl: 'https://app.example.com',
          },
          new InMemoryTokenStore()
        )
    ).toThrow('No valid email provider configured');
  });

  it('uses custom provider when passed in constructor', async () => {
    const customProvider: IEmailProvider = {
      send: jest.fn().mockResolvedValue({ success: true }),
    };
    const service = new EmailNotifyService(baseConfig, new InMemoryTokenStore(), customProvider);

    await service.sendAppointmentSave({
      toEmail: 'user@example.com',
      userName: 'Rakesh',
      appointmentId: 'A-1',
      appointmentDate: '2026-05-10T10:00:00Z',
      appointmentTitle: 'General Consultation',
    });

    expect(customProvider.send).toHaveBeenCalledTimes(1);
  });
});
