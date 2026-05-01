import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { createEmailNotifyFromEnv } from './createEmailNotifyFromEnv';
import type { AppointmentCreatedEmailContext, ITokenStore } from './types';

/**
 * Minimal token store for {@link createEmailNotifyFromEnv}; appointment emails do not use reset tokens.
 */
class NoopTokenStore implements ITokenStore {
  async save(): Promise<void> {}

  async find(): Promise<{ userId: string; expiresAt: Date } | null> {
    return null;
  }

  async invalidate(): Promise<void> {}
}

function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function parseContext(raw: string): AppointmentCreatedEmailContext {
  const data = JSON.parse(raw || '{}') as Partial<AppointmentCreatedEmailContext>;
  const appointmentId = String(data.appointmentId ?? '').trim();
  const patientName = String(data.patientName ?? '').trim();
  const patientEmail = String(data.patientEmail ?? '').trim();
  const doctorName = String(data.doctorName ?? '').trim();
  const doctorEmail = String(data.doctorEmail ?? '').trim();
  const department = String(data.department ?? '').trim();
  const preferredDate = String(data.preferredDate ?? '').trim();
  const preferredTimeSlot = String(data.preferredTimeSlot ?? '').trim();
  const appBaseUrl = String(data.appBaseUrl ?? '').trim();

  if (!appointmentId) {
    throw new Error('appointmentId is required');
  }
  if (!patientEmail) {
    throw new Error('patientEmail is required');
  }
  if (!patientName) {
    throw new Error('patientName is required');
  }
  if (!doctorName) {
    throw new Error('doctorName is required');
  }
  if (!department) {
    throw new Error('department is required');
  }
  if (!preferredDate) {
    throw new Error('preferredDate is required');
  }
  if (!preferredTimeSlot) {
    throw new Error('preferredTimeSlot is required');
  }
  if (!appBaseUrl) {
    throw new Error('appBaseUrl is required');
  }

  return {
    appointmentId,
    patientName,
    patientEmail,
    patientPhone: data.patientPhone ? String(data.patientPhone).trim() : undefined,
    doctorName,
    doctorEmail,
    department,
    preferredDate,
    preferredTimeSlot,
    additionalNotes: data.additionalNotes ? String(data.additionalNotes).trim() : undefined,
    appBaseUrl,
  };
}

function parseWelcomePayload(raw: string): { email: string; userName: string } {
  const data = JSON.parse(raw || '{}') as Record<string, unknown>;
  const email = String(data.email ?? '').trim();
  const userName = String(data.userName ?? '').trim();
  if (!email) {
    throw new Error('email is required');
  }
  if (!userName) {
    throw new Error('userName is required');
  }
  return { email, userName };
}

const port = Number(process.env.PORT || process.env.HOSPITAL_APPOINTMENT_EMAIL_PORT || 8787);
const internalSecret = String(process.env.EMAIL_INTERNAL_SECRET || '').trim();

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (
    req.method !== 'POST' ||
    (req.url !== '/hospital/appointment-created' && req.url !== '/hospital/welcome-registration')
  ) {
    res.statusCode = 404;
    res.end();
    return;
  }

  if (internalSecret) {
    const header = String(req.headers['x-email-internal-secret'] ?? '');
    if (header !== internalSecret) {
      json(res, 401, { ok: false, error: 'Unauthorized' });
      return;
    }
  }

  try {
    const raw = await readJsonBody(req);
    const emailService = createEmailNotifyFromEnv(new NoopTokenStore());
    if (req.url === '/hospital/welcome-registration') {
      const payload = parseWelcomePayload(raw);
      const result = await emailService.sendWelcomeRegistration({
        toEmail: payload.email,
        userName: payload.userName,
      });
      json(res, 200, { ok: true, result });
      return;
    }
    const ctx = parseContext(raw);
    const results = await emailService.sendAppointmentCreatedDual(ctx);
    json(res, 200, { ok: true, ...results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('required') ? 400 : 500;
    json(res, status, { ok: false, error: message });
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Hospital appointment email server listening on http://localhost:${port}`);
});
