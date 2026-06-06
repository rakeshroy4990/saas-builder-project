import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isIsoDateString } from '@/features/appointments/dashboardFilters';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type FormDateFilterFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  clearLabel: string;
};

export function FormDateFilterField({
  label,
  placeholder,
  value,
  onChange,
  clearLabel
}: FormDateFilterFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commitDraft() {
    const next = draft.trim();
    if (!next) {
      onChange('');
      return;
    }
    if (isIsoDateString(next)) {
      onChange(next);
      return;
    }
    setDraft(value);
  }

  return (
    <View style={styles.wrap}>
      <Text style={sharedStyles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onBlur={commitDraft}
          onSubmitEditing={commitDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel={label}
        />
        {value ? (
          <Pressable style={styles.clearBtn} onPress={() => onChange('')} accessibilityRole="button">
            <Text style={styles.clearBtnText}>{clearLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 16,
    color: colors.text
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 12
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary
  }
});
