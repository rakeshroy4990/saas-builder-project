"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailNotifyService = void 0;
const ResendProvider_1 = require("./providers/ResendProvider");
const TokenService_1 = require("./token/TokenService");
const appointment_cancel_1 = require("./templates/appointment-cancel");
const appointment_save_1 = require("./templates/appointment-save");
const reset_password_1 = require("./templates/reset-password");
const appointmentCreatedFlowHtml_1 = require("./emailHtml/appointmentCreatedFlowHtml");
class EmailNotifyService {
    constructor(config, tokenStore, customProvider) {
        this.config = config;
        if (customProvider) {
            this.provider = customProvider;
        }
        else if (config.provider === 'resend' && config.resend?.apiKey) {
            this.provider = new ResendProvider_1.ResendProvider(config.resend.apiKey);
        }
        else {
            throw new Error('No valid email provider configured');
        }
        this.tokenService = new TokenService_1.TokenService(tokenStore, config.tokenTtlSeconds ?? 3600);
    }
    async sendResetPassword(userId, toEmail, userName) {
        const token = await this.tokenService.generate(userId);
        const template = (0, reset_password_1.buildResetPasswordEmail)({ toEmail, userName, token }, this.config.appBaseUrl);
        const result = await this.provider.send({
            from: this.config.fromAddress,
            to: toEmail,
            ...template,
        });
        return { ...result, token };
    }
    async validateResetToken(rawToken) {
        return this.tokenService.validate(rawToken);
    }
    async sendAppointmentSave(payload) {
        const template = (0, appointment_save_1.buildAppointmentSaveEmail)(payload);
        return this.provider.send({
            from: this.config.fromAddress,
            to: payload.toEmail,
            ...template,
        });
    }
    async sendAppointmentCancel(payload) {
        const template = (0, appointment_cancel_1.buildAppointmentCancelEmail)(payload);
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
    async sendAppointmentCreatedDual(ctx) {
        const patientHtml = (0, appointmentCreatedFlowHtml_1.buildAppointmentCreatedHtml)(appointmentCreatedFlowHtml_1.AppointmentEmailFlow.ToPatient, ctx);
        const patientText = (0, appointmentCreatedFlowHtml_1.buildAppointmentCreatedPlainText)(appointmentCreatedFlowHtml_1.AppointmentEmailFlow.ToPatient, ctx);
        const patientSubject = (0, appointmentCreatedFlowHtml_1.subjectForAppointmentCreated)(appointmentCreatedFlowHtml_1.AppointmentEmailFlow.ToPatient, ctx);
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
        const doctorHtml = (0, appointmentCreatedFlowHtml_1.buildAppointmentCreatedHtml)(appointmentCreatedFlowHtml_1.AppointmentEmailFlow.ToDoctor, ctx);
        const doctorText = (0, appointmentCreatedFlowHtml_1.buildAppointmentCreatedPlainText)(appointmentCreatedFlowHtml_1.AppointmentEmailFlow.ToDoctor, ctx);
        const doctorSubject = (0, appointmentCreatedFlowHtml_1.subjectForAppointmentCreated)(appointmentCreatedFlowHtml_1.AppointmentEmailFlow.ToDoctor, ctx);
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
exports.EmailNotifyService = EmailNotifyService;
