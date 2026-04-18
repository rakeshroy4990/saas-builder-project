import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { usePopupStore } from '../../../../store/usePopupStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { ok } from '../shared/response';
import { pickString } from '../shared/strings';
import { ensureMedicalDepartmentOptionsLoaded } from '../shared/medicalDepartments';
import { loadDashboardAppointmentsPage } from '../shared/dashboardAppointments';
import { receiptObjectUrls, clearReceiptObjectUrls } from '../shared/receiptObjectUrls';
import { ensureHospitalWebRtcInboundConnected } from '../shared/hospitalWebRtcInbound';
import { ensureDoctorOptionsLoadedByDepartment } from '../shared/doctorCatalog';
import { clearAppointmentPrescriptionFiles } from '../shared/appointmentPrescriptionFiles';
import { refreshAppointmentTimeSlotOptionsFromForm } from '../shared/refreshAppointmentTimeSlots';

function appointmentPreferredDateToInput(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

export const dashboardHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'init-dashboard',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const prevNav = (appStore.getData('hospital', 'DashboardNav') ?? {}) as { activeItem?: string };
      const keepWorkingSlots = String(prevNav.activeItem ?? '').trim() === 'working-slots';
      appStore.setData('hospital', 'DashboardNav', {
        activeItem: keepWorkingSlots ? 'working-slots' : 'appointments'
      });
      await ensureMedicalDepartmentOptionsLoaded();
      const departmentsNode = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
      const departmentList = Array.isArray(departmentsNode.list) ? (departmentsNode.list as unknown[]) : [];
      const doctorCatalog = (appStore.getData('hospital', 'AppointmentDoctorCatalog') ?? {}) as Record<
        string,
        unknown
      >;
      const byDepartment = ((doctorCatalog.byDepartment ?? {}) as Record<string, unknown>) ?? {};
      const doctorOptions = Object.values(byDepartment)
        .flatMap((entry) => (Array.isArray(entry) ? entry : []))
        .map((entry) => {
          const row = (entry ?? {}) as Record<string, unknown>;
          const value = String(row.value ?? row.id ?? '').trim();
          const label = String(row.label ?? row.name ?? value).trim();
          if (!value || !label) return null;
          return { id: value, value, label };
        })
        .filter((entry): entry is { id: string; value: string; label: string } => entry !== null);

      const uniqueDoctorMap = new Map<string, { id: string; value: string; label: string }>();
      for (const doctor of doctorOptions) {
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
        preferredDate: '',
        doctorId: '',
        department: '',
        statusOptions: [
          { id: 'all', value: '', label: 'All Statuses' },
          { id: 'scheduled', value: 'SCHEDULED', label: 'Scheduled' },
          { id: 'completed', value: 'COMPLETED', label: 'Completed' },
          { id: 'cancelled', value: 'CANCELLED', label: 'Cancelled' }
        ],
        doctorOptions: [{ id: 'all', value: '', label: 'All Doctors' }, ...uniqueDoctors],
        departmentOptions: [
          { id: 'all', value: '', label: 'All Departments' },
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
        pageLabel: 'Page 1 of 1',
        totalLabel: 'Total Appointments: 0'
      });
      await loadDashboardAppointmentsPage(0);
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      if (String(authSession.userId ?? '').trim()) {
        try {
          await ensureHospitalWebRtcInboundConnected();
        } catch {
          // Non-fatal: user can still use the app; video popup runs call-connect on open.
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
      appStore.setData('hospital', 'DashboardFilters', { ...filters, status: String(request.data.value ?? '').trim() });
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
      appStore.setData('hospital', 'DashboardFilters', {
        ...filters,
        status: '',
        preferredDate: '',
        doctorId: '',
        department: ''
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
        useToastStore(pinia).show('Appointment cancelled.', 'success');
        await loadDashboardAppointmentsPage();
        return ok();
      } catch (error) {
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
        toastStore.show('Video call is only available for appointments where you are the assigned doctor.', 'error');
        return { responseCode: 'APPOINTMENT_VIDEO_NOT_YOUR_APPOINTMENT', message: 'Wrong doctor' };
      }

      let inviteToUserId = '';

      if (doctorOrAdminCallsPatient) {
        if (!createdBy) {
          toastStore.show('This appointment has no patient account linked (CreatedBy). Cannot place the call.', 'error');
          return { responseCode: 'APPOINTMENT_VIDEO_NO_PATIENT', message: 'Missing createdBy' };
        }
        if (myUserId && createdBy === myUserId) {
          toastStore.show('You cannot call yourself.', 'info');
          return { responseCode: 'APPOINTMENT_VIDEO_SELF', message: 'Same user' };
        }
        inviteToUserId = createdBy;
      } else {
        if (!doctorId) {
          toastStore.show('This appointment has no doctor assigned for a video call.', 'error');
          return { responseCode: 'APPOINTMENT_VIDEO_NO_DOCTOR', message: 'Missing doctor' };
        }
        if (role === 'PATIENT' && createdBy && myUserId && createdBy !== myUserId) {
          toastStore.show('You can only start a video call for your own appointments.', 'error');
          return { responseCode: 'APPOINTMENT_VIDEO_NOT_OWNER', message: 'Not owner' };
        }
        if (myUserId && doctorId === myUserId) {
          toastStore.show('Sign in as the assigned doctor (or patient) to start this call.', 'info');
          return { responseCode: 'APPOINTMENT_VIDEO_SELF', message: 'Doctor id matches user' };
        }
        inviteToUserId = doctorId;
      }

      if (!inviteToUserId) {
        toastStore.show('Could not determine who to call for this appointment.', 'error');
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
        const departmentsNode = (appStore.getData('hospital', 'MedicalDepartments') ?? {}) as Record<string, unknown>;
        const departmentList = Array.isArray(departmentsNode.list) ? (departmentsNode.list as unknown[]) : [];
        appStore.setData('hospital', 'AppointmentDepartments', { list: departmentList });

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
            const doctors = await ensureDoctorOptionsLoadedByDepartment(department);
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
