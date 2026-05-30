import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { EducationClinicalAttachment } from '@/features/education/educationClinicalAttachments';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type EducationAttachmentSequenceModalProps = {
  visible: boolean;
  files: EducationClinicalAttachment[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
};

export function EducationAttachmentSequenceModal({
  visible,
  files,
  busy = false,
  onClose,
  onConfirm,
  onMove
}: EducationAttachmentSequenceModalProps) {
  const { t } = useTranslation();
  const canConfirm = files.length >= 2 && !busy;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('education.sequenceModalTitle')}</Text>
          <Text style={styles.hint}>{t('education.sequenceModalHint')}</Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {files.length < 2 ? (
              <Text style={styles.emptyHint}>{t('education.sequenceModalEmpty')}</Text>
            ) : null}
            {files.map((file, index) => (
              <View key={file.id} style={styles.row}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable
                  style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}
                  disabled={index === 0 || busy}
                  onPress={() => onMove(index, -1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('education.moveFileEarlier')}
                >
                  <Ionicons name="chevron-up" size={18} color={colors.text} />
                </Pressable>
                <Pressable
                  style={[styles.moveBtn, index === files.length - 1 && styles.moveBtnDisabled]}
                  disabled={index === files.length - 1 || busy}
                  onPress={() => onMove(index, 1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('education.moveFileLater')}
                >
                  <Ionicons name="chevron-down" size={18} color={colors.text} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              style={[sharedStyles.buttonSecondary, styles.actionBtn]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={sharedStyles.buttonSecondaryText}>{t('education.sequenceModalCancel')}</Text>
            </Pressable>
            <Pressable
              style={[sharedStyles.button, styles.actionBtn, !canConfirm && styles.actionBtnDisabled]}
              onPress={onConfirm}
              disabled={!canConfirm}
            >
              <Text style={sharedStyles.buttonText}>{t('education.sequenceModalConfirm')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 16
  },
  panel: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '80%'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center'
  },
  hint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center'
  },
  list: {
    marginTop: 16,
    maxHeight: 240
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center'
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1'
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  moveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  moveBtnDisabled: {
    opacity: 0.35
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  actionBtn: {
    flex: 1,
    marginBottom: 0
  },
  actionBtnDisabled: {
    opacity: 0.5
  }
});
