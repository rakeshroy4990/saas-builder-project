import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

import type { SelectOption } from '@/features/appointments/bookingTypes';

type FormSelectFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export function FormSelectField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
  error
}: FormSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrap}>
      <Text style={sharedStyles.label}>{label}</Text>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled, error ? styles.triggerError : null]}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={2}>
          {selected?.label ?? placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>{placeholder}</Text>}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              }}
            />
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48
  },
  triggerDisabled: {
    opacity: 0.55,
    backgroundColor: colors.background
  },
  triggerError: {
    borderColor: colors.error
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
    color: colors.text
  },
  placeholder: {
    color: colors.textMuted
  },
  chevron: {
    fontSize: 14,
    color: colors.textMuted
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)'
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12
  },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  optionActive: {
    backgroundColor: '#f0fdfa'
  },
  optionText: {
    fontSize: 16,
    color: colors.text
  },
  optionTextActive: {
    fontWeight: '600',
    color: colors.primaryDark
  },
  empty: {
    color: colors.textMuted,
    paddingVertical: 16,
    textAlign: 'center'
  },
  closeBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary
  }
});
