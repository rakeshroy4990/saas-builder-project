import { IEmailProvider } from './providers/IEmailProvider';
import { AppointmentCancelPayload, AppointmentCreatedEmailContext, AppointmentSavePayload, EmailNotifyConfig, ITokenStore, SendResult } from './types';
export declare class EmailNotifyService {
    private readonly provider;
    private readonly tokenService;
    private readonly config;
    constructor(config: EmailNotifyConfig, tokenStore: ITokenStore, customProvider?: IEmailProvider);
    sendResetPassword(userId: string, toEmail: string, userName: string): Promise<SendResult & {
        token: string;
    }>;
    validateResetToken(rawToken: string): Promise<string | null>;
    sendAppointmentSave(payload: AppointmentSavePayload): Promise<SendResult>;
    sendAppointmentCancel(payload: AppointmentCancelPayload): Promise<SendResult>;
    /**
     * Sends appointment-created notifications: one to the patient and one to the doctor.
     * Doctor email is skipped when {@link AppointmentCreatedEmailContext.doctorEmail} is blank.
     */
    sendAppointmentCreatedDual(ctx: AppointmentCreatedEmailContext): Promise<{
        patient: SendResult;
        doctor?: SendResult;
    }>;
}
