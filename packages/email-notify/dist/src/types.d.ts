export interface EmailNotifyConfig {
    provider: 'resend' | 'custom';
    resend?: {
        apiKey: string;
    };
    fromAddress: string;
    appBaseUrl: string;
    tokenTtlSeconds?: number;
}
export interface SendResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
export interface ResetPasswordPayload {
    toEmail: string;
    userName: string;
    token: string;
}
export interface AppointmentSavePayload {
    toEmail: string;
    userName: string;
    appointmentId: string;
    appointmentDate: string;
    appointmentTitle: string;
    location?: string;
    notes?: string;
}
export interface AppointmentCancelPayload {
    toEmail: string;
    userName: string;
    appointmentId: string;
    appointmentDate: string;
    appointmentTitle: string;
    cancellationReason?: string;
}
/** Context for appointment-created emails (patient + doctor flows). */
export interface AppointmentCreatedEmailContext {
    appointmentId: string;
    patientName: string;
    patientEmail: string;
    patientPhone?: string;
    doctorName: string;
    doctorEmail: string;
    department: string;
    preferredDate: string;
    preferredTimeSlot: string;
    additionalNotes?: string;
    appBaseUrl: string;
}
export interface ITokenStore {
    save(token: string, userId: string, expiresAt: Date): Promise<void>;
    find(token: string): Promise<{
        userId: string;
        expiresAt: Date;
    } | null>;
    invalidate(token: string): Promise<void>;
}
