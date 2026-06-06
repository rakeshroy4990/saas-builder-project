import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormSelectField } from '@/components/FormSelectField';
import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { LoadingView } from '@/components/LoadingView';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import {
  createAppointment,
  fetchDateAvailability,
  fetchDoctorsByDepartment,
  fetchMedicalDepartments,
  fetchTimeSlotsForDate,
  getBookingErrorMessage,
  validateBookingForm
} from './bookingApi';
import {
  MAX_APPOINTMENT_PRESCRIPTION_FILES,
  MAX_BOOKING_AGE_YEARS,
  type AppointmentBookingForm,
  type DateAvailabilityRow,
  type PickedPrescriptionImage,
  type SelectOption
} from './bookingTypes';
import { pickAppointmentPrescriptionImages } from './pickAppointmentPrescriptions';

function emptyForm(): AppointmentBookingForm {
  return {
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    ageGroup: '',
    department: '',
    doctorId: '',
    preferredDate: '',
    preferredTimeSlot: '',
    additionalNotes: ''
  };
}

function prefillFromSession(base: AppointmentBookingForm): AppointmentBookingForm {
  const user = useSessionStore.getState().user;
  return {
    ...base,
    patientName: base.patientName || user?.displayName?.trim() || '',
    patientEmail: base.patientEmail || user?.email?.trim() || '',
    patientPhone: base.patientPhone || ''
  };
}

export function BookAppointmentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<AppointmentBookingForm>(() => prefillFromSession(emptyForm()));
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [doctors, setDoctors] = useState<SelectOption[]>([]);
  const [dateOptions, setDateOptions] = useState<SelectOption[]>([]);
  const [timeSlots, setTimeSlots] = useState<SelectOption[]>([]);
  const [slotCounts, setSlotCounts] = useState<DateAvailabilityRow[]>([]);
  const [prescriptionFiles, setPrescriptionFiles] = useState<PickedPrescriptionImage[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [doctorLoadError, setDoctorLoadError] = useState('');
  const [slotMessageKey, setSlotMessageKey] = useState('');
  const [formError, setFormError] = useState('');
  const [prescriptionError, setPrescriptionError] = useState('');

  const patchForm = useCallback((patch: Partial<AppointmentBookingForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const refreshDates = useCallback(async (doctorId: string) => {
    if (!doctorId.trim()) {
      setDateOptions([]);
      setSlotCounts([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const availability = await fetchDateAvailability(doctorId);
      setSlotCounts(availability.slotCounts);
      const options = availability.slotCounts
        .filter((row) => row.slotCount > 0)
        .map((row) => ({
          id: row.date,
          label: `${row.dateLabel} (${row.slotCount} slots)`,
          value: row.date
        }));
      setDateOptions(options);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const refreshTimeSlots = useCallback(async (doctorId: string, date: string) => {
    if (!doctorId.trim() || !date.trim()) {
      setTimeSlots([]);
      setSlotMessageKey('');
      return;
    }
    setSlotsLoading(true);
    setSlotMessageKey('');
    try {
      const result = await fetchTimeSlotsForDate(doctorId, date);
      setTimeSlots(result.slots);
      setSlotMessageKey(result.message);
      if (result.forbidden) {
        Alert.alert(t('appointment.book.title'), t('appointment.book.slotsForbiddenDoctor'));
      } else if (result.message === 'slotsLoadFailed') {
        Alert.alert(t('appointment.book.title'), t('appointment.book.slotsLoadFailed'));
      }
      setForm((prev) => {
        const current = prev.preferredTimeSlot;
        if (current && !result.slots.some((s) => s.value === current)) {
          return { ...prev, preferredTimeSlot: '' };
        }
        return prev;
      });
    } finally {
      setSlotsLoading(false);
    }
  }, [patchForm, t]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchMedicalDepartments();
        setDepartments(list);
      } catch {
        setFormError(t('appointment.book.departmentsLoadFailed'));
      } finally {
        setInitLoading(false);
      }
    })();
  }, [t]);

  const onDepartmentChange = useCallback(
    async (department: string) => {
      patchForm({
        department,
        doctorId: '',
        preferredDate: '',
        preferredTimeSlot: ''
      });
      setDoctors([]);
      setDateOptions([]);
      setTimeSlots([]);
      setSlotMessageKey('');
      setDoctorLoadError('');
      if (!department.trim()) return;

      setDoctorLoading(true);
      try {
        const list = await fetchDoctorsByDepartment(department);
        setDoctors(list);
        if (list.length === 0) {
          setDoctorLoadError(t('appointment.book.noDoctors'));
        }
      } catch {
        setDoctors([]);
        setDoctorLoadError(t('appointment.book.doctorLoadFailed'));
      } finally {
        setDoctorLoading(false);
      }
    },
    [patchForm, t]
  );

  const onDoctorChange = useCallback(
    async (doctorId: string) => {
      patchForm({ doctorId, preferredDate: '', preferredTimeSlot: '' });
      setTimeSlots([]);
      setSlotMessageKey('');
      await refreshDates(doctorId);
    },
    [patchForm, refreshDates]
  );

  const onDateChange = useCallback(
    async (preferredDate: string) => {
      patchForm({ preferredDate, preferredTimeSlot: '' });
      await refreshTimeSlots(form.doctorId, preferredDate);
    },
    [form.doctorId, patchForm, refreshTimeSlots]
  );

  const slotHint = useMemo(() => {
    if (!slotMessageKey) return '';
    if (slotMessageKey === 'slotNoneForDate') return t('appointment.book.slotNoneForDate');
    if (slotMessageKey === 'slotNoneFutureToday') return t('appointment.book.slotNoneFutureToday');
    return '';
  }, [slotMessageKey, t]);

  async function onAttachPrescriptions() {
    setPrescriptionError('');
    try {
      const picked = await pickAppointmentPrescriptionImages(
        prescriptionFiles.length,
        MAX_APPOINTMENT_PRESCRIPTION_FILES
      );
      if (picked.length === 0) return;
      setPrescriptionFiles((prev) => {
        const merged = [...prev, ...picked].slice(-MAX_APPOINTMENT_PRESCRIPTION_FILES);
        if (prev.length + picked.length > MAX_APPOINTMENT_PRESCRIPTION_FILES) {
          setPrescriptionError(t('appointment.book.prescriptionLimit'));
        }
        return merged;
      });
    } catch (err) {
      setPrescriptionError(err instanceof Error ? err.message : t('appointment.book.attachFailed'));
    }
  }

  async function onSubmit() {
    setFormError('');
    const missing = validateBookingForm(form);
    if (missing.length > 0) {
      setFormError(t('appointment.book.missingFields', { fields: missing.join(', ') }));
      return;
    }
    setSubmitting(true);
    try {
      await createAppointment(form, prescriptionFiles);
      Alert.alert(t('appointment.book.successTitle'), t('appointment.book.successMessage'), [
        {
          text: t('appointment.book.viewAppointments'),
          onPress: () => router.replace('/(app)/(tabs)/appointments' as never)
        }
      ]);
    } catch (err) {
      setFormError(getBookingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (initLoading) {
    return <LoadingView />;
  }

  return (
    <KeyboardSafeView style={sharedStyles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 48}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + 24
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <Text style={sharedStyles.title}>{t('appointment.book.title')}</Text>
          <Text style={[sharedStyles.subtitle, { marginBottom: 16 }]}>{t('appointment.book.subtitle')}</Text>

          <Text style={sharedStyles.label}>{t('appointment.book.patientName')}</Text>
          <TextInput
            style={sharedStyles.input}
            value={form.patientName}
            onChangeText={(patientName) => patchForm({ patientName })}
            placeholder={t('appointment.book.patientNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          <Text style={sharedStyles.label}>{t('appointment.book.email')}</Text>
          <TextInput
            style={sharedStyles.input}
            value={form.patientEmail}
            onChangeText={(patientEmail) => patchForm({ patientEmail })}
            placeholder={t('appointment.book.emailPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={sharedStyles.label}>{t('appointment.book.phone')}</Text>
          <TextInput
            style={sharedStyles.input}
            value={form.patientPhone}
            onChangeText={(patientPhone) => patchForm({ patientPhone })}
            placeholder={t('appointment.book.phonePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />

          <Text style={sharedStyles.label}>{t('appointment.book.age')}</Text>
          <TextInput
            style={sharedStyles.input}
            value={form.ageGroup}
            onChangeText={(raw) => {
              let digits = raw.replace(/\D/g, '');
              const n = parseInt(digits, 10);
              if (!Number.isNaN(n) && n > MAX_BOOKING_AGE_YEARS) {
                digits = String(MAX_BOOKING_AGE_YEARS);
              }
              patchForm({ ageGroup: digits });
            }}
            placeholder={t('appointment.book.agePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />

          <FormSelectField
            label={t('appointment.book.department')}
            placeholder={t('appointment.book.selectDepartment')}
            value={form.department}
            options={departments}
            onChange={(department) => void onDepartmentChange(department)}
          />

          <FormSelectField
            label={
              form.department.trim()
                ? t('appointment.book.doctor')
                : t('appointment.book.doctorNeedsDepartment')
            }
            placeholder={t('appointment.book.selectDoctor')}
            value={form.doctorId}
            options={doctors}
            onChange={(doctorId) => void onDoctorChange(doctorId)}
            disabled={!form.department.trim() || doctorLoading}
            error={doctorLoadError}
          />
          {doctorLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />
          ) : null}

          <FormSelectField
            label={t('appointment.book.preferredDate')}
            placeholder={t('appointment.book.selectDate')}
            value={form.preferredDate}
            options={dateOptions}
            onChange={(preferredDate) => void onDateChange(preferredDate)}
            disabled={!form.doctorId.trim() || slotsLoading}
          />

          <FormSelectField
            label={t('appointment.book.preferredTime')}
            placeholder={t('appointment.book.selectTime')}
            value={form.preferredTimeSlot}
            options={timeSlots}
            onChange={(preferredTimeSlot) => patchForm({ preferredTimeSlot })}
            disabled={!form.preferredDate.trim() || slotsLoading}
          />
          {slotsLoading ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 8 }} /> : null}
          {slotHint ? <Text style={[sharedStyles.subtitle, { marginBottom: 8 }]}>{slotHint}</Text> : null}
          {slotCounts.length > 0 && !form.preferredDate ? (
            <Text style={[sharedStyles.subtitle, { marginBottom: 12, fontSize: 12 }]}>
              {slotCounts.map((r) => `${r.dateLabel}: ${r.slotCount}`).join(' · ')}
            </Text>
          ) : null}

          <Text style={sharedStyles.label}>{t('appointment.book.notes')}</Text>
          <TextInput
            style={[sharedStyles.input, { minHeight: 88, textAlignVertical: 'top' }]}
            value={form.additionalNotes}
            onChangeText={(additionalNotes) => patchForm({ additionalNotes })}
            placeholder={t('appointment.book.notesPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={sharedStyles.label}>{t('appointment.book.priorDocs')}</Text>
          {prescriptionFiles.map((file) => (
            <View key={file.uri} style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Pressable
                onPress={() =>
                  setPrescriptionFiles((prev) => prev.filter((f) => f.uri !== file.uri))
                }
              >
                <Text style={styles.removeFile}>{t('appointment.book.removeFile')}</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            style={[sharedStyles.buttonSecondary, { marginBottom: 8 }]}
            onPress={() => void onAttachPrescriptions()}
            disabled={
              submitting || prescriptionFiles.length >= MAX_APPOINTMENT_PRESCRIPTION_FILES
            }
          >
            <Text style={sharedStyles.buttonSecondaryText}>{t('appointment.book.attachImages')}</Text>
          </Pressable>
          {prescriptionError ? <Text style={sharedStyles.errorText}>{prescriptionError}</Text> : null}

          {formError ? <Text style={sharedStyles.errorText}>{formError}</Text> : null}

          <Pressable
            style={[sharedStyles.button, { marginTop: 8, opacity: submitting ? 0.7 : 1 }]}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            <Text style={sharedStyles.buttonText}>
              {submitting ? t('appointment.book.submitting') : t('appointment.book.submit')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardSafeView>
  );
}

const styles = {
  fileRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
    marginBottom: 8,
    paddingVertical: 6
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: colors.text
  },
  removeFile: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary
  }
};
