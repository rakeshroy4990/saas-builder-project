import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, View } from 'react-native';

import { sharedStyles } from '@/theme/styles';

type Props = {
  visible: boolean;
  appointmentId?: string;
  onContinueWithoutTriage: () => void;
  onClose: () => void;
};

export function TriageSoftBlockModal({
  visible,
  appointmentId,
  onContinueWithoutTriage,
  onClose
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 24
        }}
      >
        <View style={[sharedStyles.card, { gap: 12 }]}>
          <Text style={sharedStyles.title}>{t('triage.softBlockTitle')}</Text>
          <Text style={sharedStyles.subtitle}>{t('triage.softBlockMessage')}</Text>
          <Pressable
            style={sharedStyles.button}
            onPress={() => {
              onClose();
              router.push({
                pathname: '/(app)/triage',
                params: appointmentId ? { appointmentId } : {}
              } as never);
            }}
          >
            <Text style={sharedStyles.buttonText}>{t('triage.checkSymptomsFirst')}</Text>
          </Pressable>
          <Pressable style={sharedStyles.buttonSecondary} onPress={onContinueWithoutTriage}>
            <Text style={sharedStyles.buttonSecondaryText}>{t('triage.continueWithoutTriage')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
