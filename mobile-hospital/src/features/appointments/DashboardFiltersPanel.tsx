import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FormDateFilterField } from '@/components/FormDateFilterField';
import { FormSelectField } from '@/components/FormSelectField';
import {
  buildStatusFilterOptions,
  createDefaultDashboardFilters,
  DASHBOARD_STATUS_ALL,
  normalizeStatusFilterValue,
  type DashboardFiltersState
} from '@/features/appointments/dashboardFilters';
import type { SelectOption } from '@/features/appointments/bookingTypes';
import { colors } from '@/theme/colors';

type DashboardFiltersPanelProps = {
  role: string;
  filters: DashboardFiltersState;
  doctorOptions: SelectOption[];
  departmentOptions: SelectOption[];
  onChange: (next: DashboardFiltersState) => void;
};

export function DashboardFiltersPanel({
  role,
  filters,
  doctorOptions,
  departmentOptions,
  onChange
}: DashboardFiltersPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const statusOptions = buildStatusFilterOptions(role, t);
  const statusValue =
    filters.statusSelectedExplicitly || filters.status
      ? normalizeStatusFilterValue(filters.status || DASHBOARD_STATUS_ALL)
      : '';

  function patch(partial: Partial<DashboardFiltersState>) {
    onChange({ ...filters, ...partial });
  }

  function onClear() {
    onChange(createDefaultDashboardFilters(role));
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.toggle}
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.filters.toggleTitle')}
      >
        <Text style={styles.toggleText}>{t('dashboard.filters.heading')}</Text>
        <Text style={styles.toggleChevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <FormSelectField
            label={t('dashboard.filters.status')}
            placeholder={t('common.selectPlaceholder')}
            value={statusValue}
            options={statusOptions}
            onChange={(value) => {
              patch({
                status: normalizeStatusFilterValue(value),
                statusSelectedExplicitly: true
              });
            }}
          />

          <FormDateFilterField
            label={t('dashboard.filters.date')}
            placeholder={t('dashboard.filters.datePlaceholder')}
            value={filters.preferredDate}
            onChange={(preferredDate) => patch({ preferredDate })}
            clearLabel={t('dashboard.filters.clearDate')}
          />

          <FormSelectField
            label={t('dashboard.filters.doctor')}
            placeholder={t('dashboard.filters.doctorOptionAll')}
            value={filters.doctorId}
            options={doctorOptions}
            onChange={(doctorId) => patch({ doctorId })}
          />

          <FormSelectField
            label={t('dashboard.filters.department')}
            placeholder={t('common.selectPlaceholder')}
            value={filters.department}
            options={departmentOptions}
            onChange={(department) => patch({ department })}
          />

          <Pressable
            style={styles.clearBtn}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.filters.clearTitle')}
          >
            <Text style={styles.clearBtnText}>↺ {t('dashboard.filters.clearTitle')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text
  },
  toggleChevron: {
    fontSize: 14,
    color: colors.textMuted
  },
  panel: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  clearBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  }
});
