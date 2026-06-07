import { useTranslation } from 'react-i18next';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { changeAppLocale } from '@/features/auth/localeSync';
import { LOCALE_CONFIG, SUPPORTED_LOCALES, type LocaleCode } from '@/i18n/locale';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type LanguagePickerProps = {
  userId?: string;
  style?: ViewStyle;
};

export function LanguagePicker({ userId, style }: LanguagePickerProps) {
  const { t, i18n } = useTranslation();

  return (
    <View style={[sharedStyles.card, { marginTop: 16 }, style]}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{t('language.title')}</Text>
      <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 12 }}>
        {t('language.hint')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SUPPORTED_LOCALES.map((code: LocaleCode) => {
          const active = i18n.language?.startsWith(code);
          return (
            <Pressable
              key={code}
              style={[
                sharedStyles.buttonSecondary,
                {
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: active ? colors.primary : undefined
                }
              ]}
              onPress={() => void changeAppLocale(code, userId)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[sharedStyles.buttonSecondaryText, active ? { color: '#fff' } : undefined]}>
                {LOCALE_CONFIG[code].label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
