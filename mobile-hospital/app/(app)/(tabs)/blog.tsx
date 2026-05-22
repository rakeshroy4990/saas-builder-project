import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { sharedStyles } from '@/theme/styles';

export default function BlogTab() {
  const { t } = useTranslation();

  return (
    <View style={[sharedStyles.screenPadded, { justifyContent: 'center' }]}>
      <Text style={sharedStyles.title}>{t('nav.blog')}</Text>
      <Text style={sharedStyles.subtitle}>{t('blog.comingSoon')}</Text>
    </View>
  );
}
