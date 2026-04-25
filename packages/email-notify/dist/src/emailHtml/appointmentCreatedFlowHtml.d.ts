/**
 * Assembles appointment-created HTML/plain text from templates in
 * `./appointmentCreatedEmailHtml.constants.ts` (stable ids + `data-email-flow` for customization).
 */
import type { AppointmentCreatedEmailContext } from '../types';
export declare const AppointmentEmailFlow: {
    readonly ToPatient: "ToPatient";
    readonly ToDoctor: "ToDoctor";
};
export type AppointmentEmailFlow = (typeof AppointmentEmailFlow)[keyof typeof AppointmentEmailFlow];
export declare function buildAppointmentCreatedHtml(flow: AppointmentEmailFlow, ctx: AppointmentCreatedEmailContext): string;
export declare function buildAppointmentCreatedPlainText(flow: AppointmentEmailFlow, ctx: AppointmentCreatedEmailContext): string;
export declare function subjectForAppointmentCreated(flow: AppointmentEmailFlow, ctx: AppointmentCreatedEmailContext): string;
