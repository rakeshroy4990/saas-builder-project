import { IEmailProvider } from './providers/IEmailProvider';
import { ResendProvider } from './providers/ResendProvider';
import { TokenService } from './token/TokenService';
import {
  AppointmentCancelPayload,
  AppointmentCreatedEmailContext,
  AppointmentSavePayload,
  EmailNotifyConfig,
  ITokenStore,
  SendResult,
  WelcomeRegistrationPayload,
} from './types';
import { buildAppointmentCancelEmail } from './templates/appointment-cancel';
import { buildAppointmentSaveEmail } from './templates/appointment-save';
import { buildResetPasswordEmail } from './templates/reset-password';
import { buildWelcomeRegistrationEmail } from './templates/welcome-registration';
import {
  AppointmentEmailFlow,
  buildAppointmentCreatedHtml,
  buildAppointmentCreatedPlainText,
  subjectForAppointmentCreated,
} from './emailHtml/appointmentCreatedFlowHtml';

export class EmailNotifyService {
  private readonly provider: IEmailProvider;
  private readonly tokenService: TokenService;
  private readonly config: EmailNotifyConfig;

  constructor(
    config: EmailNotifyConfig,
    tokenStore: ITokenStore,
    customProvider?: IEmailProvider
  ) {
    this.config = config;

    if (customProvider) {
      this.provider = customProvider;
    } else if (config.provider === 'resend' && config.resend?.apiKey) {
      this.provider = new ResendProvider(config.resend.apiKey);
    } else {
      throw new Error('No valid email provider configured');
    }

    this.tokenService = new TokenService(tokenStore, config.tokenTtlSeconds ?? 3600);
  }

  async sendResetPassword(
    userId: string,
    toEmail: string,
    userName: string
  ): Promise<SendResult & { token: string }> {
    const token = await this.tokenService.generate(userId);
    const template = buildResetPasswordEmail({ toEmail, userName, token }, this.config.appBaseUrl);
    const result = await this.provider.send({
      from: this.config.fromAddress,
      to: toEmail,
      ...template,
    });

    return { ...result, token };
  }

  async validateResetToken(rawToken: string): Promise<string | null> {
    return this.tokenService.validate(rawToken);
  }

  async sendAppointmentSave(payload: AppointmentSavePayload): Promise<SendResult> {
    const template = buildAppointmentSaveEmail(payload);
    return this.provider.send({
      from: this.config.fromAddress,
      to: payload.toEmail,
      ...template,
    });
  }

  async sendAppointmentCancel(payload: AppointmentCancelPayload): Promise<SendResult> {
    const template = buildAppointmentCancelEmail(payload);
    return this.provider.send({
      from: this.config.fromAddress,
      to: payload.toEmail,
      ...template,
    });
  }

  async sendWelcomeRegistration(payload: WelcomeRegistrationPayload): Promise<SendResult> {
    const template = buildWelcomeRegistrationEmail(payload, this.config.appBaseUrl);
    return this.provider.send({
      from: this.config.fromAddress,
      to: payload.toEmail,
      ...template,
    });
  }

  /**
   * Sends appointment-created notifications: one to the patient and one to the doctor.
   * Doctor email is skipped when {@link AppointmentCreatedEmailContext.doctorEmail} is blank.
   */
  async sendAppointmentCreatedDual(ctx: AppointmentCreatedEmailContext): Promise<{
    patient: SendResult;
    doctor?: SendResult;
  }> {
    const patientHtml = buildAppointmentCreatedHtml(AppointmentEmailFlow.ToPatient, ctx);
    const patientText = buildAppointmentCreatedPlainText(AppointmentEmailFlow.ToPatient, ctx);
    const patientSubject = subjectForAppointmentCreated(AppointmentEmailFlow.ToPatient, ctx);
    const patient = await this.provider.send({
      from: this.config.fromAddress,
      to: ctx.patientEmail.trim(),
      subject: patientSubject,
      html: patientHtml,
      text: patientText,
    });

    const doctorEmail = String(ctx.doctorEmail ?? '').trim();
    if (!doctorEmail) {
      return { patient };
    }

    const doctorHtml = buildAppointmentCreatedHtml(AppointmentEmailFlow.ToDoctor, ctx);
    const doctorText = buildAppointmentCreatedPlainText(AppointmentEmailFlow.ToDoctor, ctx);
    const doctorSubject = subjectForAppointmentCreated(AppointmentEmailFlow.ToDoctor, ctx);
    const doctor = await this.provider.send({
      from: this.config.fromAddress,
      to: doctorEmail,
      subject: doctorSubject,
      html: doctorHtml,
      text: doctorText,
    });

    return { patient, doctor };
  }
}
