import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { ServiceRegistry } from '../../../../core/registry/ServiceRegistry';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { isAuthTokenExpired } from '../../../auth/authToken';
import { pingServerSession } from '../../../auth/serverSessionPing';
import { setDeferredPostLoginAction } from '../auth/postLoginAction';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { ensureMedicalDepartmentOptionsLoaded, syncAppointmentDepartmentsFromMedicalStore } from '../shared/medicalDepartments';
import { loadDashboardAppointmentsPage } from '../shared/dashboardAppointments';
import { receiptObjectUrls, clearReceiptObjectUrls } from '../shared/receiptObjectUrls';
import { ensureHospitalWebRtcInboundConnected } from '../shared/hospitalWebRtcInbound';
import { ensureHospitalAdminSupportInboxReady } from '../chat/chatServices';
import { ensureDoctorOptionsLoadedByDepartment } from '../shared/doctorCatalog';
import { clearAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import { refreshAppointmentTimeSlotOptionsFromForm } from '../shared/refreshAppointmentTimeSlots';
import { trackEvent } from '../../../analytics/firebaseAnalytics';
import { telemetryReasonCodes } from '../../../observability/telemetrySchema';
import { i18n } from '../../../../i18n';
import { router } from '../../../../router';

const tr = (key: string): string => String((i18n.global as any).t(key));

const PATIENT_DASHBOARD_TABS = new Set(['triage', 'growth', 'devices']);
const DOCTOR_DASHBOARD_TABS = new Set(['validate-prescription', 'recommended-dosage']);

function resolvePreservedDashboardTab(role: string, tab: string): string {
  const normalizedRole = String(role ?? '').trim().toUpperCase();
  const normalizedTab = String(tab ?? '').trim().toLowerCase();
  if (normalizedTab === 'admin' && normalizedRole === 'ADMIN') return 'admin';
  if (normalizedTab === 'working-slots' && (normalizedRole === 'ADMIN' || normalizedRole === 'DOCTOR')) {
    return 'working-slots';
  }
  if (DOCTOR_DASHBOARD_TABS.has(normalizedTab) && normalizedRole === 'DOCTOR') return normalizedTab;
  if (PATIENT_DASHBOARD_TABS.has(normalizedTab) && normalizedRole === 'PATIENT') return normalizedTab;
  if (normalizedTab === 'appointments') return 'appointments';
  return 'appointments';
}

function appointmentPreferredDateToInput(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

const DASHBOARD_GUARD_TABS = new Set([
  'appointments',
  'working-slots',
  'admin',
  'devices',
  'growth',
  'triage',
  'validate-prescription',
  'recommended-dosage'
]);

/** Mobile appointment filters use `dashboardFiltersOpen`; desktop grid ignores it (`lg:`). */
function collapseDashboardFiltersPanel(): void {
  const appStore = useAppStore(pinia);
  const responsive = (appStore.getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
  appStore.setData('hospital', 'ResponsiveUiState', { ...responsive, dashboardFiltersOpen: false });
}

function openLoginRecoverDashboardSession(tab: string): void {
  setDeferredPostLoginAction({
    packageName: 'hospital',
    actionId: 'resume-dashboard-nav-after-login',
    data: { tab }
  });
  const appStore = useAppStore(pinia);
  appStore.setProperty('hospital', 'AuthForm', 'identity', '');
  appStore.setProperty('hospital', 'AuthForm', 'password', '');
  appStore.setProperty('hospital', 'AuthForm', 'emailError', '');
  appStore.setProperty('hospital', 'AuthForm', 'authError', '');
  appStore.setProperty(
    'hospital',
    'AuthForm',
    'loginInfoMessage',
    'Your session has expired. Please sign in again to continue.'
  );
  usePopupStore(pinia).open({ packageName: 'hospital', pageId: 'login-popup', title: 'login' });
}

async function runHospitalService(serviceId: string, data: Record<string, unknown> = {}): Promise<void> {
  const svc = ServiceRegistry.getInstance().get('hospital', serviceId);
  if (!svc) {
    throw new Error(`Service not registered: hospital::${serviceId}`);
  }
  await svc.execute({ data });
}

async function loadActiveDoctorFilterOptions(userRole: string): Promise<Array<{ id: string; value: string; label: string }>> {
  if (String(userRole ?? '').trim().toUpperCase() !== 'ADMIN') {
    return [];
  }
  try {
    const response = await apiClient.get(URLRegistry.paths.doctorListActive, { params: { page: 0, size: 500 } });
    const envelope = (response.data ?? {}) as Record<string, unknown>;
    const raw = (envelope.Data ?? envelope.data ?? []) as unknown;
    const list = Array.isArray(raw) ? raw : [];
    return list
      .map((entry, index) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        const id = pickString(row, ['Id', 'id']).trim() || `doctor-${index}`;
        const firstName = pickString(row, ['FirstName', 'firstName']);
        const lastName = pickString(row, ['LastName', 'lastName']);
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const name = pickString(row, ['Name', 'name']).trim() || fullName || id;
        return { id, value: id, label: name };
      })
      .filter((entry): entry is { id: string; value: string; label: string } => entry !== null);
  } catch {
    return [];
  }
}

export const dashboardHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'open-dashboard-home',
    execute: async () => {
      const appStore = useAppStore(pinia);
      appStore.setData('hospital', 'DashboardNav', { activeItem: 'appointments', preserveOnInit: false });
      await runHospitalService('set-dashboard-header-active');
      const currentPath = String(router.currentRoute.value.path ?? '').trim();
      if (currentPath === '/dashboard') {
        await runHospitalService('init-dashboard');
        return ok();
      }
      await router.push('/dashboard');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'require-hospital-dashboard-session',
    responseCodes: { failure: ['DASHBOARD_SESSION_REQUIRED'] },
    execute: async (request) => {
      const tab = String(request.data.tab ?? '').trim().toLowerCase();
      if (!DASHBOARD_GUARD_TABS.has(tab)) {
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Invalid dashboard tab',
          suppressPopupInlineError: true
        };
      }
      const appStore = useAppStore(pinia);
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const userId = String(authSession.userId ?? '').trim();
      const role = String(authSession.role ?? '').trim().toUpperCase();
      if (!userId) {
        openLoginRecoverDashboardSession(tab);
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Sign in required',
          suppressPopupInlineError: true
        };
      }
      if (isAuthTokenExpired()) {
        openLoginRecoverDashboardSession(tab);
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Session expired',
          suppressPopupInlineError: true
        };
      }
      if ((tab === 'growth' || tab === 'devices') && role !== 'PATIENT') {
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Forbidden dashboard tab',
          suppressPopupInlineError: true
        };
      }
      if (tab === 'working-slots' && role !== 'DOCTOR' && role !== 'ADMIN') {
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Forbidden dashboard tab',
          suppressPopupInlineError: true
        };
      }
      if (tab === 'admin' && role !== 'ADMIN') {
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Forbidden dashboard tab',
          suppressPopupInlineError: true
        };
      }
      if ((tab === 'validate-prescription' || tab === 'recommended-dosage') && role !== 'DOCTOR') {
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Forbidden dashboard tab',
          suppressPopupInlineError: true
        };
      }
      const alive = await pingServerSession(userId);
      if (!alive) {
        openLoginRecoverDashboardSession(tab);
        return {
          responseCode: 'DASHBOARD_SESSION_REQUIRED',
          message: 'Session expired',
          suppressPopupInlineError: true
        };
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'resume-dashboard-nav-after-login',
    execute: async (request) => {
      const tab = String(request.data.tab ?? 'appointments').trim().toLowerCase();
      if (tab === 'admin') {
        await runHospitalService('set-dashboard-nav-admin', { preserveOnInit: true });
        await runHospitalService('init-admin-dashboard');
        await runHospitalService('set-dashboard-header-active');
        return ok();
      }
      if (tab === 'working-slots') {
        await runHospitalService('set-dashboard-nav-working-slots', { preserveOnInit: true });
        await runHospitalService('set-dashboard-header-active');
        await runHospitalService('init-doctor-working-slots');
        return ok();
      }
      if (tab === 'devices') {
        await runHospitalService('set-dashboard-nav-devices', { preserveOnInit: true });
        await runHospitalService('init-patient-device-readings');
        await runHospitalService('set-dashboard-header-active');
        return ok();
      }
      if (tab === 'growth') {
        await runHospitalService('set-dashboard-nav-growth', { preserveOnInit: true });
        await runHospitalService('init-growth-workspace');
        await runHospitalService('set-dashboard-header-active');
        return ok();
      }
      if (tab === 'triage') {
        await runHospitalService('set-dashboard-nav-triage', { preserveOnInit: true });
        await runHospitalService('init-triage-page');
        await runHospitalService('set-dashboard-header-active');
        return ok();
      }
      await runHospitalService('set-dashboard-nav-appointments');
      await runHospitalService('init-dashboard');
      await runHospitalService('set-dashboard-header-active');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'init-dashboard',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(authSession.role ?? '').trim().toUpperCase();
      const prevNav = (appStore.getData('hospital', 'DashboardNav') ?? {}) as {
        activeItem?: string;
        preserveOnInit?: boolean;
      };
      const preserveOnInit = prevNav.preserveOnInit === true;
      const activeItem = preserveOnInit
        ? resolvePreservedDashboardTab(role, String(prevNav.activeItem ?? ''))
        : 'appointments';
      appStore.setData('hospital', 'DashboardNav', { activeItem, preserveOnInit: false });
      await ensureMedicalDepartmentOptionsLoaded();
      const departmentsNode = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
      const departmentList = Array.isArray(departmentsNode.list) ? (departmentsNode.list as unknown[]) : [];
      const activeDoctorOptions = await loadActiveDoctorFilterOptions(role);
      const uniqueDoctorMap = new Map<string, { id: string; value: string; label: string }>();
      for (const doctor of activeDoctorOptions) {
        if (!uniqueDoctorMap.has(doctor.value)) {
          uniqueDoctorMap.set(doctor.value, doctor);
        }
      }
      const uniqueDoctors = [...uniqueDoctorMap.values()];

      appStore.setData('hospital', 'DashboardUiState', { menuCollapsed: false });
      const responsive = (appStore.getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'ResponsiveUiState', { ...responsive, dashboardFiltersOpen: false });
      appStore.setData('hospital', 'DashboardFilters', {
        status: '',
        statusSelectedExplicitly: false,
        preferredDate: '',
        doctorId: '',
        department: '',
        adminFullListing: role === 'ADMIN',
        statusOptions: [
          {
            id: 'allAppointments',
            value: 'All Appointments',
            label: tr('dashboard.filters.statusOptionAll'),
            labelI18nKey: 'dashboard.filters.statusOptionAll'
          },
          {
            id: 'completed',
            value: 'COMPLETED',
            label: tr('dashboard.filters.statusOptionCompleted'),
            labelI18nKey: 'dashboard.filters.statusOptionCompleted'
          },
          {
            id: 'cancelled',
            value: 'CANCELLED',
            label: tr('dashboard.filters.statusOptionCancelled'),
            labelI18nKey: 'dashboard.filters.statusOptionCancelled'
          },
          ...(role === 'ADMIN'
            ? ([{
                id: 'deleted',
                value: 'DELETED',
                label: tr('dashboard.filters.statusOptionRemovedAdmin'),
                labelI18nKey: 'dashboard.filters.statusOptionRemovedAdmin'
              }] as Array<{
                id: string;
                value: string;
                label: string;
                labelI18nKey?: string;
              }>)
            : [])
        ],
        doctorOptions: [...uniqueDoctors],
        departmentOptions: [
          ...departmentList.map((option, index) => {
            const row = (option ?? {}) as Record<string, unknown>;
            const value = String(row.value ?? row.id ?? '').trim();
            const label = String(row.label ?? row.name ?? value).trim();
            return {
              id: value || `dept-${index}`,
              value,
              label: label || value || `Department ${index + 1}`
            };
          })
        ]
      });

      appStore.setData('hospital', 'DashboardAppointments', {
        list: [],
        page: 0,
        size: 10,
        totalPages: 1,
        totalElements: 0,
        hasNext: false,
        pageLabel: String((i18n.global as { t: (k: string, p?: Record<string, unknown>) => string }).t('dashboard.appointments.pageLabelOf', { page: 1, total: 1 })),
        totalLabel: String((i18n.global as { t: (k: string, p?: Record<string, unknown>) => string }).t('dashboard.appointments.totalLabel', { count: 0 }))
      });
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
      await loadDashboardAppointmentsPage(0);
      if (String(authSession.userId ?? '').trim()) {
        try {
          await ensureHospitalWebRtcInboundConnected();
        } catch {
          // Non-fatal: user can still use the app; video popup runs call-connect on open.
        }
        if (String(authSession.role ?? '').trim().toUpperCase() === 'ADMIN') {
          try {
            await ensureHospitalAdminSupportInboxReady();
          } catch {
            // Non-fatal: FAB badge still updates after opening chat.
          }
        }
      }
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'toggle-dashboard-menu',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const state = (appStore.getData('hospital', 'DashboardUiState') ?? {}) as Record<string, unknown>;
      const menuCollapsed = Boolean(state.menuCollapsed);
      appStore.setData('hospital', 'DashboardUiState', { ...state, menuCollapsed: !menuCollapsed });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-filter-status',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
      const rawValue = String(request.data.value ?? '').trim().toUpperCase();
      const normalizedStatus =
        rawValue === '__ALL__'
        || rawValue === 'ALL'
        || rawValue === 'ALL APPOINTMENTS'
        || rawValue === 'ALL_APPOINTMENTS'
        || !rawValue
          ? '__ALL__'
          : rawValue;
      appStore.setData('hospital', 'DashboardFilters', {
        ...filters,
        status: normalizedStatus,
        statusSelectedExplicitly: true
      });
      collapseDashboardFiltersPanel();
      await loadDashboardAppointmentsPage(0);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-filter-date',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'DashboardFilters', {
        ...filters,
        preferredDate: String(request.data.value ?? '').trim()
      });
      collapseDashboardFiltersPanel();
      await loadDashboardAppointmentsPage(0);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-filter-doctor',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'DashboardFilters', { ...filters, doctorId: String(request.data.value ?? '').trim() });
      collapseDashboardFiltersPanel();
      await loadDashboardAppointmentsPage(0);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'set-dashboard-filter-department',
    execute: async (request) => {
      const appStore = useAppStore(pinia);
      const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'DashboardFilters', {
        ...filters,
        department: String(request.data.value ?? '').trim()
      });
      collapseDashboardFiltersPanel();
      await loadDashboardAppointmentsPage(0);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'apply-dashboard-filters',
    execute: async () => {
      const responsive = (useAppStore(pinia).getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
      useAppStore(pinia).setData('hospital', 'ResponsiveUiState', { ...responsive, dashboardFiltersOpen: false });
      await loadDashboardAppointmentsPage(0);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'clear-dashboard-filters',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const responsive = (appStore.getData('hospital', 'ResponsiveUiState') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'ResponsiveUiState', { ...responsive, dashboardFiltersOpen: false });
      const filters = (appStore.getData('hospital', 'DashboardFilters') ?? {}) as Record<string, unknown>;
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const role = String(authSession.role ?? '').trim().toUpperCase();
      appStore.setData('hospital', 'DashboardFilters', {
        ...filters,
        status: '',
        statusSelectedExplicitly: false,
        preferredDate: '',
        doctorId: '',
        department: '',
        adminFullListing: role === 'ADMIN'
      });
      await loadDashboardAppointmentsPage(0);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'dashboard-prev-page',
    execute: async () => {
      const current = (useAppStore(pinia).getData('hospital', 'DashboardAppointments') ?? {}) as Record<
        string,
        unknown
      >;
      const page = Number(current.page ?? 0);
      await loadDashboardAppointmentsPage(Math.max(0, page - 1));
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'dashboard-next-page',
    execute: async () => {
      const current = (useAppStore(pinia).getData('hospital', 'DashboardAppointments') ?? {}) as Record<
        string,
        unknown
      >;
      const page = Number(current.page ?? 0);
      const totalPages = Math.max(1, Number(current.totalPages ?? 1));
      await loadDashboardAppointmentsPage(Math.min(totalPages - 1, page + 1));
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'dashboard-go-page',
    execute: async (request) => {
      const page = Math.max(0, Number(request.data.page ?? 0));
      await loadDashboardAppointmentsPage(page);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'cancel-dashboard-appointment',
    execute: async (request) => {
      const appointmentId = String(request.data.appointmentId ?? '').trim();
      if (!appointmentId) return { responseCode: 'APPOINTMENT_CANCEL_FAILED', message: 'Missing appointment id' };
      try {
        await apiClient.post(`${URLRegistry.paths.appointmentCancel}/${encodeURIComponent(appointmentId)}`);
        trackEvent('appointment_cancelled', {
          appointmentId,
          domain: 'appointment',
          status: 'success',
          reason_code: telemetryReasonCodes.appointment.cancelSuccess,
          trace_id: getOrCreateTraceId()
        });
        useToastStore(pinia).show('Appointment cancelled.', 'success');
        await loadDashboardAppointmentsPage();
        return ok();
      } catch (error) {
        trackEvent('appointment_cancel_failed', {
          appointmentId,
          domain: 'appointment',
          status: 'fail',
          reason_code: telemetryReasonCodes.appointment.cancelFailed,
          http_status: isAxiosError(error) ? error.response?.status : undefined,
          trace_id: getOrCreateTraceId()
        });
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to cancel appointment right now.'
          : 'Unable to cancel appointment right now.';
        return { responseCode: 'APPOINTMENT_CANCEL_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-appointment-video-call',
    execute: async (request) => {
      const gate = await runHospitalService('triage-check-before-video-call', (request.data ?? {}) as Record<string, unknown>);
      if ((gate as { blocked?: boolean })?.blocked) {
        return gate;
      }
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const doctorId = String(request.data?.doctorId ?? request.data?.DoctorId ?? '').trim();
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      const createdBy = String(request.data?.createdBy ?? request.data?.CreatedBy ?? '').trim();

      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const myUserId = String(authSession.userId ?? '').trim();
      const role = String(authSession.role ?? '').trim().toUpperCase();

      const isAssignedDoctor = Boolean(myUserId && doctorId && myUserId === doctorId);
      const doctorOrAdminCallsPatient = role === 'ADMIN' || isAssignedDoctor;

      if (role === 'DOCTOR' && !isAssignedDoctor) {
        toastStore.show(tr('toast.videoCallDoctorOnly'), 'error');
        return { responseCode: 'APPOINTMENT_VIDEO_NOT_YOUR_APPOINTMENT', message: 'Wrong doctor' };
      }

      let inviteToUserId = '';

      if (doctorOrAdminCallsPatient) {
        if (!createdBy) {
          toastStore.show(tr('toast.videoCallNoPatientAccount'), 'error');
          return { responseCode: 'APPOINTMENT_VIDEO_NO_PATIENT', message: 'Missing createdBy' };
        }
        if (myUserId && createdBy === myUserId) {
          toastStore.show(tr('toast.videoCallCannotCallSelf'), 'info');
          return { responseCode: 'APPOINTMENT_VIDEO_SELF', message: 'Same user' };
        }
        inviteToUserId = createdBy;
      } else {
        if (!doctorId) {
          toastStore.show(tr('toast.videoCallNoDoctor'), 'error');
          return { responseCode: 'APPOINTMENT_VIDEO_NO_DOCTOR', message: 'Missing doctor' };
        }
        if (role === 'PATIENT' && createdBy && myUserId && createdBy !== myUserId) {
          toastStore.show(tr('toast.videoCallOwnAppointmentsOnly'), 'error');
          return { responseCode: 'APPOINTMENT_VIDEO_NOT_OWNER', message: 'Not owner' };
        }
        if (myUserId && doctorId === myUserId) {
          toastStore.show(tr('toast.videoCallSignInAsParticipant'), 'info');
          return { responseCode: 'APPOINTMENT_VIDEO_SELF', message: 'Doctor id matches user' };
        }
        inviteToUserId = doctorId;
      }

      if (!inviteToUserId) {
        toastStore.show(tr('toast.videoCallTargetUnknown'), 'error');
        return { responseCode: 'APPOINTMENT_VIDEO_NO_TARGET', message: 'No callee' };
      }

      const patientNameDisplay = String(request.data?.patientName ?? request.data?.PatientName ?? '').trim();
      const doctorNameDisplay = String(request.data?.doctorName ?? request.data?.DoctorName ?? '').trim();
      const departmentDisplay = String(request.data?.department ?? request.data?.Department ?? '').trim();

      let remotePartyName: string;
      if (doctorOrAdminCallsPatient) {
        remotePartyName = patientNameDisplay || 'Patient';
      } else {
        const docNorm = doctorNameDisplay.toLowerCase();
        const patNorm = patientNameDisplay.toLowerCase();
        const myLabels = [
          String(authSession.fullName ?? '').trim(),
          String(authSession.userDisplayName ?? '').trim(),
          String(authSession.email ?? '').trim()
        ].filter(Boolean);
        const myLabelNorms = myLabels.map((s) => s.toLowerCase());
        const docMatchesCaller = Boolean(
          docNorm &&
            myLabelNorms.some(
              (n) =>
                n === docNorm ||
                (n.includes('@') && docNorm === n.split('@')[0]) ||
                (docNorm.includes('@') && n === docNorm.split('@')[0])
            )
        );
        // API row can mis-label doctor as patient or as the signed-in user; never show that as "Call with".
        const doctorLooksWrong =
          !doctorNameDisplay ||
          (Boolean(patNorm) && docNorm === patNorm) ||
          docMatchesCaller;
        remotePartyName = doctorLooksWrong
          ? departmentDisplay
            ? `Doctor (${departmentDisplay})`
            : 'Doctor'
          : doctorNameDisplay;
      }

      const existing = (appStore.getData('hospital', 'VideoCall') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'VideoCall', {
        ...existing,
        inviteToUserId,
        inviteAppointmentId: appointmentId,
        remotePartyName,
        lastSignalType: '',
        callId: '',
        fromUserId: '',
        toUserId: '',
        payload: {},
        webrtcRemoteDescription: undefined,
        webrtcIceInbound: [],
        videoSession: undefined,
        videoSessionPeerUserId: '',
        webrtcCalleeAccepted: false,
        /** When true, video popup `initializeActions` may send the STOMP invite (outgoing call only). */
        videoCallOutgoingInvite: true
      });

      usePopupStore(pinia).open({
        packageName: 'hospital',
        pageId: 'video-call-popup',
        title: 'Video Call',
        initKey: `${Date.now()}-${inviteToUserId}`
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'open-appointment-receipt',
    execute: async (request) => {
      const appointmentId = String(request.data.appointmentId ?? '').trim();
      if (!appointmentId) {
        return { responseCode: 'APPOINTMENT_RECEIPT_FAILED', message: 'Receipt is not available.' };
      }
      try {
        clearReceiptObjectUrls();

        const appointmentResponse = await apiClient.get(`${URLRegistry.paths.appointmentGet}/${appointmentId}`);
        const appointmentNode = (appointmentResponse.data?.Data ?? appointmentResponse.data?.data ?? {}) as Record<
          string,
          unknown
        >;
        const filesNode = (appointmentNode.PrescriptionFiles ?? appointmentNode.prescriptionFiles ?? []) as unknown;
        const files = Array.isArray(filesNode) ? filesNode : [];
        if (files.length === 0) {
          return { responseCode: 'APPOINTMENT_RECEIPT_FAILED', message: 'Receipt is not available.' };
        }

        const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
        const role = String(authSession.role ?? '').trim().toUpperCase();
        const isPatient = role === 'PATIENT';

        const receiptItems = await Promise.all(
          files.map(async (entry, index) => {
            const row = (entry ?? {}) as Record<string, unknown>;
            const fileId = pickString(row, ['FileId', 'fileId', 'Id', 'id']);
            if (!fileId) return null;
            const fileName = pickString(row, ['FileName', 'fileName']) || `Receipt ${index + 1}`;
            const contentType = pickString(row, ['ContentType', 'contentType']);
            const fileResponse = await apiClient.get(`/api/appointment/file/${appointmentId}/${fileId}`, {
              responseType: 'blob'
            });
            const blob = fileResponse.data as Blob;
            const blobUrl = URL.createObjectURL(blob);
            receiptObjectUrls.push(blobUrl);
            return {
              id: `${appointmentId}-${fileId}`,
              appointmentId,
              fileId,
              fileName,
              src: blobUrl,
              contentType,
              downloadActionIcon: '⬇️',
              deleteActionIcon: isPatient ? '🗑️' : ''
            };
          })
        );

        const normalizedItems = receiptItems.filter(
          (item): item is {
            id: string;
            appointmentId: string;
            fileId: string;
            fileName: string;
            src: string;
            contentType: string;
            downloadActionIcon: string;
            deleteActionIcon: string;
          } => item !== null
        );
        useAppStore(pinia).setData('hospital', 'DashboardReceiptViewer', {
          appointmentId,
          items: normalizedItems
        });
        usePopupStore(pinia).open({
          packageName: 'hospital',
          pageId: 'appointment-receipts-popup',
          title: 'Receipts'
        });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to open receipt.'
          : 'Unable to open receipt.';
        return { responseCode: 'APPOINTMENT_RECEIPT_FAILED', message };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'close-appointment-receipt-viewer',
    execute: async () => {
      clearReceiptObjectUrls();
      usePopupStore(pinia).close();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'download-appointment-receipt',
    execute: async (request) => {
      const src = String(request.data.src ?? '').trim();
      if (!src) {
        return { responseCode: 'APPOINTMENT_RECEIPT_DOWNLOAD_FAILED', message: 'Receipt is not available.' };
      }
      const fileName = String(request.data.fileName ?? 'receipt').trim() || 'receipt';
      const anchor = document.createElement('a');
      anchor.href = src;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'delete-appointment-receipt-item',
    execute: async (request) => {
      const receiptId = String(request.data.receiptId ?? '').trim();
      if (!receiptId) return { responseCode: 'APPOINTMENT_RECEIPT_DELETE_FAILED', message: 'Missing receipt id.' };
      const appStore = useAppStore(pinia);
      const viewer = (appStore.getData('hospital', 'DashboardReceiptViewer') ?? {}) as Record<string, unknown>;
      const items = Array.isArray(viewer.items) ? (viewer.items as unknown[]) : [];
      const remaining = items.filter((entry) => {
        const row = (entry ?? {}) as Record<string, unknown>;
        return String(row.id ?? '').trim() !== receiptId;
      });
      appStore.setData('hospital', 'DashboardReceiptViewer', { ...viewer, items: remaining });
      useToastStore(pinia).show('Receipt removed from current view.', 'info');
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'edit-dashboard-appointment',
    execute: async (request) => {
      const appointmentId = String(request.data?.appointmentId ?? '').trim();
      if (!appointmentId) {
        useToastStore(pinia).show('Missing appointment id.', 'error');
        return { responseCode: 'EDIT_APPOINTMENT_FAILED', message: 'Missing appointment id' };
      }
      const authSession = (useAppStore(pinia).getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const userId = String(authSession.userId ?? '').trim();
      if (!userId) {
        useToastStore(pinia).show('Please sign in to edit appointments.', 'error');
        return { responseCode: 'EDIT_APPOINTMENT_FAILED', message: 'Not signed in' };
      }
      const appStore = useAppStore(pinia);
      try {
        await ensureMedicalDepartmentOptionsLoaded();
        syncAppointmentDepartmentsFromMedicalStore();

        const response = await apiClient.get(`${URLRegistry.paths.appointmentGet}/${encodeURIComponent(appointmentId)}`);
        const dataNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;

        const createdBy = pickString(dataNode, ['CreatedBy', 'createdBy']).trim();
        const patientEmail = pickString(dataNode, ['Email', 'email']).trim().toLowerCase();
        const sessionEmail = String(authSession.email ?? '').trim().toLowerCase();
        const appointmentStatus = pickString(dataNode, ['Status', 'status']).trim().toUpperCase();
        if (appointmentStatus === 'CANCELLED') {
          useToastStore(pinia).show('This appointment is cancelled and cannot be edited.', 'error');
          return { responseCode: 'EDIT_APPOINTMENT_FAILED', message: 'Cancelled appointment' };
        }
        const isCreator =
          (createdBy && userId.toLowerCase() === createdBy.toLowerCase()) ||
          (!createdBy && patientEmail && sessionEmail && patientEmail === sessionEmail);
        if (!isCreator) {
          useToastStore(pinia).show('Only the user who created this appointment can edit it.', 'error');
          return { responseCode: 'EDIT_APPOINTMENT_FAILED', message: 'Not the creator' };
        }

        const patientName = pickString(dataNode, ['PatientName', 'patientName']);
        const email = pickString(dataNode, ['Email', 'email']);
        const phone = pickString(dataNode, ['PhoneNumber', 'phoneNumber']);
        const department = pickString(dataNode, ['Department', 'department']);
        const doctorId = pickString(dataNode, ['DoctorId', 'doctorId']);
        const ageGroup = pickString(dataNode, ['AgeGroup', 'ageGroup']);
        const preferredDate = appointmentPreferredDateToInput(
          dataNode.PreferredDate ?? dataNode.preferredDate ?? ''
        );
        const preferredTimeSlot = pickString(dataNode, ['PreferredTimeSlot', 'preferredTimeSlot']);
        const additionalNotes = pickString(dataNode, ['AdditionalNotes', 'additionalNotes']);

        clearAppointmentPrescriptionFiles();
        appStore.setProperty('hospital', 'AppointmentForm', 'editingAppointmentId', appointmentId);
        appStore.setProperty('hospital', 'AppointmentForm', 'patientName', patientName);
        appStore.setProperty('hospital', 'AppointmentForm', 'patientEmail', email);
        appStore.setProperty('hospital', 'AppointmentForm', 'patientPhone', phone);
        appStore.setProperty('hospital', 'AppointmentForm', 'department', department);
        appStore.setProperty('hospital', 'AppointmentForm', 'doctorLoadError', '');
        appStore.setProperty('hospital', 'AppointmentForm', 'ageGroup', ageGroup);
        appStore.setProperty('hospital', 'AppointmentForm', 'preferredDate', preferredDate);
        appStore.setProperty('hospital', 'AppointmentForm', 'preferredTimeSlot', preferredTimeSlot);
        appStore.setProperty('hospital', 'AppointmentForm', 'additionalNotes', additionalNotes);
        appStore.setProperty('hospital', 'AppointmentForm', 'prescriptionFileNames', []);
        appStore.setProperty('hospital', 'AppointmentForm', 'prescriptionUploadError', '');

        if (department) {
          try {
            const doctors = await ensureDoctorOptionsLoadedByDepartment(department, { force: true });
            appStore.setData('hospital', 'AppointmentDoctors', { list: doctors });
          } catch {
            appStore.setData('hospital', 'AppointmentDoctors', { list: [] });
          }
        } else {
          appStore.setData('hospital', 'AppointmentDoctors', { list: [] });
        }
        appStore.setProperty('hospital', 'AppointmentForm', 'doctor', doctorId);

        await refreshAppointmentTimeSlotOptionsFromForm();

        usePopupStore(pinia).open({
          packageName: 'hospital',
          pageId: 'book-appointment-popup',
          title: 'Edit appointment',
          initKey: `edit-appointment-${appointmentId}-${Date.now()}`
        });
        return ok();
      } catch (error) {
        const message = isAxiosError(error)
          ? pickString((error.response?.data ?? {}) as Record<string, unknown>, ['Message', 'message']) ||
            'Unable to load appointment.'
          : 'Unable to load appointment.';
        useToastStore(pinia).show(message, 'error');
        return { responseCode: 'EDIT_APPOINTMENT_FAILED', message };
      }
    }
  }
];
