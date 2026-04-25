import { AppointmentSavePayload } from '../types';
export declare function buildAppointmentSaveEmail(payload: AppointmentSavePayload): {
    subject: string;
    html: string;
    text: string;
};
