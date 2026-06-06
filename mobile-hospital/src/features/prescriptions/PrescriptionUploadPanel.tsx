import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { toUserFacingApiError } from '@/api/apiErrors';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import {
  capturePrescriptionPhoto,
  pickPrescriptionImagesFromLibrary,
  type PickedPrescriptionFile
} from './pickPrescriptionImages';
import { uploadPatientPrescriptionFile } from './prescriptionsApi';

const MAX_FILES_PER_BATCH = 5;

type QueueItem = PickedPrescriptionFile & {
  status: 'pending' | 'uploading' | 'done' | 'duplicate' | 'error';
  message?: string;
};

type Props = {
  onUploaded: () => void;
};

export function PrescriptionUploadPanel({ onUploaded }: Props) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function enqueue(files: PickedPrescriptionFile[]) {
    if (!files.length) return;
    setQueue((prev) => {
      const room = Math.max(0, MAX_FILES_PER_BATCH - prev.length);
      const next = files.slice(0, room).map((f) => ({ ...f, status: 'pending' as const }));
      return [...prev, ...next];
    });
  }

  async function onPickLibrary() {
    setError('');
    try {
      const remaining = Math.max(0, MAX_FILES_PER_BATCH - queue.length);
      if (remaining === 0) {
        setError(t('prescriptions.upload.limitReached', { count: MAX_FILES_PER_BATCH }));
        return;
      }
      enqueue(await pickPrescriptionImagesFromLibrary(remaining));
    } catch (err) {
      setError(toUserFacingApiError(err, t('prescriptions.upload.failed')));
    }
  }

  async function onCapture() {
    setError('');
    try {
      if (queue.length >= MAX_FILES_PER_BATCH) {
        setError(t('prescriptions.upload.limitReached', { count: MAX_FILES_PER_BATCH }));
        return;
      }
      const shot = await capturePrescriptionPhoto();
      if (shot) enqueue([shot]);
    } catch (err) {
      setError(toUserFacingApiError(err, t('prescriptions.upload.failed')));
    }
  }

  async function onUploadAll() {
    if (busy || !queue.some((q) => q.status === 'pending')) return;
    setBusy(true);
    setError('');
    let uploadedNew = false;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== 'pending') continue;

      setQueue((prev) =>
        prev.map((row, idx) => (idx === i ? { ...row, status: 'uploading', message: undefined } : row))
      );

      try {
        const result = await uploadPatientPrescriptionFile(item.uri, item.name, item.mimeType);
        setQueue((prev) =>
          prev.map((row, idx) =>
            idx === i
              ? {
                  ...row,
                  status: result.isDuplicate ? 'duplicate' : 'done',
                  message: result.isDuplicate
                    ? t('prescriptions.upload.duplicate')
                    : t('prescriptions.upload.success')
                }
              : row
          )
        );
        if (!result.isDuplicate) uploadedNew = true;
      } catch (err) {
        const msg = toUserFacingApiError(err, t('prescriptions.upload.failed'));
        setQueue((prev) =>
          prev.map((row, idx) => (idx === i ? { ...row, status: 'error', message: msg } : row))
        );
        setError(msg);
      }
    }

    setBusy(false);
    if (uploadedNew) {
      onUploaded();
      Alert.alert(t('prescriptions.upload.successTitle'), t('prescriptions.upload.successMessage'), [
        { text: t('prescriptions.nav.view'), onPress: () => setQueue([]) }
      ]);
    }
  }

  function removeAt(index: number) {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
  }

  const pendingCount = queue.filter((q) => q.status === 'pending').length;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={sharedStyles.title}>{t('prescriptions.upload.title')}</Text>
      <Text style={[sharedStyles.subtitle, { marginBottom: 16 }]}>{t('prescriptions.upload.hint')}</Text>

      <View style={styles.actionsRow}>
        <Pressable style={[sharedStyles.buttonSecondary, styles.actionBtn]} onPress={() => void onPickLibrary()}>
          <Text style={sharedStyles.buttonSecondaryText}>{t('prescriptions.upload.chooseFiles')}</Text>
        </Pressable>
        <Pressable style={[sharedStyles.buttonSecondary, styles.actionBtn]} onPress={() => void onCapture()}>
          <Text style={sharedStyles.buttonSecondaryText}>{t('prescriptions.upload.camera')}</Text>
        </Pressable>
      </View>

      {queue.length === 0 ? (
        <Text style={sharedStyles.subtitle}>{t('prescriptions.upload.queueEmpty')}</Text>
      ) : (
        queue.map((item, index) => (
          <View key={`${item.uri}-${index}`} style={styles.queueRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.fileStatus}>
                {item.status === 'uploading'
                  ? t('prescriptions.upload.uploading')
                  : item.message ?? item.status}
              </Text>
            </View>
            {item.status === 'pending' ? (
              <Pressable onPress={() => removeAt(index)}>
                <Text style={styles.remove}>{t('prescriptions.upload.remove')}</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

      <Pressable
        style={[sharedStyles.button, { marginTop: 16, opacity: busy || pendingCount === 0 ? 0.6 : 1 }]}
        disabled={busy || pendingCount === 0}
        onPress={() => void onUploadAll()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={sharedStyles.buttonText}>{t('prescriptions.upload.submit')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 96
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  actionBtn: {
    flex: 1,
    marginTop: 0
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text
  },
  fileStatus: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2
  },
  remove: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  }
});
