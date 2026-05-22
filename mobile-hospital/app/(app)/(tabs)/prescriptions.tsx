import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { sharedStyles } from '@/theme/styles';

export default function PrescriptionsTab() {
  const { t } = useTranslation();

  return (
    <View style={[sharedStyles.screenPadded, { justifyContent: 'center' }]}>
      <Text style={sharedStyles.title}>{t('prescriptions.title')}</Text>
      <Text style={sharedStyles.subtitle}>{t('prescriptions.comingSoon')}</Text>
    </View>
  );
}
