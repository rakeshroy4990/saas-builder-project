import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import { LoadingView } from '@/components/LoadingView';
import { useSessionStore } from '@/auth/sessionStore';
import { fetchAppointmentsPage } from '@/features/appointments/api';
import { DashboardFiltersPanel } from '@/features/appointments/DashboardFiltersPanel';
import {
  fetchActiveDoctorFilterOptions,
  fetchDashboardDepartmentOptions
} from '@/features/appointments/dashboardFilterApi';
import {
  createDefaultDashboardFilters,
  filterDashboardAppointments,
  mergeDoctorFilterOptions,
  sortAppointmentsByDateDesc,
  type DashboardFiltersState
} from '@/features/appointments/dashboardFilters';
import type { SelectOption } from '@/features/appointments/bookingTypes';
import type { AppointmentSummary } from '@/features/appointments/types';
import { sharedStyles } from '@/theme/styles';

export default function AppointmentsDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const [rawItems, setRawItems] = useState<AppointmentSummary[]>([]);
  const [filters, setFilters] = useState<DashboardFiltersState>(() => createDefaultDashboardFilters(role));
  const [doctorOptions, setDoctorOptions] = useState<SelectOption[]>([
    { id: 'all', label: t('dashboard.filters.doctorOptionAll'), value: '' }
  ]);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const items = useMemo(
    () => filterDashboardAppointments(sortAppointmentsByDateDesc(rawItems), filters),
    [rawItems, filters]
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, departments, activeDoctors] = await Promise.all([
        fetchAppointmentsPage(0, 20),
        fetchDashboardDepartmentOptions(),
        role === 'ADMIN' ? fetchActiveDoctorFilterOptions() : Promise.resolve([])
      ]);
      const sorted = sortAppointmentsByDateDesc(list);
      setRawItems(sorted);
      setDepartmentOptions(departments);
      setDoctorOptions((prev) =>
        mergeDoctorFilterOptions(
          role === 'ADMIN' ? activeDoctors : prev.filter((option) => option.value),
          sorted,
          t('dashboard.filters.doctorOptionAll')
        )
      );
    } catch {
      setError(t('dashboard.loadError'));
    }
  }, [role, t]);

  useEffect(() => {
    setFilters(createDefaultDashboardFilters(role));
  }, [role]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  return (
    <AuthGate>
      {loading ? (
        <LoadingView />
      ) : (
        <View style={sharedStyles.screenPadded}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void (async () => {
                    setRefreshing(true);
                    await load();
                    setRefreshing(false);
                  })();
                }}
              />
            }
            ListHeaderComponent={
              <View>
                <Pressable
                  style={[sharedStyles.button, { marginBottom: 12 }]}
                  onPress={() => router.push('/(app)/(tabs)/appointments/book' as never)}
                >
                  <Text style={sharedStyles.buttonText}>{t('appointment.book.cta')}</Text>
                </Pressable>

                <DashboardFiltersPanel
                  role={role}
                  filters={filters}
                  doctorOptions={doctorOptions}
                  departmentOptions={departmentOptions}
                  onChange={setFilters}
                />

                {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}
              </View>
            }
            ListEmptyComponent={
              <Text style={sharedStyles.subtitle}>
                {error ? '' : t('dashboard.emptyFilteredAppointments')}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[sharedStyles.card, { marginBottom: 10 }]}
                onPress={() => router.push(`/(app)/(tabs)/appointments/${item.id}`)}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>{item.patientName}</Text>
                <Text style={sharedStyles.subtitle}>
                  {item.preferredDate} · {item.preferredTimeSlot || '—'}
                </Text>
                <Text style={sharedStyles.subtitle}>
                  {item.doctorName} · {item.status}
                </Text>
                {item.department ? (
                  <Text style={sharedStyles.subtitle}>{item.department}</Text>
                ) : null}
              </Pressable>
            )}
          />
        </View>
      )}
    </AuthGate>
  );
}
