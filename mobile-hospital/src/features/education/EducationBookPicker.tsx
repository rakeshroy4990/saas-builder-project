import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type EducationBookPickerProps = {
  books: string[];
  selectedBooks: string[];
  loading: boolean;
  onChange: (books: string[]) => void;
};

function normalizeBookNames(raw: string[]): string[] {
  return raw.map((b) => String(b ?? '').trim()).filter(Boolean);
}

export function EducationBookPicker({ books, selectedBooks, loading, onChange }: EducationBookPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(normalizeBookNames(selectedBooks)), [selectedBooks]);
  const count = selectedSet.size;

  const filteredBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => b.toLowerCase().includes(q));
  }, [books, query]);

  const displayLabel = loading
    ? t('education.loadingBooks')
    : count <= 0
      ? t('education.allBooks')
      : count === 1
        ? [...selectedSet][0]
        : t('education.bookFilterSelectedCount', { count });

  function closePicker(): void {
    setOpen(false);
    setQuery('');
  }

  function toggleBook(book: string): void {
    const name = String(book ?? '').trim();
    if (!name) return;
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange([...next]);
  }

  function resetSelection(): void {
    setQuery('');
    onChange([]);
  }

  return (
    <>
      <Text style={sharedStyles.label}>{t('education.filterBook')}</Text>
      <Pressable
        style={styles.selector}
        onPress={() => !loading && setOpen(true)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={t('education.filterBook')}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginRight: 8 }} />
        ) : (
          <Ionicons name="book-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
        )}
        <Text style={styles.selectorText} numberOfLines={2}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={closePicker}>
        <Pressable style={styles.backdrop} onPress={closePicker}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{t('education.filterBook')}</Text>

            <View style={styles.searchRow}>
              <Ionicons name="search" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('education.bookFilterSearchPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>

            <View style={styles.toolbar}>
              <Text style={styles.countText}>
                {t('education.bookFilterSelectedCount', { count })}
              </Text>
              <Pressable
                onPress={resetSelection}
                disabled={count === 0 && !query.trim()}
                style={[styles.resetBtn, count === 0 && !query.trim() && styles.resetBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t('education.bookFilterReset')}
              >
                <Text style={styles.resetBtnText}>{t('education.bookFilterReset')}</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <Pressable
                onPress={resetSelection}
                style={[styles.option, count === 0 && styles.optionActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: count === 0 }}
              >
                <View style={[styles.checkbox, count === 0 && styles.checkboxActive]}>
                  {count === 0 ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                </View>
                <Text style={[styles.optionText, count === 0 && styles.optionTextActive]}>
                  {t('education.allBooks')}
                </Text>
              </Pressable>

              {filteredBooks.length === 0 ? (
                <Text style={styles.emptyText}>{t('education.bookFilterNoResults')}</Text>
              ) : (
                filteredBooks.map((book) => {
                  const active = selectedSet.has(book);
                  return (
                    <Pressable
                      key={book}
                      onPress={() => toggleBook(book)}
                      style={[styles.option, active && styles.optionActive]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                    >
                      <View style={[styles.checkbox, active && styles.checkboxActive]}>
                        {active ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{book}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable style={styles.closeBtn} onPress={closePicker}>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    marginBottom: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8
  },
  countText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  resetBtnDisabled: {
    opacity: 0.45
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  checkboxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text
  },
  optionTextActive: {
    fontWeight: '600',
    color: colors.primaryDark
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: 16,
    paddingHorizontal: 4
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
