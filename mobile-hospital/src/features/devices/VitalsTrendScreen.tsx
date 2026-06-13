import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, View } from 'react-native';

import { listDeviceReadingsMobile, type DeviceReadingRow } from '@/features/devices/deviceReadingApi';
import { sharedStyles } from '@/theme/styles';

function formatMeasurement(row: DeviceReadingRow): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(row.measurements)) {
    if (value == null || value === '') continue;
    parts.push(`${key}: ${value}`);
  }
  return parts.join(' · ') || row.deviceType;
}

export function VitalsTrendScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ childId?: string }>();
  const childId = String(params.childId ?? '').trim();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DeviceReadingRow[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const list = await listDeviceReadingsMobile(childId || undefined);
        setRows(list);
      } catch {
        Alert.alert(t('vitals.title', 'Vitals trend'), t('vitals.loadFailed', 'Could not load device readings.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [childId]);

  return (
    <ScrollView contentContainerStyle={[sharedStyles.screenPadded, { paddingBottom: 32 }]}>
      <Text style={sharedStyles.title}>{t('vitals.title', 'Vitals trend')}</Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 16 }]}>
        {t('vitals.intro', 'Recent readings from connected Bluetooth devices.')}
      </Text>

      {loading ? <Text style={sharedStyles.subtitle}>{t('vitals.loading', 'Loading…')}</Text> : null}

      {!loading && rows.length === 0 ? (
        <Text style={sharedStyles.subtitle}>{t('vitals.empty', 'No device readings yet.')}</Text>
      ) : null}

      <View style={{ gap: 10 }}>
        {rows.map((row) => (
          <View
            key={row.externalId || `${row.recordedAt}-${row.deviceType}`}
            style={{ padding: 12, borderRadius: 12, backgroundColor: '#f8fafc' }}
          >
            <Text style={{ fontWeight: '600', color: '#0f172a' }}>
              {row.deviceName || row.deviceType}
            </Text>
            <Text style={{ color: '#334155', marginTop: 4 }}>{formatMeasurement(row)}</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
              {row.recordedAt ? new Date(row.recordedAt).toLocaleString() : ''}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
