import { AppointmentCancelPayload } from '../types';
export declare function buildAppointmentCancelEmail(payload: AppointmentCancelPayload): {
    subject: string;
    html: string;
    text: string;
};
