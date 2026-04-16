import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../store/useAppStore';
import { usePopupStore } from '../../../store/usePopupStore';
import { pinia } from '../../../store/pinia';
import { apiClient } from '../../http/apiClient';
import { URLRegistry } from '../../http/URLRegistry';
import { clearAuthToken } from '../../auth/authToken';
import { setAuthTokens } from '../../auth/authToken';
import { stompClient } from '../../realtime/stompClient';
import { useToastStore } from '../../../store/useToastStore';
import {
  clearPersistedAuthSessionProfile,
  persistAuthSessionProfile
} from '../../auth/authSessionStore';

const ok = (data: Record<string, unknown> = {}) => ({ responseCode: 'SUCCESS', ...data });
const CLOUDINARY_SEA_IMAGE =
  'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/sea_xgqlrq.jpg';
const MEDICAL_DEPARTMENT_CACHE_KEY = 'hospital.medicalDepartments';
const APPOINTMENT_DOCTOR_CACHE_KEY = 'hospital.appointmentDoctorsByDepartment';
const PRESCRIPTION_LIMIT_ERROR_MESSAGE =
  'Can not upload more than two images, please upload latest two images of prescription';
let appointmentPrescriptionFiles: File[] = [];
let chatSubscription: { unsubscribe: () => void } | null = null;
let supportSubscription: { unsubscribe: () => void } | null = null;
let webrtcSubscription: { unsubscribe: () => void } | null = null;
let callHeartbeatTimer: number | null = null;

const hospitalHomeContent = {
  hero: {
    title: 'Your Health, Our Priority',
    subtitle:
      'Experience compassionate care with state-of-the-art medical facilities. Our team of expert physicians is dedicated to your wellbeing.',
    image: CLOUDINARY_SEA_IMAGE,
    ctaPrimary: 'Schedule Visit',
    ctaSecondary: 'Emergency Care'
  },
  // stats: [
  //   { value: '5+', label: 'Years Experience' },
  //   // { value: '150+', label: 'Expert Doctors' },
  //   { value: '1k+', label: 'Happy Patients' }
  // ],
  services: [
    // {
    //   icon: '❤️',
    //   name: 'Cardiology',
    //   description: 'Advanced heart care with cutting-edge diagnostic and treatment options',
    //   image: CLOUDINARY_SEA_IMAGE
    // },
    // { icon: '🧠', name: 'Neurology', description: 'Expert care for brain and nervous system conditions' },
    // { icon: '🦴', name: 'Orthopedics', description: 'Specialized treatment for bone, joint, and muscle conditions' },
    { icon: '👶', name: 'Pediatrics', description: 'Gentle and comprehensive care for children of all ages' },
    // { icon: '🔬', name: 'Laboratory', description: 'State-of-the-art diagnostic testing and analysis' },
    // { icon: '🚑', name: 'Emergency Care', description: '24/7 emergency services with rapid response team' }
  ],
  doctors: [
    {
      name: 'Dr. Swati Pandey',
      speciality: 'Pediatrics Specialist',
      degree: 'MD, Stanford Medicine',
      experience: '5+ years experience',
      image: 'Dr_Swati_Pandey_rtmfqj'
    }
  ],
  highlights: [
    { title: 'Advanced Technology', detail: 'Latest medical equipment and diagnostic tools' },
    { title: 'Expert Medical Team', detail: 'Board-certified physicians and specialists' },
    { title: '24/7 Emergency Care', detail: 'Round-the-clock emergency services' },
    { title: 'Patient-Centered Care', detail: 'Personalized treatment plans for every patient' }
  ],
  contact: {
    phone: 'Emergency: 9569955006 | Appointments: 9569955006',
    location: '123 Medical Center Whitefield, Bangalore 560066',
    hours: 'Monday - Friday: 8AM - 8PM | Emergency: 24/7'
  }
};

export const hospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-login-popup',
    execute: async (request) => {
      const preferredIdentity = String(request.data.identity ?? '').trim();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', preferredIdentity);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-login-popup-after-register',
    execute: async (request) => {
      const preferredIdentity = String(request.data.identity ?? '').trim();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', preferredIdentity);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty(
        'hospital',
        'AuthForm',
        'loginInfoMessage',
        'You have successfully registered. Please login to continue.'
      );
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-register-popup',
    execute: async () => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'emailId', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'address', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'gender', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'mobileNumber', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'role', 'PATIENT');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'department', '');
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'registerSuccessMessage',
        'Registration successful. You can now log in.'
      );
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'register-popup', title: 'register' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-appointment-popup',
    execute: async () => {
      const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<
        string,
        unknown
      >;
      const userId = String(authSession.userId ?? '').trim();
      if (!userId) {
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
        usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
        return ok();
      }
      await ensureMedicalDepartmentOptionsLoaded();
      const departments = (useAppStore(pinia).getData('hospital', 'MedicalDepartments') ?? {}) as Record<
        string,
        unknown
      >;
      const departmentList = Array.isArray(departments.list) ? departments.list : [];
      useAppStore(pinia).setData('hospital', 'AppointmentDepartments', { list: departmentList });
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'department', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctor', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'ageGroup', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'additionalNotes', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'prescriptionFileNames', []);
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'prescriptionUploadError', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
      appointmentPrescriptionFiles = [];
      useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'appointment-popup', title: 'appointment' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'logout-user',
    execute: async () => {
      try {
        await apiClient.post(URLRegistry.paths.logout, { DeviceId: 'browser' });
      } catch {
        // Local logout should still proceed even when server call fails.
      }
      clearAuthToken();
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userId', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'email', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'mobileNumber', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'address', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'gender', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'department', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'fullName', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'role', '');
      useAppStore(pinia).setProperty('hospital', 'AuthSession', 'loginDisplayName', 'Login');
      clearPersistedAuthSessionProfile();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'emailId', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'address', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'gender', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'mobileNumber', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'role', 'PATIENT');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'department', '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      usePopupStore(pinia).close();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-role',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'role',
        String(request.data.value ?? 'PATIENT')
      );
      const role = String(request.data.value ?? 'PATIENT').toUpperCase();
      if (role !== 'DOCTOR') {
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'department', '');
      } else {
        await ensureMedicalDepartmentOptionsLoaded();
      }
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-department',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'RegisterForm',
        'department',
        String(request.data.value ?? '')
      );
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'load-home-content',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'HomeContent', hospitalHomeContent);
      const currentSession = useAppStore(pinia).getData('hospital', 'AuthSession') as
        | Record<string, unknown>
        | undefined;
      if (!currentSession?.userDisplayName) {
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', 'Login');
      }
      if (!currentSession?.loginDisplayName) {
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'loginDisplayName', 'Login');
      }
      if (!currentSession?.fullName) {
        const fallbackDisplayName = String(currentSession?.userDisplayName ?? '').trim();
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthSession',
          'fullName',
          fallbackDisplayName && fallbackDisplayName !== 'Login' ? fallbackDisplayName : ''
        );
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-register-success-popup',
    execute: async () => {
      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'register-success-popup',
        title: 'registration-success'
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'ack-register-success',
    execute: async () => {
      const registerForm = (useAppStore(pinia).getData('hospital', 'RegisterForm') ?? {}) as Record<
        string,
        unknown
      >;
      const email = String(registerForm.emailId ?? '').trim();
      usePopupStore(pinia).close();
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', email);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'load-doctors',
    execute: async () => {
      useAppStore(pinia).setData('hospital', 'Doctors', {
        list: [
          { id: 'doc-1', label: 'Dr. Sarah Mitchell', value: 'doc-1' },
          { id: 'doc-2', label: 'Dr. James Patterson', value: 'doc-2' },
          { id: 'doc-3', label: 'Dr. Emily Chen', value: 'doc-3' }
        ]
      });
      useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
      useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', { byDepartment: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-auth-identity',
    execute: async (request) => {
      const identity = String(request.data.value ?? '');
      const email = identity.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailError =
        email.length === 0 || emailRegex.test(email) ? '' : 'Please enter a valid email address.';
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'identity', identity);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', emailError);
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-auth-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'password', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
      useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-first-name',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-last-name',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-email',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'emailId', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-password',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'password', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-address',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'address', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-gender',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'gender', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-register-mobile',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'mobileNumber', request.data.value ?? '');
      useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-date',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'preferredDate',
        String(request.data.value ?? '')
      );
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-time-slot',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'preferredTimeSlot',
        String(request.data.value ?? '')
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-department',
    execute: async (request) => {
      const department = String(request.data.value ?? '').trim();
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'department', department);
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctor', '');
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
      if (!department) {
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
        return ok();
      }
      try {
        const doctors = await ensureDoctorOptionsLoadedByDepartment(department);
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: doctors });
      } catch {
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
        useAppStore(pinia).setProperty(
          'hospital',
          'AppointmentForm',
          'doctorLoadError',
          'Unable to load the Doctors please try again'
        );
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-doctor',
    execute: async (request) => {
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'doctor',
        String(request.data.value ?? '').trim()
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-prescriptions',
    execute: async (request) => {
      const payload = request.data as Record<string, unknown>;
      const selectedFiles = Array.isArray(payload.files) ? (payload.files as File[]) : [];
      const exceedsLimit = selectedFiles.length > 2;
      appointmentPrescriptionFiles = exceedsLimit ? selectedFiles.slice(-2) : selectedFiles;
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'prescriptionFileNames',
        appointmentPrescriptionFiles.map((file) => file.name)
      );
      useAppStore(pinia).setProperty(
        'hospital',
        'AppointmentForm',
        'prescriptionUploadError',
        exceedsLimit ? PRESCRIPTION_LIMIT_ERROR_MESSAGE : ''
      );
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-age',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'ageGroup', String(request.data.value ?? '').trim());
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-appointment-notes',
    execute: async (request) => {
      useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'additionalNotes', String(request.data.value ?? ''));
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'auth-login',
    responseCodes: { failure: ['AUTH_FAILED'] },
    execute: async (request) => {
      const identity = String(request.data.identity ?? '').trim();
      const password = String(request.data.password ?? '').trim();
      if (!identity || !password) {
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', 'Email and password are required.');
        return { responseCode: 'AUTH_FAILED', message: 'Missing credentials' };
      }

      try {
        const response = await apiClient.post(URLRegistry.paths.login, {
          EmailId: identity,
          Password: password
        });
        const userData = (response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        if (!userData || Object.keys(userData).length === 0) {
          useAppStore(pinia).setProperty(
            'hospital',
            'AuthForm',
            'authError',
            'Unexpected login response. Please try again.'
          );
          return { responseCode: 'AUTH_FAILED', message: 'Login response missing user data' };
        }
        const displayName = buildFriendlyDisplayName(userData, identity);
        const accessToken =
          pickString(userData, ['accessToken', 'AccessToken', 'token', 'Token']) || '';
        const refreshToken = pickString(userData, ['refreshToken', 'RefreshToken']) || '';
        if (accessToken && refreshToken) {
          setAuthTokens(accessToken, refreshToken);
        }
        const firstName = pickString(userData, ['FirstName', 'firstName']);
        const lastName = pickString(userData, ['LastName', 'lastName']);
        const fullNameFromNames = [firstName, lastName].filter(Boolean).join(' ').trim();
        const fullName = fullNameFromNames || displayName;
        const resolvedEmail = pickString(userData, ['Email', 'email']) || identity;
        const resolvedMobileNumber = pickString(userData, ['MobileNumber', 'mobileNumber']);
        const resolvedAddress = pickString(userData, ['Address', 'address']);
        const resolvedGender = pickString(userData, ['Gender', 'gender']);
        const resolvedDepartment = pickString(userData, ['Department', 'department']);
        const resolvedRole = pickString(userData, ['Role', 'role']).toUpperCase() || 'PATIENT';
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthSession',
          'userId',
          pickString(userData, ['UserId', 'userId']) || identity
        );
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'userDisplayName', displayName);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'email', resolvedEmail);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'mobileNumber', resolvedMobileNumber);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'address', resolvedAddress);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'gender', resolvedGender);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'department', resolvedDepartment);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'fullName', fullName);
        useAppStore(pinia).setProperty('hospital', 'AuthSession', 'role', resolvedRole);
        persistAuthSessionProfile({
          userId: pickString(userData, ['UserId', 'userId']) || identity,
          userDisplayName: displayName,
          fullName,
          loginDisplayName: displayName,
          email: resolvedEmail,
          mobileNumber: resolvedMobileNumber,
          address: resolvedAddress,
          gender: resolvedGender,
          department: resolvedDepartment,
          role: resolvedRole
        });
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'emailError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', '');
        useAppStore(pinia).setProperty('hospital', 'AuthForm', 'loginInfoMessage', '');
        return ok();
      } catch (error) {
        if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          const errorPayload = (error.response?.data ?? {}) as Record<string, unknown>;
          const message =
            pickString(errorPayload, ['message', 'Message']) || 'Invalid email or password';
          useAppStore(pinia).setProperty('hospital', 'AuthForm', 'authError', message);
          return { responseCode: 'AUTH_FAILED', message };
        }
        useAppStore(pinia).setProperty(
          'hospital',
          'AuthForm',
          'authError',
          'Unable to login right now. Please try again.'
        );
        return { responseCode: 'AUTH_FAILED', message: 'Unable to login right now. Please try again.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'register-user',
    responseCodes: { failure: ['REGISTER_FAILED'] },
    execute: async (request) => {
      const firstName = String(request.data.firstName ?? '').trim();
      const lastName = String(request.data.lastName ?? '').trim();
      const emailId = String(request.data.emailId ?? '').trim();
      const password = String(request.data.password ?? '').trim();
      const address = String(request.data.address ?? '').trim();
      const gender = String(request.data.gender ?? '').trim();
      const mobileNumber = String(request.data.mobileNumber ?? '').trim();
      const department = String(request.data.department ?? '').trim();
      const role = String(request.data.role ?? 'PATIENT').trim().toUpperCase() || 'PATIENT';
      if (!firstName || !lastName || !emailId || !password || !address || !gender || !mobileNumber) {
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', 'All fields are required.');
        return { responseCode: 'REGISTER_FAILED', message: 'Missing registration details' };
      }

      try {
        const response = await apiClient.post(URLRegistry.paths.register, {
          FirstName: firstName,
          LastName: lastName,
          EmailId: emailId,
          Password: password,
          Address: address,
          Gender: gender,
          MobileNumber: mobileNumber,
          Department: department,
          Role: role
        });
        if (response.status !== 201 && response.status !== 200) {
          useAppStore(pinia).setProperty(
            'hospital',
            'RegisterForm',
            'registerError',
            'Unable to register right now. Please try again.'
          );
          return { responseCode: 'REGISTER_FAILED', message: 'Registration failed' };
        }
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'firstName', firstName);
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'lastName', lastName);
        useAppStore(pinia).setProperty('hospital', 'RegisterForm', 'registerError', '');
        const registerData = (response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const roleStatus = pickString(registerData, ['RoleStatus', 'roleStatus']);
        const requestedRole = pickString(registerData, ['RequestedRole', 'requestedRole']) || role;
        const successMessage =
          roleStatus === 'PENDING_APPROVAL'
            ? `${requestedRole} access request submitted for approval by an admin.`
            : 'Registration successful. You can now log in.';
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerSuccessMessage',
          successMessage
        );
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? String(error.response?.data?.message ?? '').trim()
          : '';
        useAppStore(pinia).setProperty(
          'hospital',
          'RegisterForm',
          'registerError',
          message || 'Unable to register right now. Please try again.'
        );
        return { responseCode: 'REGISTER_FAILED', message: message || 'Registration failed' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'book-appointment',
    responseCodes: { failure: ['BOOK_APPOINTMENT_FAILED'] },
    execute: async () => {
      const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const form = (useAppStore(pinia).getData('hospital', 'AppointmentForm') ?? {}) as Record<string, unknown>;

      const payload = {
        PatientName: pickString(authSession, ['fullName', 'FullName', 'userDisplayName']),
        Email: pickString(authSession, ['email', 'Email']),
        PhoneNumber: pickString(authSession, ['mobileNumber', 'MobileNumber']),
        AgeGroup: pickString(form, ['ageGroup', 'AgeGroup']),
        Department: pickString(form, ['department', 'Department']),
        DoctorId: pickString(form, ['doctor', 'DoctorId']),
        PreferredDate: pickString(form, ['preferredDate', 'PreferredDate']),
        PreferredTimeSlot: pickString(form, ['preferredTimeSlot', 'PreferredTimeSlot']),
        AdditionalNotes: pickString(form, ['additionalNotes', 'AdditionalNotes'])
      };

      const missingRequired = [
        payload.PatientName,
        payload.Email,
        payload.PhoneNumber,
        payload.AgeGroup,
        payload.Department,
        payload.DoctorId,
        payload.PreferredDate,
        payload.PreferredTimeSlot
      ].some((value) => !String(value ?? '').trim());

      if (missingRequired) {
        return { responseCode: 'BOOK_APPOINTMENT_FAILED', message: 'Please complete all required appointment fields.' };
      }

      try {
        const formData = new FormData();
        formData.append('appointment', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
        for (const file of appointmentPrescriptionFiles) {
          formData.append('prescriptions', file);
        }

        const response = await apiClient.post(URLRegistry.paths.appointmentCreate, formData);
        const dataNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredDate', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'department', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'doctor', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'ageGroup', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'additionalNotes', '');
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'prescriptionFileNames', []);
        useAppStore(pinia).setProperty('hospital', 'AppointmentForm', 'prescriptionUploadError', '');
        useAppStore(pinia).setData('hospital', 'AppointmentDoctors', { list: [] });
        appointmentPrescriptionFiles = [];
        return ok({ appointmentId: pickString(dataNode, ['Id', 'id']) || '' });
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to book appointment right now.'
          : 'Unable to book appointment right now.';
        return { responseCode: 'BOOK_APPOINTMENT_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-connect',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      try {
        appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'connecting' });
        await stompClient.connect();
        if (!chatSubscription) {
          chatSubscription = stompClient.subscribe('/user/queue/chat', (msg) => {
            try {
              const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
              const roomId = String(event.roomId ?? '').trim();
              if (!roomId) return;
              const messageId = String(event.messageId ?? '').trim();
              const sequenceNumber = Number(event.sequenceNumber ?? 0);
              const senderId = String(event.senderId ?? '').trim();
              const body = String(event.body ?? '');
              const clientMessageId = String(event.clientMessageId ?? '').trim();
              const createdTimestamp = String(event.createdTimestamp ?? '');

              const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
              const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
              const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];
              let didChange = false;
              let next = existing;

              // Reconcile an optimistic pending message (matching `clientMessageId`) once the server ack arrives.
              if (clientMessageId) {
                const idx = existing.findIndex((m: any) => {
                  const existingClientMessageId = String(m?.clientMessageId ?? '').trim();
                  const existingMessageId = String(m?.messageId ?? '').trim();
                  return existingClientMessageId === clientMessageId && (!existingMessageId || m?.status === 'pending');
                });

                if (idx >= 0) {
                  next = [...existing];
                  next[idx] = {
                    roomId,
                    messageId,
                    sequenceNumber,
                    senderId,
                    body,
                    clientMessageId,
                    createdTimestamp,
                    status: 'received'
                  };
                  didChange = true;
                }
              }

              if (!didChange) {
                const already = messageId ? existing.some((m) => (m as any)?.messageId === messageId) : false;
                if (!already) {
                  next = [...existing, { roomId, messageId, sequenceNumber, senderId, body, clientMessageId, createdTimestamp, status: 'received' }];
                  didChange = true;
                }
              }

              if (didChange) {
                next = [...next].sort((a: any, b: any) => Number(a.sequenceNumber ?? 0) - Number(b.sequenceNumber ?? 0));
                appStore.setData('hospital', 'Chat', {
                  ...chat,
                  status: 'connected',
                  messagesByRoomId: { ...messagesByRoomId, [roomId]: next }
                });
              }
              if (sequenceNumber > 0) {
                const lastAcked = (chat.lastAckedSequenceByRoomId ?? {}) as Record<string, unknown>;
                const prior = Number(lastAcked[roomId] ?? 0);
                const upTo = Math.max(prior, sequenceNumber);
                appStore.setData('hospital', 'Chat', {
                  ...(appStore.getData('hospital', 'Chat') as object),
                  lastAckedSequenceByRoomId: { ...lastAcked, [roomId]: upTo }
                });
                stompClient.publish('/app/chat.ack', { roomId, upToSequenceNumber: upTo });
              }
            } catch {
              // no-op
            }
          });
        }

        if (!supportSubscription) {
          supportSubscription = stompClient.subscribe('/user/queue/support', async (msg) => {
            try {
              const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
              const type = String(event.type ?? '').trim();
              if (!type) return;

              const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;

              if (type === 'support_request_created') {
                const requestId = String(event.requestId ?? '').trim();
                const requesterUserId = String(event.requesterUserId ?? '').trim();
                const requesterDisplayName = String(event.requesterDisplayName ?? '').trim();
                if (!requestId || !requesterUserId) return;
                const existing = Array.isArray(chat.supportRequests) ? (chat.supportRequests as unknown[]) : [];
                const already = existing.some((r: any) => String((r as any)?.requestId ?? (r as any)?.id ?? '') === requestId);
                if (already) return;
                appStore.setData('hospital', 'Chat', {
                  ...chat,
                  supportRequests: [{ requestId, requesterUserId, requesterDisplayName }, ...existing].slice(0, 20)
                });
                return;
              }

              if (type === 'support_request_assigned') {
                const roomId = String(event.roomId ?? '').trim();
                const requestId = String(event.requestId ?? '').trim();
                const assignedAgentUserId = String(event.assignedAgentUserId ?? '').trim();
                if (!roomId) return;

                // Remove from inbox if present
                const existing = Array.isArray(chat.supportRequests) ? (chat.supportRequests as any[]) : [];
                const remaining = requestId ? existing.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId) : existing;
                const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
                const myUserId = String(authSession.userId ?? '').trim();
                const isAssignedAgent = assignedAgentUserId && myUserId && assignedAgentUserId === myUserId;
                const isRequester = requestId && String(chat.supportRequestId ?? '').trim() === requestId;

                if (!isAssignedAgent && !isRequester) {
                  appStore.setData('hospital', 'Chat', { ...chat, supportRequests: remaining });
                  return;
                }

                const messagesResponse = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
                const messagesNode = (messagesResponse.data?.Data ?? messagesResponse.data?.data ?? []) as unknown;
                const messages = Array.isArray(messagesNode) ? messagesNode : [];
                const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;

                appStore.setData('hospital', 'Chat', {
                  ...chat,
                  status: 'connected',
                  activeRoomId: roomId,
                  supportRequests: remaining,
                  messagesByRoomId: { ...messagesByRoomId, [roomId]: messages }
                });

                await flushQueuedSupportMessages(roomId, appStore);
                return;
              }

              if (type === 'support_request_closed') {
                const requestId = String(event.requestId ?? '').trim();
                if (!requestId) return;
                const existing = Array.isArray(chat.supportRequests) ? (chat.supportRequests as any[]) : [];
                const remaining = existing.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId);
                appStore.setData('hospital', 'Chat', { ...chat, supportRequests: remaining });
              }
            } catch {
              // no-op
            }
          });
        }

        try {
          const openResponse = await apiClient.get(URLRegistry.paths.chatSupportOpen);
          const openNode = (openResponse.data?.Data ?? openResponse.data?.data ?? []) as unknown;
          const openRequests = Array.isArray(openNode) ? openNode : [];
          const normalized = openRequests
            .map((entry) => {
              const row = (entry ?? {}) as Record<string, unknown>;
              const requestId = String(
                row.id ?? row.Id ?? row._id ?? row.requestId ?? row['request_id'] ?? ''
              ).trim();
              const requesterUserId = String(
                row.requesterUserId ?? row.RequesterUserId ?? row['requester_user_id'] ?? ''
              ).trim();
              const requesterDisplayName = String(
                row.requesterDisplayName ?? row.RequesterDisplayName ?? row['requester_display_name'] ?? ''
              ).trim();
              if (!requestId || !requesterUserId) return null;
              return { requestId, requesterUserId, requesterDisplayName };
            })
            .filter((value): value is { requestId: string; requesterUserId: string; requesterDisplayName: string } => value !== null);

          if (normalized.length > 0) {
            const latestChat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
            const existing = Array.isArray(latestChat.supportRequests) ? (latestChat.supportRequests as unknown[]) : [];
            const seen = new Set<string>();
            const merged = [...normalized, ...existing]
              .map((item) => {
                const row = (item ?? {}) as Record<string, unknown>;
                const requestId = String(row.requestId ?? row.id ?? '').trim();
                const requesterUserId = String(row.requesterUserId ?? '').trim();
                const requesterDisplayName = String(row.requesterDisplayName ?? '').trim();
                if (!requestId || !requesterUserId) return null;
                if (seen.has(requestId)) return null;
                seen.add(requestId);
                return { requestId, requesterUserId, requesterDisplayName };
              })
              .filter((value): value is { requestId: string; requesterUserId: string; requesterDisplayName: string } => value !== null)
              .slice(0, 20);

            appStore.setData('hospital', 'Chat', { ...latestChat, supportRequests: merged });
          }
        } catch {
          // no-op: live websocket events still update support requests
        }

        appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'connected' });
        return ok();
      } catch (err) {
        toastStore.show('Unable to connect to chat right now.', 'error');
        appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'error' });
        return { responseCode: 'CHAT_CONNECT_FAILED', message: 'Unable to connect to chat right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-disconnect',
    execute: async () => {
      if (chatSubscription) {
        chatSubscription.unsubscribe();
        chatSubscription = null;
      }
      if (supportSubscription) {
        supportSubscription.unsubscribe();
        supportSubscription = null;
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-load-rooms',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const response = await apiClient.get(URLRegistry.paths.chatRooms);
      const dataNode = (response.data?.Data ?? response.data?.data ?? []) as unknown;
      const rooms = Array.isArray(dataNode) ? dataNode : [];
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'Chat', { ...chat, rooms });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-open-room',
    execute: async (request) => {
      const roomId = String(request.data.roomId ?? '').trim();
      const appStore = useAppStore(pinia);
      if (!roomId) return { responseCode: 'CHAT_OPEN_FAILED', message: 'Missing roomId' };
      const response = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
      const dataNode = (response.data?.Data ?? response.data?.data ?? []) as unknown;
      const messages = Array.isArray(dataNode) ? dataNode : [];
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'Chat', { ...chat, activeRoomId: roomId, messagesByRoomId: { ...messagesByRoomId, [roomId]: messages } });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-start',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);

      try {
        appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'starting' });

        // `chat-connect` is usually executed via popup `initializeActions`, but
        // the widget can auto-start quickly. Don't block room creation on WS issues.
        try {
          await stompClient.connect();

          // If `chat-connect` didn't run yet, ensure subscription exists so the UI receives messages.
          if (!chatSubscription) {
            chatSubscription = stompClient.subscribe('/user/queue/chat', (msg) => {
              try {
                const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
                const roomId = String(event.roomId ?? '').trim();
                if (!roomId) return;

                const messageId = String(event.messageId ?? '').trim();
                const sequenceNumber = Number(event.sequenceNumber ?? 0);
                const senderId = String(event.senderId ?? '').trim();
                const body = String(event.body ?? '');
                const clientMessageId = String(event.clientMessageId ?? '').trim();
                const createdTimestamp = String(event.createdTimestamp ?? '');

                const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
                const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
                const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];

                let didChange = false;
                let next = existing;

                // Reconcile an optimistic pending message with `clientMessageId`.
                if (clientMessageId) {
                  const idx = existing.findIndex((m: any) => {
                    const existingClientMessageId = String(m?.clientMessageId ?? '').trim();
                    const existingMessageId = String(m?.messageId ?? '').trim();
                    return (
                      existingClientMessageId === clientMessageId &&
                      (!existingMessageId || m?.status === 'pending')
                    );
                  });

                  if (idx >= 0) {
                    next = [...existing];
                    next[idx] = {
                      roomId,
                      messageId,
                      sequenceNumber,
                      senderId,
                      body,
                      clientMessageId,
                      createdTimestamp,
                      status: 'received'
                    };
                    didChange = true;
                  }
                }

                if (!didChange) {
                  const already = messageId ? existing.some((m) => (m as any)?.messageId === messageId) : false;
                  if (!already) {
                    next = [
                      ...existing,
                      {
                        roomId,
                        messageId,
                        sequenceNumber,
                        senderId,
                        body,
                        clientMessageId,
                        createdTimestamp,
                        status: 'received'
                      }
                    ];
                    didChange = true;
                  }
                }

                if (didChange) {
                  next = [...next].sort((a: any, b: any) => Number(a.sequenceNumber ?? 0) - Number(b.sequenceNumber ?? 0));
                  appStore.setData('hospital', 'Chat', {
                    ...chat,
                    status: 'connected',
                    messagesByRoomId: { ...messagesByRoomId, [roomId]: next }
                  });
                }

                if (sequenceNumber > 0) {
                  const lastAcked = (chat.lastAckedSequenceByRoomId ?? {}) as Record<string, unknown>;
                  const prior = Number(lastAcked[roomId] ?? 0);
                  const upTo = Math.max(prior, sequenceNumber);
                  appStore.setData('hospital', 'Chat', {
                    ...(appStore.getData('hospital', 'Chat') as object),
                    lastAckedSequenceByRoomId: { ...lastAcked, [roomId]: upTo }
                  });
                  stompClient.publish('/app/chat.ack', { roomId, upToSequenceNumber: upTo });
                }
              } catch {
                // no-op
              }
            });
          }
        } catch {
          // WS connect/subscribe failed; still proceed to create/load the direct room.
        }

        // Create a support request. Online admins will receive it and the first accept will assign a room.
        const response = await apiClient.post(URLRegistry.paths.chatSupportRequest, {});
        const dataNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const requestId = String(dataNode.id ?? dataNode.Id ?? '').trim();
        const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
        appStore.setData('hospital', 'Chat', { ...chat, status: 'waiting_for_admin', activeRoomId: '', supportRequestId: requestId });

        // After support request succeeds (and refresh may have rotated tokens),
        // ensure STOMP reconnects with latest bearer token.
        try {
          await stompClient.connect();
        } catch {
          // no-op: user can still wait for admin; connect will be retried by connect action/reconnect logic.
        }

        return ok({ requestId });
      } catch (err) {
        const currentChat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
        appStore.setData('hospital', 'Chat', { ...currentChat, status: 'error', activeRoomId: '' });

        if (isAxiosError(err)) {
          const status = err.response?.status;
          const serverMessage =
            String(err.response?.data?.message ?? err.response?.data?.Message ?? err.message ?? '').trim() ||
            'Unable to start chat right now.';

          // For auth failures, the API client interceptor already handles logout/redirect.
          if (status === 401 || status === 403) {
            return { responseCode: 'CHAT_START_AUTH_FAILED', message: serverMessage };
          }

          toastStore.show(serverMessage, 'error');
          return { responseCode: 'CHAT_START_FAILED', message: serverMessage };
        }

        toastStore.show('Unable to start chat right now.', 'error');
        return { responseCode: 'CHAT_START_FAILED', message: 'Unable to start chat right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-send-message',
    execute: async (request) => {
      const roomId = String(request.data.roomId ?? '').trim();
      const body = String(request.data.body ?? '').trim();
      const clientMessageId = String(request.data.clientMessageId ?? crypto.randomUUID()).trim();
      if (!body) return { responseCode: 'CHAT_SEND_FAILED', message: 'Message is empty' };

      const appStore = useAppStore(pinia);
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;

      if (!roomId) {
        const status = String(chat.status ?? '').trim();
        const canQueue =
          status === 'waiting_for_admin' || status === 'starting' || status === 'connecting';
        if (!canQueue) {
          return { responseCode: 'CHAT_SEND_FAILED', message: 'Chat is not connected yet' };
        }

        const pending = Array.isArray(chat.pendingMessages) ? (chat.pendingMessages as unknown[]) : [];
        const queued = [
          ...pending,
          {
            body,
            clientMessageId,
            createdTimestamp: new Date().toISOString(),
            status: 'queued'
          }
        ];
        appStore.setData('hospital', 'Chat', { ...chat, pendingMessages: queued });
        return ok({ clientMessageId, queued: true });
      }

      const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];
      const optimistic = [
        ...existing,
        { roomId, messageId: '', sequenceNumber: 0, senderId: 'me', body, clientMessageId, createdTimestamp: new Date().toISOString(), status: 'pending' }
      ];
      appStore.setData('hospital', 'Chat', { ...chat, messagesByRoomId: { ...messagesByRoomId, [roomId]: optimistic } });
      try {
        stompClient.publish('/app/chat.send', { roomId, body, clientMessageId });
      } catch {
        // If WS isn't connected yet, attempt to connect once before failing.
        await stompClient.connect();
        stompClient.publish('/app/chat.send', { roomId, body, clientMessageId });
      }
      return ok({ clientMessageId });
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-support-accept',
    execute: async (request) => {
      const requestId = String(request.data?.requestId ?? '').trim();
      if (!requestId) return { responseCode: 'CHAT_SUPPORT_ACCEPT_FAILED', message: 'Missing requestId' };

      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);

      try {
        const response = await apiClient.post(URLRegistry.paths.chatSupportAccept, { requestId });
        const roomNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const roomId = String(roomNode.id ?? roomNode.Id ?? roomNode._id ?? '').trim();
        if (!roomId) {
          toastStore.show('Unable to accept chat right now.', 'error');
          return { responseCode: 'CHAT_SUPPORT_ACCEPT_FAILED', message: 'Unable to accept chat right now.' };
        }

        const messagesResponse = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
        const messagesNode = (messagesResponse.data?.Data ?? messagesResponse.data?.data ?? []) as unknown;
        const messages = Array.isArray(messagesNode) ? messagesNode : [];

        const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
        const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
        const existingReqs = Array.isArray(chat.supportRequests) ? (chat.supportRequests as any[]) : [];
        const remaining = existingReqs.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId);

        appStore.setData('hospital', 'Chat', {
          ...chat,
          status: 'connected',
          activeRoomId: roomId,
          supportRequests: remaining,
          messagesByRoomId: { ...messagesByRoomId, [roomId]: messages }
        });

        await flushQueuedSupportMessages(roomId, appStore);

        return ok({ roomId });
      } catch {
        toastStore.show('Unable to accept chat right now.', 'error');
        return { responseCode: 'CHAT_SUPPORT_ACCEPT_FAILED', message: 'Unable to accept chat right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-support-reject',
    execute: async (request) => {
      const requestId = String(request.data?.requestId ?? '').trim();
      if (!requestId) return { responseCode: 'CHAT_SUPPORT_REJECT_FAILED', message: 'Missing requestId' };

      const appStore = useAppStore(pinia);
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      const existingReqs = Array.isArray(chat.supportRequests) ? (chat.supportRequests as any[]) : [];
      const remaining = existingReqs.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId);
      appStore.setData('hospital', 'Chat', { ...chat, supportRequests: remaining });

      try {
        await apiClient.post(URLRegistry.paths.chatSupportReject, { requestId });
        return ok({ requestId });
      } catch {
        // Keep request removed locally for responsive admin workflow.
        // Server-side close broadcast will synchronize other clients after backend is updated/restarted.
        return ok({ requestId, pendingServerSync: true });
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-connect',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      try {
        await stompClient.connect();
        if (!webrtcSubscription) {
          webrtcSubscription = stompClient.subscribe('/user/queue/webrtc', (msg) => {
            try {
              const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
              const signalType = String(event.signalType ?? '').trim();
              const callId = String(event.callId ?? '').trim();
              const fromUserId = String(event.fromUserId ?? '').trim();
              const payload = (event.payload ?? {}) as Record<string, unknown>;
              const call = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
              appStore.setData('hospital', 'VideoCall', { ...call, lastSignalType: signalType, callId, fromUserId, payload });
            } catch {
              // no-op
            }
          });
        }
        return ok();
      } catch {
        toastStore.show('Unable to connect to calling right now.', 'error');
        return { responseCode: 'CALL_CONNECT_FAILED', message: 'Unable to connect to calling right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-disconnect',
    execute: async () => {
      if (webrtcSubscription) {
        webrtcSubscription.unsubscribe();
        webrtcSubscription = null;
      }
      if (callHeartbeatTimer) {
        window.clearInterval(callHeartbeatTimer);
        callHeartbeatTimer = null;
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-invite',
    execute: async (request) => {
      const toUserId = String(request.data.toUserId ?? '').trim();
      if (!toUserId) return { responseCode: 'CALL_INVITE_FAILED', message: 'Missing user' };
      stompClient.publish('/app/webrtc.signal', { type: 'invite', toUserId, payload: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-accept',
    execute: async (request) => {
      const callId = String(request.data.callId ?? '').trim();
      if (!callId) return { responseCode: 'CALL_ACCEPT_FAILED', message: 'Missing callId' };
      stompClient.publish('/app/webrtc.signal', { type: 'accept', callId, payload: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-reject',
    execute: async (request) => {
      const callId = String(request.data.callId ?? '').trim();
      if (!callId) return { responseCode: 'CALL_REJECT_FAILED', message: 'Missing callId' };
      stompClient.publish('/app/webrtc.signal', { type: 'reject', callId, payload: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-end',
    execute: async (request) => {
      const callId = String(request.data.callId ?? '').trim();
      if (!callId) return { responseCode: 'CALL_END_FAILED', message: 'Missing callId' };
      stompClient.publish('/app/webrtc.signal', { type: 'end', callId, payload: {} });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'call-heartbeat',
    execute: async (request) => {
      const callId = String(request.data.callId ?? '').trim();
      if (!callId) return { responseCode: 'CALL_HEARTBEAT_FAILED', message: 'Missing callId' };
      if (callHeartbeatTimer) window.clearInterval(callHeartbeatTimer);
      callHeartbeatTimer = window.setInterval(() => {
        stompClient.publish('/app/webrtc.signal', { type: 'heartbeat', callId, payload: {} });
      }, 5000);
      return ok();
    }
  }
];

async function flushQueuedSupportMessages(roomId: string, appStore: ReturnType<typeof useAppStore>): Promise<void> {
  const targetRoomId = String(roomId ?? '').trim();
  if (!targetRoomId) return;

  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
  const queued = Array.isArray(chat.pendingMessages) ? (chat.pendingMessages as unknown[]) : [];
  if (queued.length === 0) return;

  const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(messagesByRoomId[targetRoomId]) ? (messagesByRoomId[targetRoomId] as unknown[]) : [];

  const optimisticQueued = queued.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const body = String(entry.body ?? '').trim();
    const clientMessageId = String(entry.clientMessageId ?? crypto.randomUUID()).trim();
    return {
      roomId: targetRoomId,
      messageId: '',
      sequenceNumber: 0,
      senderId: 'me',
      body,
      clientMessageId,
      createdTimestamp: String(entry.createdTimestamp ?? new Date().toISOString()),
      status: 'pending'
    };
  });

  appStore.setData('hospital', 'Chat', {
    ...chat,
    pendingMessages: [],
    messagesByRoomId: { ...messagesByRoomId, [targetRoomId]: [...existing, ...optimisticQueued] }
  });

  for (const item of optimisticQueued) {
    try {
      stompClient.publish('/app/chat.send', {
        roomId: targetRoomId,
        body: item.body,
        clientMessageId: item.clientMessageId
      });
    } catch {
      await stompClient.connect();
      stompClient.publish('/app/chat.send', {
        roomId: targetRoomId,
        body: item.body,
        clientMessageId: item.clientMessageId
      });
    }
  }
}

function buildFriendlyDisplayName(userData: Record<string, unknown>, fallbackIdentity: string): string {
  const firstName = pickString(userData, ['FirstName', 'firstName']);
  const lastName = pickString(userData, ['LastName', 'lastName']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }
  const username = pickString(userData, ['Username', 'username']);
  if (username && !username.includes('@')) {
    return username;
  }
  const email = pickString(userData, ['Email', 'email']) || fallbackIdentity;
  const localPart = email.includes('@') ? email.split('@')[0] : email;
  const tokens = localPart
    .split(/[._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return 'User';
  return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
}

function pickString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}

async function loadMedicalDepartmentOptions(): Promise<Array<{ id: string; label: string; value: string }>> {
  try {
    const response = await apiClient.get(URLRegistry.paths.medicalDepartmentGet, {
      params: { page: 0, size: 100 }
    });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = (envelope.Data ?? envelope.data ?? []) as unknown;
    if (!Array.isArray(dataNode)) {
      return [];
    }
    return dataNode
      .map((item, idx) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const id = pickString(record, ['Id', 'id']) || `dept-${idx}`;
        const name = pickString(record, ['Name', 'name']);
        const code = pickString(record, ['Code', 'code']);
        const label = [name, code ? `(${code})` : ''].filter(Boolean).join(' ').trim();
        return {
          id,
          label: label || id,
          value: code || name || id
        };
      })
      .filter((option) => option.label.trim().length > 0);
  } catch {
    return [];
  }
}

async function ensureMedicalDepartmentOptionsLoaded(): Promise<void> {
  const existing = (useAppStore(pinia).getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
  const existingList = Array.isArray(existing.list) ? (existing.list as unknown[]) : [];
  if (existingList.length > 0) {
    return;
  }

  const cachedRaw = sessionStorage.getItem(MEDICAL_DEPARTMENT_CACHE_KEY);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as Array<{ id: string; label: string; value: string }>;
      if (Array.isArray(cached) && cached.length > 0) {
        useAppStore(pinia).setData('hospital', 'MedicalDepartments', { list: cached });
        return;
      }
    } catch {
      // Ignore invalid cache and fetch fresh values.
    }
  }

  const departmentOptions = await loadMedicalDepartmentOptions();
  useAppStore(pinia).setData('hospital', 'MedicalDepartments', { list: departmentOptions });
  sessionStorage.setItem(MEDICAL_DEPARTMENT_CACHE_KEY, JSON.stringify(departmentOptions));
}

async function loadDoctorOptionsByDepartment(
  department: string
): Promise<Array<{ id: string; label: string; value: string }>> {
  try {
    const response = await apiClient.get(URLRegistry.paths.doctorGet, {
      params: { department, page: 0, size: 100 }
    });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const dataNode = (envelope.Data ?? envelope.data ?? []) as unknown;
    if (!Array.isArray(dataNode)) {
      return [];
    }
    return dataNode
      .map((item, idx) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const id = pickString(record, ['Id', 'id']) || `doctor-${idx}`;
        const firstName = pickString(record, ['FirstName', 'firstName']);
        const lastName = pickString(record, ['LastName', 'lastName']);
        const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const name = pickString(record, ['Name', 'name']) || combinedName;
        const email = pickString(record, ['Email', 'email']);
        const label = [name, email ? `(${email})` : ''].filter(Boolean).join(' ').trim();
        return { id, label: label || id, value: id };
      })
      .filter((option) => option.label.trim().length > 0);
  } catch {
    throw new Error('Unable to load doctor options');
  }
}

function normalizeDepartmentKey(department: string): string {
  return String(department ?? '').trim().toLowerCase();
}

async function ensureDoctorOptionsLoadedByDepartment(
  department: string
): Promise<Array<{ id: string; label: string; value: string }>> {
  const normalizedKey = normalizeDepartmentKey(department);
  if (!normalizedKey) {
    return [];
  }
  const existingCatalog = (useAppStore(pinia).getData('hospital', 'AppointmentDoctorCatalog') ?? {}) as Record<
    string,
    unknown
  >;
  const byDepartment = ((existingCatalog.byDepartment as Record<string, unknown>) ?? {}) as Record<
    string,
    unknown
  >;
  const existingOptions = byDepartment[normalizedKey];
  if (Array.isArray(existingOptions) && existingOptions.length > 0) {
    return existingOptions as Array<{ id: string; label: string; value: string }>;
  }

  const cachedRaw = sessionStorage.getItem(APPOINTMENT_DOCTOR_CACHE_KEY);
  if (cachedRaw) {
    try {
      const cachedCatalog = JSON.parse(cachedRaw) as Record<string, Array<{ id: string; label: string; value: string }>>;
      const cachedOptions = cachedCatalog[normalizedKey];
      if (Array.isArray(cachedOptions) && cachedOptions.length > 0) {
        useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', {
          byDepartment: { ...byDepartment, [normalizedKey]: cachedOptions }
        });
        return cachedOptions;
      }
    } catch {
      // Ignore cache parse errors and fetch fresh values.
    }
  }

  const fetchedOptions = await loadDoctorOptionsByDepartment(department);
  const merged = { ...byDepartment, [normalizedKey]: fetchedOptions };
  useAppStore(pinia).setData('hospital', 'AppointmentDoctorCatalog', { byDepartment: merged });
  sessionStorage.setItem(APPOINTMENT_DOCTOR_CACHE_KEY, JSON.stringify(merged));
  return fetchedOptions;
}
