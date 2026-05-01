"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const createEmailNotifyFromEnv_1 = require("./createEmailNotifyFromEnv");
/**
 * Minimal token store for {@link createEmailNotifyFromEnv}; appointment emails do not use reset tokens.
 */
class NoopTokenStore {
    async save() { }
    async find() {
        return null;
    }
    async invalidate() { }
}
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}
function json(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}
function parseContext(raw) {
    const data = JSON.parse(raw || '{}');
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
function parseWelcomePayload(raw) {
    const data = JSON.parse(raw || '{}');
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
const server = http_1.default.createServer(async (req, res) => {
    if (req.method !== 'POST' ||
        (req.url !== '/hospital/appointment-created' && req.url !== '/hospital/welcome-registration')) {
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
        const emailService = (0, createEmailNotifyFromEnv_1.createEmailNotifyFromEnv)(new NoopTokenStore());
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const status = message.includes('required') ? 400 : 500;
        json(res, status, { ok: false, error: message });
    }
});
server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Hospital appointment email server listening on http://localhost:${port}`);
});
