import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { loadDashboardAppointmentsPage } from '../shared/dashboardAppointments';

function envelopeData(root: unknown): unknown {
  const row = (root ?? {}) as Record<string, unknown>;
  return row.Data ?? row.data ?? root;
}

export const adminDashboardHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-admin-dashboard',
    execute: async (_request) => {
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'AdminDashboard', { loading: true, error: '', pendingRequests: [], doctors: [] });
      const loadErrors: string[] = [];

      let pendingList: unknown[] = [];
      try {
        const pendingRes = await apiClient.get(URLRegistry.paths.adminRoleRequests, { params: { page: 0, size: 50 } });
        const pendingRaw = envelopeData(pendingRes.data);
        pendingList = Array.isArray(pendingRaw) ? pendingRaw : [];
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load pending role requests.'
          : 'Unable to load pending role requests.';
        loadErrors.push(message);
      }

      let doctorsList: unknown[] = [];
      try {
        const doctorsRes = await apiClient.get(URLRegistry.paths.adminDoctors, { params: { page: 0, size: 100 } });
        const doctorsRaw = envelopeData(doctorsRes.data);
        doctorsList = Array.isArray(doctorsRaw) ? doctorsRaw : [];
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load doctors.'
          : 'Unable to load doctors.';
        loadErrors.push(message);
      }

      const errorSummary = loadErrors.join(' ');
      appStore.setData('hospital', 'AdminDashboard', {
        loading: false,
        error: errorSummary,
        pendingRequests: pendingList.map((row, i) => {
          const r = (row ?? {}) as Record<string, unknown>;
          const uid = pickString(r, ['userId', 'UserId', 'id', 'Id']).trim() || `pr-${i}`;
          return {
            id: uid,
            userId: uid,
            email: pickString(r, ['email', 'Email', 'emailId', 'EmailId']),
            requestedRole: pickString(r, ['requestedRole', 'RequestedRole']),
            roleStatus: pickString(r, ['roleStatus', 'RoleStatus']),
            name: `${pickString(r, ['firstName', 'FirstName'])} ${pickString(r, ['lastName', 'LastName'])}`.trim()
          };
        }),
        doctors: doctorsList.map((row, i) => {
          const r = (row ?? {}) as Record<string, unknown>;
          return {
            id: pickString(r, ['Id', 'id']).trim() || `doc-${i}`,
            name: pickString(r, ['Name', 'name']),
            email: pickString(r, ['Email', 'email']),
            department: pickString(r, ['Department', 'department']),
            roleStatus: pickString(r, ['RoleStatus', 'roleStatus']),
            active: String(r.Active ?? r.active ?? 'true').toLowerCase() === 'true'
          };
        })
      });

      if (loadErrors.length === 2) {
        return { responseCode: 'ADMIN_DASH_INIT_FAILED', message: errorSummary };
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'approve-admin-role-request',
    execute: async (request) => {
      const userId = String(request.data.userId ?? '').trim();
      if (!userId) return { responseCode: 'ADMIN_APPROVE_FAILED', message: 'Missing user id' };
      try {
        await apiClient.post(`${URLRegistry.paths.adminRoleRequests}/${encodeURIComponent(userId)}/approve`);
        useToastStore(pinia).show('Request approved.', 'success');
        const svc = adminDashboardHospitalServices.find((s) => s.serviceId === 'init-admin-dashboard');
        if (svc) await svc.execute({ data: {} });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) || 'Approve failed.'
          : 'Approve failed.';
        return { responseCode: 'ADMIN_APPROVE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'deactivate-admin-doctor',
    execute: async (request) => {
      const userId = String(request.data.userId ?? '').trim();
      if (!userId) return { responseCode: 'ADMIN_DEACTIVATE_FAILED', message: 'Missing user id' };
      try {
        await apiClient.post(`${URLRegistry.paths.adminDoctors}/${encodeURIComponent(userId)}/deactivate`);
        useToastStore(pinia).show('Doctor account deactivated.', 'success');
        const svc = adminDashboardHospitalServices.find((s) => s.serviceId === 'init-admin-dashboard');
        if (svc) await svc.execute({ data: {} });
        await loadDashboardAppointmentsPage(0);
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Deactivate failed.'
          : 'Deactivate failed.';
        return { responseCode: 'ADMIN_DEACTIVATE_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'submit-admin-register-doctor',
    execute: async (_request) => {
      const appStore = useAppStore(pinia);
      const form = (appStore.getData('hospital', 'AdminDoctorRegisterForm') ?? {}) as Record<string, unknown>;
      const body = {
        emailId: String(form.emailId ?? '').trim(),
        password: String(form.password ?? ''),
        firstName: String(form.firstName ?? '').trim(),
        lastName: String(form.lastName ?? '').trim(),
        address: String(form.address ?? '').trim(),
        gender: String(form.gender ?? '').trim(),
        mobileNumber: String(form.mobileNumber ?? '').trim(),
        department: String(form.department ?? '').trim(),
        qualifications: String(form.qualifications ?? '').trim(),
        smcName: String(form.smcName ?? '').trim(),
        smcRegistrationNumber: String(form.smcRegistrationNumber ?? '').trim(),
        role: 'DOCTOR'
      };
      if (!body.emailId || !body.password) {
        useToastStore(pinia).show('Email and password are required.', 'error');
        return { responseCode: 'ADMIN_REGISTER_FAILED', message: 'Missing fields' };
      }
      try {
        await apiClient.post(URLRegistry.paths.adminDoctors, body);
        useToastStore(pinia).show('Doctor registered.', 'success');
        appStore.setData('hospital', 'AdminDoctorRegisterForm', {
          emailId: '',
          password: '',
          firstName: '',
          lastName: '',
          address: '',
          gender: '',
          mobileNumber: '',
          department: '',
          qualifications: '',
          smcName: '',
          smcRegistrationNumber: ''
        });
        const svc = adminDashboardHospitalServices.find((s) => s.serviceId === 'init-admin-dashboard');
        if (svc) await svc.execute({ data: {} });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Registration failed.'
          : 'Registration failed.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'ADMIN_REGISTER_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'admin-soft-delete-appointment',
    execute: async (request) => {
      const appointmentId = String(request.data.appointmentId ?? '').trim();
      if (!appointmentId) return { responseCode: 'ADMIN_SOFT_DELETE_FAILED', message: 'Missing id' };
      try {
        await apiClient.post(
          `${URLRegistry.paths.adminAppointments}/${encodeURIComponent(appointmentId)}/soft-delete`
        );
        useToastStore(pinia).show('Appointment removed from active lists.', 'success');
        await loadDashboardAppointmentsPage();
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) || 'Remove failed.'
          : 'Remove failed.';
        return { responseCode: 'ADMIN_SOFT_DELETE_FAILED', message };
      }
    }
  }
];
