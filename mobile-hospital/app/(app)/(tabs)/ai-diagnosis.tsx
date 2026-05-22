import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { sharedStyles } from '@/theme/styles';

export default function AiDiagnosisTab() {
  const { t } = useTranslation();

  return (
    <View style={[sharedStyles.screenPadded, { justifyContent: 'center' }]}>
      <Text style={sharedStyles.title}>{t('nav.aiDiagnosis')}</Text>
      <Text style={sharedStyles.subtitle}>{t('aiDiagnosis.comingSoon')}</Text>
    </View>
  );
}
