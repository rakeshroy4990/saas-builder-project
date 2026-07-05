import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import {
  getHealthConnectAvailability,
  openHealthConnectInstall,
  openHealthConnectSettings,
  readHealthConnectHistory,
  requestHealthConnectAccess,
  type HealthConnectAvailability,
  type HealthConnectDaySnapshot
} from '@/features/devices/healthConnectService';
import {
  SMART_WATCH_PLATFORMS,
  clearSmartWatchIntegration,
  readSmartWatchIntegration,
  saveSmartWatchIntegration,
  type SmartWatchPlatform
} from '@/features/devices/smartWatchIntegration';
import {
  formatSnapshotSummary,
  syncSmartWatchFromHealthConnect
} from '@/features/devices/smartWatchSyncService';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

function platformSteps(t: (key: string, options?: { returnObjects?: boolean }) => string, platform: SmartWatchPlatform): string[] {
  const steps = t(`devices.smartWatch.platforms.${platform}.steps`, { returnObjects: true });
  return Array.isArray(steps) ? steps.map(String) : [];
}

function syncItems(t: (key: string, options?: { returnObjects?: boolean }) => string): string[] {
  const items = t('devices.smartWatch.syncItems', { returnObjects: true });
  return Array.isArray(items) ? items.map(String) : [];
}

function availabilityMessage(t: (key: string) => string, availability: HealthConnectAvailability): string {
  switch (availability) {
    case 'unsupported_platform':
      return t('devices.smartWatch.healthConnect.iosOnly');
    case 'module_unavailable':
      return t('devices.smartWatch.healthConnect.devBuildRequired');
    case 'sdk_unavailable':
      return t('devices.smartWatch.healthConnect.notInstalled');
    case 'needs_provider_update':
      return t('devices.smartWatch.healthConnect.updateRequired');
    default:
      return '';
  }
}

export function SmartWatchConnectScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ childId?: string }>();
  const childId = String(params.childId ?? '').trim();

  const [selectedPlatform, setSelectedPlatform] = useState<SmartWatchPlatform | null>(null);
  const [savedPlatform, setSavedPlatform] = useState<SmartWatchPlatform | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [healthAccessGranted, setHealthAccessGranted] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [availability, setAvailability] = useState<HealthConnectAvailability>('unsupported_platform');
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewRows, setPreviewRows] = useState<HealthConnectDaySnapshot[]>([]);
  const [lastImportedCount, setLastImportedCount] = useState(0);

  const activePlatform = savedPlatform ?? selectedPlatform;

  useEffect(() => {
    void readSmartWatchIntegration().then((saved) => {
      setSavedPlatform(saved.platform);
      setSavedAt(saved.connectedAt);
      setHealthAccessGranted(Boolean(saved.healthAccessGranted));
      setLastSyncAt(saved.lastSyncAt ?? null);
      if (saved.platform) setSelectedPlatform(saved.platform);
    });
    void getHealthConnectAvailability().then(setAvailability);
  }, []);

  async function persistState(patch: {
    platform?: SmartWatchPlatform | null;
    connectedAt?: string | null;
    healthAccessGranted?: boolean;
    lastSyncAt?: string | null;
  }) {
    const next = {
      platform: patch.platform !== undefined ? patch.platform : savedPlatform,
      connectedAt: patch.connectedAt !== undefined ? patch.connectedAt : savedAt,
      healthAccessGranted:
        patch.healthAccessGranted !== undefined ? patch.healthAccessGranted : healthAccessGranted,
      lastSyncAt: patch.lastSyncAt !== undefined ? patch.lastSyncAt : lastSyncAt
    };
    await saveSmartWatchIntegration(next);
    if (patch.platform !== undefined) setSavedPlatform(patch.platform);
    if (patch.connectedAt !== undefined) setSavedAt(patch.connectedAt);
    if (patch.healthAccessGranted !== undefined) setHealthAccessGranted(patch.healthAccessGranted);
    if (patch.lastSyncAt !== undefined) setLastSyncAt(patch.lastSyncAt);
  }

  async function runSync(showAlerts: boolean): Promise<boolean> {
    if (!activePlatform) return false;
    setSyncing(true);
    try {
      const localPreview = await readHealthConnectHistory(7);
      setPreviewRows(localPreview);

      const result = await syncSmartWatchFromHealthConnect({
        platform: activePlatform,
        childProfileExternalId: childId || undefined,
        days: 7
      });

      if (result.importedCount === 0) {
        if (showAlerts) {
          Alert.alert(t('devices.smartWatch.title'), t('devices.smartWatch.healthConnect.noDataYet'));
        }
        return false;
      }

      const syncTime = new Date().toISOString();
      setLastImportedCount(result.importedCount);
      await persistState({ lastSyncAt: syncTime });
      if (showAlerts) {
        Alert.alert(
          t('devices.smartWatch.title'),
          t('devices.smartWatch.healthConnect.syncSuccessCount', { count: result.importedCount })
        );
      }
      return true;
    } catch {
      if (showAlerts) {
        Alert.alert(t('devices.smartWatch.title'), t('devices.smartWatch.healthConnect.syncFailed'));
      }
      return false;
    } finally {
      setSyncing(false);
    }
  }

  async function onConnectHealth() {
    if (!activePlatform) {
      Alert.alert(t('devices.smartWatch.title'), t('devices.smartWatch.choosePlatformHint'));
      return;
    }

    setConnecting(true);
    try {
      const currentAvailability = await getHealthConnectAvailability();
      setAvailability(currentAvailability);

      if (currentAvailability === 'needs_provider_update' || currentAvailability === 'sdk_unavailable') {
        Alert.alert(
          t('devices.smartWatch.connectHealthData'),
          availabilityMessage(t, currentAvailability),
          [
            { text: t('common.cancel', 'Cancel'), style: 'cancel' },
            {
              text: t('devices.smartWatch.healthConnect.openStore'),
              onPress: () => void openHealthConnectInstall()
            }
          ]
        );
        return;
      }

      if (currentAvailability !== 'ready') {
        Alert.alert(t('devices.smartWatch.connectHealthData'), availabilityMessage(t, currentAvailability));
        return;
      }

      const result = await requestHealthConnectAccess();
      if (!result.granted) {
        Alert.alert(
          t('devices.smartWatch.connectHealthData'),
          t('devices.smartWatch.healthConnect.permissionDenied')
        );
        return;
      }

      const now = new Date().toISOString();
      await persistState({
        platform: activePlatform,
        connectedAt: savedAt ?? now,
        healthAccessGranted: true
      });
      setSelectedPlatform(activePlatform);

      await runSync(true);
    } finally {
      setConnecting(false);
    }
  }

  async function onClear() {
    await clearSmartWatchIntegration();
    setSavedPlatform(null);
    setSavedAt(null);
    setSelectedPlatform(null);
    setHealthAccessGranted(false);
    setLastSyncAt(null);
    setPreviewRows([]);
    setLastImportedCount(0);
  }

  function onChangeWatchType() {
    void onClear();
  }

  return (
    <ScrollView contentContainerStyle={[sharedStyles.screenPadded, { paddingBottom: 32 }]}>
      <Text style={sharedStyles.title}>{t('devices.smartWatch.title')}</Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 16 }]}>{t('devices.smartWatch.intro')}</Text>

      {!activePlatform ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: '#475569', marginBottom: 4 }}>{t('devices.smartWatch.choosePlatformHint')}</Text>
          {SMART_WATCH_PLATFORMS.map((platform) => (
            <Pressable
              key={platform}
              onPress={() => setSelectedPlatform(platform)}
              style={[sharedStyles.buttonSecondary, { alignItems: 'flex-start' }]}
            >
              <Text style={sharedStyles.buttonSecondaryText}>
                ⌚ {t(`devices.smartWatch.platforms.${platform}.label`)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Pressable onPress={onChangeWatchType}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('devices.smartWatch.changeWatchType')}</Text>
          </Pressable>

          <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>
              {t(`devices.smartWatch.platforms.${activePlatform}.label`)}
            </Text>
            <Text style={{ color: '#475569', marginBottom: 8 }}>{t('devices.smartWatch.setupIntro')}</Text>
            {platformSteps(t, activePlatform).map((step, index) => (
              <Text key={index} style={{ color: '#334155', marginBottom: 4 }}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>

          {healthAccessGranted ? (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#6ee7b7' }}>
              <Text style={{ fontWeight: '700', color: colors.primary, marginBottom: 4 }}>
                {t('devices.smartWatch.healthConnect.connectedTitle')}
              </Text>
              {lastSyncAt ? (
                <Text style={{ fontSize: 12, color: '#047857', marginBottom: 4 }}>
                  {t('devices.smartWatch.healthConnect.lastSync', {
                    date: new Date(lastSyncAt).toLocaleString()
                  })}
                </Text>
              ) : null}
              {lastImportedCount > 0 ? (
                <Text style={{ fontSize: 12, color: '#047857', marginBottom: 8 }}>
                  {t('devices.smartWatch.healthConnect.importedCount', { count: lastImportedCount })}
                </Text>
              ) : null}
              <Text style={{ color: '#065f46' }}>{t('devices.smartWatch.healthConnect.connectedHint')}</Text>
            </View>
          ) : (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d' }}>
              <Text style={{ fontWeight: '700', color: '#92400e', marginBottom: 4 }}>
                {t('devices.smartWatch.statusNotSyncing')}
              </Text>
              <Text style={{ color: '#92400e' }}>{t('devices.smartWatch.connectHealthPrompt')}</Text>
            </View>
          )}

          {previewRows.length > 0 ? (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }}>
              <Text style={{ fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                {t('devices.smartWatch.healthConnect.previewTitle')}
              </Text>
              {previewRows.slice(0, 5).map((row) => (
                <Text key={row.date} style={{ color: '#166534', marginBottom: 4, fontSize: 13 }}>
                  {row.date}: {formatSnapshotSummary(row)}
                </Text>
              ))}
            </View>
          ) : null}

          <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#ecfdf5' }}>
            <Text style={{ fontWeight: '700', color: colors.primary, marginBottom: 6 }}>
              {t('devices.smartWatch.syncTitle')}
            </Text>
            {syncItems(t).map((item, index) => (
              <Text key={index} style={{ color: '#065f46', marginBottom: 2 }}>
                • {item}
              </Text>
            ))}
          </View>

          {Platform.OS === 'android' ? (
            <>
              {!healthAccessGranted ? (
                <Pressable
                  onPress={() => void onConnectHealth()}
                  disabled={connecting || syncing}
                  style={[sharedStyles.button, { opacity: connecting || syncing ? 0.6 : 1 }]}
                >
                  <Text style={sharedStyles.buttonText}>
                    {connecting
                      ? t('devices.smartWatch.connectingHealth')
                      : t('devices.smartWatch.connectHealthData')}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={() => void runSync(true)}
                    disabled={syncing}
                    style={[sharedStyles.button, { opacity: syncing ? 0.6 : 1 }]}
                  >
                    <Text style={sharedStyles.buttonText}>
                      {syncing ? t('devices.smartWatch.syncingNow') : t('devices.smartWatch.syncNow')}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => void openHealthConnectSettings()} style={sharedStyles.buttonSecondary}>
                    <Text style={sharedStyles.buttonSecondaryText}>
                      {t('devices.smartWatch.healthConnect.managePermissions')}
                    </Text>
                  </Pressable>
                </>
              )}
              {availability !== 'ready' && availability !== 'unsupported_platform' ? (
                <Pressable onPress={() => void openHealthConnectInstall()} style={sharedStyles.buttonSecondary}>
                  <Text style={sharedStyles.buttonSecondaryText}>
                    {t('devices.smartWatch.healthConnect.openStore')}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d' }}>
              <Text style={{ color: '#92400e' }}>{t('devices.smartWatch.healthConnect.iosOnly')}</Text>
            </View>
          )}

          <Pressable onPress={() => void onClear()} style={sharedStyles.buttonSecondary}>
            <Text style={sharedStyles.buttonSecondaryText}>{t('devices.smartWatch.clearSaved')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
