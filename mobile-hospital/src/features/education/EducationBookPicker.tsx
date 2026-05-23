import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type EducationBookPickerProps = {
  books: string[];
  selectedBook: string;
  loading: boolean;
  onSelect: (book: string) => void;
};

export function EducationBookPicker({ books, selectedBook, loading, onSelect }: EducationBookPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Text style={sharedStyles.label}>{t('education.filterBook')}</Text>
      <Pressable
        style={styles.selector}
        onPress={() => books.length > 0 && setOpen(true)}
        disabled={loading || books.length === 0}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginRight: 8 }} />
        ) : (
          <Ionicons name="book-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.selectorText} numberOfLines={2}>
          {loading ? t('education.loadingBooks') : selectedBook || t('education.noBooks')}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('education.filterBook')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {books.map((book) => {
                const active = book === selectedBook;
                return (
                  <Pressable
                    key={book}
                    onPress={() => {
                      onSelect(book);
                      setOpen(false);
                    }}
                    style={[styles.option, active && styles.optionActive]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{book}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>{t('education.closePicker')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 10
  },
  selectorText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 20
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  optionActive: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingRight: 8
  },
  optionTextActive: {
    fontWeight: '600',
    color: colors.primaryDark
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary
  }
});
