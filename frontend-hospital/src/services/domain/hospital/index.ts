import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { navigationHospitalServices } from './navigation/navigationServices';
import { openAppointmentPopupHospitalServices } from './appointment/openAppointmentPopupService';
import { scrollHomeContactHospitalServices } from './navigation/scrollHomeContactService';
import { logoutUserHospitalServices } from './auth/logoutUserService';
import { registerRoleDepartmentHospitalServices } from './register/registerRoleDepartmentServices';
import { loadHomeContentHospitalServices } from './home/loadHomeContentService';
import { resolveHeroYoutubeVideoHospitalServices } from './home/resolveHeroYoutubeVideoService';
import { registerSuccessHospitalServices } from './register/registerSuccessServices';
import { loadDoctorsHospitalServices } from './home/loadDoctorsService';
import { authFormHospitalServices } from './auth/authFormServices';
import { registerFieldHospitalServices } from './register/registerFieldServices';
import { appointmentFormHospitalServices } from './appointment/appointmentFormServices';
import { authLoginHospitalServices } from './auth/authLoginService';
import { authGoogleLoginHospitalServices } from './auth/authGoogleLoginService';
import { passwordResetHospitalServices } from './auth/passwordResetServices';
import { registerUserHospitalServices } from './register/registerUserService';
import { bookAppointmentHospitalServices } from './appointment/bookAppointmentService';
import { dashboardHospitalServices } from './dashboard/dashboardServices';
import { chatHospitalServices } from './chat/chatServices';
import { callHospitalServices } from './call/callServices';
import { doctorScheduleHospitalServices } from './doctor/doctorScheduleHospitalServices';
import { profileUserHospitalServices } from './profile/profileUserServices';
import { prescriptionHospitalServices } from './prescription/prescriptionServices';
import { doctorEducationHospitalServices } from './education/doctorEducationServices';

/**
 * Same service ids and behavior as legacy `services.ts`, in the same registration order
 * (see git history) for parity with any implicit assumptions.
 */
export const hospitalServices: ServiceDefinition[] = [
  ...navigationHospitalServices,
  ...openAppointmentPopupHospitalServices,
  ...scrollHomeContactHospitalServices,
  ...logoutUserHospitalServices,
  ...registerRoleDepartmentHospitalServices,
  ...loadHomeContentHospitalServices,
  ...resolveHeroYoutubeVideoHospitalServices,
  ...registerSuccessHospitalServices,
  ...loadDoctorsHospitalServices,
  ...authFormHospitalServices,
  ...registerFieldHospitalServices,
  ...appointmentFormHospitalServices,
  ...authLoginHospitalServices,
  ...authGoogleLoginHospitalServices,
  ...passwordResetHospitalServices,
  ...registerUserHospitalServices,
  ...bookAppointmentHospitalServices,
  ...dashboardHospitalServices,
  ...chatHospitalServices,
  ...callHospitalServices,
  ...doctorScheduleHospitalServices,
  ...profileUserHospitalServices,
  ...prescriptionHospitalServices,
  ...doctorEducationHospitalServices
];
