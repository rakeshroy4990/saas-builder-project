import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native';

import { FormSelectField } from '@/components/FormSelectField';
import { LoadingView } from '@/components/LoadingView';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useSessionStore } from '@/auth/sessionStore';
import { colors } from '@/theme/colors';
import { TAB_SCROLL_BOTTOM_PADDING } from '@/theme/layout';
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
  const params = useLocalSearchParams<{ department?: string; doctorId?: string }>();
  const keyboardInset = useKeyboardInset();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const scrollBottomPadding =
    TAB_SCROLL_BOTTOM_PADDING + (Platform.OS === 'android' ? keyboardInset : 0);

  const ensureInputVisible = useCallback(
    (inputRef: React.RefObject<TextInput | null>) => {
      setTimeout(
        () => {
          inputRef.current?.measureInWindow((_x, y, _w, height) => {
            const windowHeight = Dimensions.get('window').height;
            const keyboardHeight =
              keyboardInset > 0 ? keyboardInset : Math.round(windowHeight * 0.35);
            const visibleBottom = windowHeight - keyboardHeight - 24;
            const fieldBottom = y + height;
            if (fieldBottom > visibleBottom) {
              scrollRef.current?.scrollTo({
                y: scrollOffsetRef.current + (fieldBottom - visibleBottom),
                animated: true
              });
            }
          });
        },
        Platform.OS === 'ios' ? 320 : 120
      );
    },
    [keyboardInset]
  );

  const patientNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);
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
        const initialDepartment = String(params.department ?? '').trim();
        const initialDoctorId = String(params.doctorId ?? '').trim();
        if (initialDepartment) {
          setDoctorLoading(true);
          try {
            const doctorList = await fetchDoctorsByDepartment(initialDepartment);
            setDoctors(doctorList);
            const nextDoctorId =
              initialDoctorId && doctorList.some((row) => row.value === initialDoctorId)
                ? initialDoctorId
                : '';
            patchForm({ department: initialDepartment, doctorId: nextDoctorId });
            if (nextDoctorId) {
              await refreshDates(nextDoctorId);
            } else if (doctorList.length === 0) {
              setDoctorLoadError(t('appointment.book.noDoctors'));
            }
          } catch {
            setDoctors([]);
            setDoctorLoadError(t('appointment.book.doctorLoadFailed'));
          } finally {
            setDoctorLoading(false);
          }
        }
      } catch {
        setFormError(t('appointment.book.departmentsLoadFailed'));
      } finally {
        setInitLoading(false);
      }
    })();
  }, [params.department, params.doctorId, patchForm, refreshDates, t]);

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
    <View style={sharedStyles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: scrollBottomPadding
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          nestedScrollEnabled
          showsVerticalScrollIndicator
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <Text style={sharedStyles.title}>{t('appointment.book.title')}</Text>
          <Text style={[sharedStyles.subtitle, { marginBottom: 16 }]}>{t('appointment.book.subtitle')}</Text>

          <Text style={sharedStyles.label}>{t('appointment.book.patientName')}</Text>
          <TextInput
            ref={patientNameRef}
            style={sharedStyles.input}
            value={form.patientName}
            onChangeText={(patientName) => patchForm({ patientName })}
            placeholder={t('appointment.book.patientNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            onFocus={() => ensureInputVisible(patientNameRef)}
          />

          <Text style={sharedStyles.label}>{t('appointment.book.email')}</Text>
          <TextInput
            ref={emailRef}
            style={sharedStyles.input}
            value={form.patientEmail}
            onChangeText={(patientEmail) => patchForm({ patientEmail })}
            placeholder={t('appointment.book.emailPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={() => ensureInputVisible(emailRef)}
          />

          <Text style={sharedStyles.label}>{t('appointment.book.phone')}</Text>
          <TextInput
            ref={phoneRef}
            style={sharedStyles.input}
            value={form.patientPhone}
            onChangeText={(patientPhone) => patchForm({ patientPhone })}
            placeholder={t('appointment.book.phonePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            onFocus={() => ensureInputVisible(phoneRef)}
          />

          <Text style={sharedStyles.label}>{t('appointment.book.age')}</Text>
          <TextInput
            ref={ageRef}
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
            onFocus={() => ensureInputVisible(ageRef)}
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
            ref={notesRef}
            style={[sharedStyles.input, { minHeight: 88, textAlignVertical: 'top' }]}
            value={form.additionalNotes}
            onChangeText={(additionalNotes) => patchForm({ additionalNotes })}
            placeholder={t('appointment.book.notesPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            onFocus={() => ensureInputVisible(notesRef)}
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
    </View>
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
