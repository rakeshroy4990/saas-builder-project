import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { startScaleMonitoring, type ScaleReading } from '@/ble/bleService';
import { saveDeviceReadingMobile } from '@/features/devices/deviceReadingApi';
import { saveGrowthRecordMobile } from '@/features/growth/growthApi';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

export function DeviceReadScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ childId?: string }>();
  const childId = String(params.childId ?? '').trim();
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  const [status, setStatus] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [lastReading, setLastReading] = useState<ScaleReading | null>(null);

  useEffect(() => {
    return () => {
      void cleanupRef.current?.();
    };
  }, []);

  async function connectScale() {
    if (!childId) {
      Alert.alert(t('devices.ble.title', 'Bluetooth device'), t('devices.ble.selectChildFirst', 'Select a child on the Growth screen first.'));
      return;
    }
    setConnecting(true);
    setStatus(t('devices.ble.scanning', 'Scanning…'));
    try {
      await cleanupRef.current?.();
      const cleanup = await startScaleMonitoring(
        (reading) => setLastReading(reading),
        (next) => setStatus(next)
      );
      cleanupRef.current = cleanup;
    } catch (err) {
      const message = err instanceof Error ? err.message : t('devices.ble.connectFailed', 'Could not connect.');
      setStatus(message);
    } finally {
      setConnecting(false);
    }
  }

  async function saveReading() {
    if (!childId || !lastReading) return;
    try {
      await saveGrowthRecordMobile({
        ChildProfileExternalId: childId,
        WeightKg: lastReading.weightKg,
        RecordedAt: lastReading.recordedAt,
        Source: 'ble_scale'
      });
      await saveDeviceReadingMobile({
        DeviceKey: 'XIAOMI_MI_SCALE',
        DeviceName: 'Smart Scale',
        DeviceType: 'scale',
        Measurements: { weight_kg: lastReading.weightKg },
        RecordedAt: lastReading.recordedAt,
        ChildProfileExternalId: childId
      });
      Alert.alert(t('devices.ble.title', 'Bluetooth device'), t('devices.ble.saved', 'Reading saved.'));
    } catch {
      Alert.alert(t('devices.ble.title', 'Bluetooth device'), t('devices.ble.saveFailed', 'Could not save reading.'));
    }
  }

  return (
    <ScrollView contentContainerStyle={[sharedStyles.screenPadded, { paddingBottom: 32 }]}>
      <Text style={sharedStyles.title}>{t('devices.ble.title', 'Bluetooth scale')}</Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 16 }]}>
        {t('devices.ble.scaleHint', 'Requires a dev build with Bluetooth permissions. Step on the scale after connecting.')}
      </Text>

      <Pressable
        onPress={() => void connectScale()}
        disabled={connecting}
        style={[sharedStyles.button, { opacity: connecting ? 0.6 : 1 }]}
      >
        <Text style={sharedStyles.buttonText}>
          {connecting ? t('devices.ble.connecting', 'Connecting…') : t('devices.ble.connect', 'Connect scale')}
        </Text>
      </Pressable>

      {status ? (
        <Text style={{ marginTop: 12, color: '#475569' }}>{status}</Text>
      ) : null}

      {lastReading ? (
        <View style={{ marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: '#ecfdf5' }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primary }}>
            {lastReading.weightKg.toFixed(2)} kg
          </Text>
          <Pressable onPress={() => void saveReading()} style={[sharedStyles.button, { marginTop: 12 }]}>
            <Text style={sharedStyles.buttonText}>{t('devices.ble.saveToGrowth', 'Save to growth chart')}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
