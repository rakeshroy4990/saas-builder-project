import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useSessionStore } from '@/auth/sessionStore';
import {
  askEducationQuestion,
  fetchEducationKeyTopics,
  searchSimilarPrescriptions,
  type EducationChatTurn,
  type PrescriptionSimilarityHit
} from '@/features/education/api';
import { loadEducationBooksCached, peekCachedEducationBooks } from '@/features/education/booksCache';
import { EducationBookPicker } from '@/features/education/EducationBookPicker';
import {
  pickPrescriptionFromCamera,
  pickPrescriptionFromDocuments,
  pickPrescriptionFromGallery
} from '@/features/education/pickPrescriptionFile';
import {
  buildPrescriptionQuestionDraft,
  buildSimilarityQueryFromTranscribe,
  formatPrescriptionForChat,
  isPrescriptionFullyNotStated,
  postEducationPrescriptionTranscribe
} from '@/features/education/prescriptionTranscribe';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type QueryTab = 'books' | 'prescription';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function DoctorOnlyGate() {
  const { t } = useTranslation();
  return (
    <View style={[sharedStyles.screenPadded, { flex: 1, justifyContent: 'center' }]}>
      <Text style={sharedStyles.title}>{t('education.doctorsOnlyTitle')}</Text>
      <Text style={sharedStyles.subtitle}>{t('education.doctorsOnlyMessage')}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: active ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        alignItems: 'center'
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function AttachToolbar({
  disabled,
  onDocument,
  onGallery,
  onCamera
}: {
  disabled: boolean;
  onDocument: () => void;
  onGallery: () => void;
  onCamera: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.attachRow}>
      <Pressable
        style={styles.attachBtn}
        onPress={onDocument}
        disabled={disabled}
        accessibilityLabel={t('education.attachFile')}
      >
        <Ionicons name="attach" size={22} color={disabled ? colors.textMuted : colors.primary} />
      </Pressable>
      <Pressable
        style={styles.attachBtn}
        onPress={onGallery}
        disabled={disabled}
        accessibilityLabel={t('education.attachGallery')}
      >
        <Ionicons name="images-outline" size={22} color={disabled ? colors.textMuted : colors.primary} />
      </Pressable>
      <Pressable
        style={styles.attachBtn}
        onPress={onCamera}
        disabled={disabled}
        accessibilityLabel={t('education.attachCamera')}
      >
        <Ionicons name="camera-outline" size={22} color={disabled ? colors.textMuted : colors.primary} />
      </Pressable>
    </View>
  );
}

export function DoctorEducationScreen() {
  const { t } = useTranslation();
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const isDoctor = role === 'DOCTOR' || role === 'ADMIN';
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [tab, setTab] = useState<QueryTab>('books');
  const [books, setBooks] = useState<string[]>(() => peekCachedEducationBooks() ?? []);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState(() => peekCachedEducationBooks()?.[0] ?? '');
  const [loadingBooks, setLoadingBooks] = useState(() => !peekCachedEducationBooks());
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<EducationChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [chatError, setChatError] = useState('');
  const [prescriptionQuery, setPrescriptionQuery] = useState('');
  const [prescriptionResults, setPrescriptionResults] = useState<PrescriptionSimilarityHit[]>([]);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState('');
  const conversationId = 'mobile-education';

  const loadBooks = useCallback(async () => {
    const hadCache = Boolean(peekCachedEducationBooks());
    if (!hadCache) setLoadingBooks(true);
    try {
      const list = await loadEducationBooksCached();
      setBooks(list);
      setSelectedBook((prev) => (prev && list.includes(prev) ? prev : list[0] ?? ''));
    } catch {
      if (!hadCache) setBooks([]);
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    if (!isDoctor) return;
    void loadBooks();
  }, [isDoctor, loadBooks]);

  useEffect(() => {
    if (!isDoctor || !selectedBook) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchEducationKeyTopics(selectedBook, 10);
        if (!cancelled) setTopics(list);
      } catch {
        if (!cancelled) setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDoctor, selectedBook]);

  useEffect(() => {
    if (messages.length === 0) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  async function onSendQuestion(overrideText?: string) {
    const draft = (overrideText ?? question).trim();
    if (!draft || sending) return;
    setChatError('');
    setSending(true);
    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: draft };
    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setQuestion('');
    try {
      const reply = await askEducationQuestion(draft, selectedBook, history, conversationId);
      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: reply || t('education.emptyAnswer')
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: draft },
        { role: 'assistant', content: assistantMessage.content }
      ]);
    } catch {
      setChatError(t('education.chatFailed'));
    } finally {
      setSending(false);
    }
  }

  async function ingestPrescriptionFile(pick: () => Promise<{ uri: string; name: string; mimeType: string } | null>) {
    if (readingFile || sending) return;
    setChatError('');
    setPrescriptionError('');
    setReadingFile(true);
    try {
      const file = await pick();
      if (!file) return;
      const extracted = await postEducationPrescriptionTranscribe(file);
      if (tab === 'prescription') {
        const query = buildSimilarityQueryFromTranscribe(extracted);
        setPrescriptionQuery(query || buildPrescriptionQuestionDraft(extracted));
        return;
      }
      if (isPrescriptionFullyNotStated(extracted)) {
        setQuestion(buildPrescriptionQuestionDraft(extracted));
        return;
      }
      const formatted = formatPrescriptionForChat(extracted);
      await onSendQuestion(formatted);
    } catch (err) {
      const msg = err instanceof Error ? err.message.trim() : '';
      const fail = t('education.prescriptionReadFailed');
      if (tab === 'prescription') setPrescriptionError(msg || fail);
      else setChatError(msg || fail);
    } finally {
      setReadingFile(false);
    }
  }

  async function onSearchPrescriptions() {
    const query = prescriptionQuery.trim();
    if (!query || prescriptionLoading) return;
    setPrescriptionError('');
    setPrescriptionLoading(true);
    try {
      const hits = await searchSimilarPrescriptions(query, 12);
      setPrescriptionResults(hits);
      if (hits.length === 0) {
        setPrescriptionError(t('education.prescriptionNoResults'));
      }
    } catch {
      setPrescriptionError(t('education.prescriptionSearchFailed'));
      setPrescriptionResults([]);
    } finally {
      setPrescriptionLoading(false);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={styles.messageLabel}>
            {isUser ? t('education.userLabel') : t('education.assistantLabel')}
          </Text>
          <Text style={isUser ? styles.messageBodyUser : styles.messageBodyAssistant}>{item.content}</Text>
        </View>
      </View>
    );
  }

  if (!isDoctor) {
    return <DoctorOnlyGate />;
  }

  return (
    <KeyboardAvoidingView
      style={sharedStyles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={sharedStyles.subtitle}>{t('education.subtitle')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TabButton
            label={t('education.tabs.books')}
            active={tab === 'books'}
            onPress={() => setTab('books')}
          />
          <TabButton
            label={t('education.tabs.prescription')}
            active={tab === 'prescription'}
            onPress={() => setTab('prescription')}
          />
        </View>
      </View>

      {tab === 'books' ? (
        <View style={styles.booksPane}>
          <View style={styles.booksMeta}>
            <EducationBookPicker
              books={books}
              selectedBook={selectedBook}
              loading={loadingBooks}
              onSelect={setSelectedBook}
            />
            {topics.length > 0 ? (
              <>
                <Text style={sharedStyles.label}>{t('education.quickStarts')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  {topics.map((topic) => (
                    <Pressable key={topic} onPress={() => setQuestion(topic)} style={styles.topicChip}>
                      <Text style={styles.topicChipText} numberOfLines={2}>
                        {topic}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[sharedStyles.subtitle, { paddingVertical: 12 }]}>{t('education.booksEmptyHint')}</Text>
            }
            renderItem={renderMessage}
            ListFooterComponent={
              sending ? (
                <View style={styles.typingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.typingText}>{t('education.sending')}</Text>
                </View>
              ) : null
            }
          />

          <View style={styles.composer}>
            {chatError ? <Text style={sharedStyles.errorText}>{chatError}</Text> : null}
            <AttachToolbar
              disabled={sending || readingFile}
              onDocument={() => void ingestPrescriptionFile(pickPrescriptionFromDocuments)}
              onGallery={() => void ingestPrescriptionFile(pickPrescriptionFromGallery)}
              onCamera={() => void ingestPrescriptionFile(pickPrescriptionFromCamera)}
            />
            {readingFile ? (
              <View style={styles.readingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.typingText}>{t('education.readingPrescription')}</Text>
              </View>
            ) : null}
            <TextInput
              style={styles.composerInput}
              multiline
              value={question}
              onChangeText={setQuestion}
              placeholder={t('education.questionPlaceholder')}
              placeholderTextColor={colors.textMuted}
            />
            <Pressable
              style={[sharedStyles.button, { opacity: sending || readingFile ? 0.7 : 1 }]}
              onPress={() => void onSendQuestion()}
              disabled={sending || readingFile || !question.trim()}
            >
              <Text style={sharedStyles.buttonText}>
                {sending ? t('education.sending') : t('education.sendQuestion')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView
          style={sharedStyles.screenPadded}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={sharedStyles.subtitle}>{t('education.prescriptionBanner')}</Text>
          <AttachToolbar
            disabled={prescriptionLoading || readingFile}
            onDocument={() => void ingestPrescriptionFile(pickPrescriptionFromDocuments)}
            onGallery={() => void ingestPrescriptionFile(pickPrescriptionFromGallery)}
            onCamera={() => void ingestPrescriptionFile(pickPrescriptionFromCamera)}
          />
          {readingFile ? (
            <View style={styles.readingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.typingText}>{t('education.readingPrescription')}</Text>
            </View>
          ) : null}
          <TextInput
            style={[sharedStyles.input, { minHeight: 140, textAlignVertical: 'top', marginTop: 8 }]}
            multiline
            value={prescriptionQuery}
            onChangeText={setPrescriptionQuery}
            placeholder={t('education.prescriptionPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            style={[sharedStyles.button, { marginTop: 12, opacity: prescriptionLoading ? 0.7 : 1 }]}
            onPress={() => void onSearchPrescriptions()}
            disabled={prescriptionLoading || readingFile || !prescriptionQuery.trim()}
          >
            {prescriptionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={sharedStyles.buttonText}>{t('education.prescriptionSearch')}</Text>
            )}
          </Pressable>
          {prescriptionError ? <Text style={sharedStyles.errorText}>{prescriptionError}</Text> : null}
          {prescriptionResults.map((hit) => (
            <View key={hit.externalId || hit.searchText} style={sharedStyles.card}>
              <Text style={sharedStyles.cardTitle}>
                {hit.patientName || t('education.unknownPatient')} · {hit.matchPercent.toFixed(1)}%
              </Text>
              {hit.diagnosis ? <Text style={sharedStyles.cardMeta}>{hit.diagnosis}</Text> : null}
              {hit.searchText ? <Text style={sharedStyles.cardBody}>{hit.searchText}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  booksPane: {
    flex: 1
  },
  booksMeta: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4
  },
  topicChip: {
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  topicChipText: {
    color: colors.text,
    fontSize: 13
  },
  messageList: {
    flex: 1
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    flexGrow: 1
  },
  messageRow: {
    width: '100%',
    marginBottom: 12
  },
  messageRowUser: {
    alignItems: 'flex-end'
  },
  messageRowAssistant: {
    alignItems: 'flex-start'
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  bubbleUser: {
    maxWidth: '88%',
    backgroundColor: '#ecfdf5'
  },
  bubbleAssistant: {
    width: '100%',
    backgroundColor: colors.surface
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6
  },
  messageBodyUser: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text
  },
  messageBodyAssistant: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8
  },
  typingText: {
    color: colors.textMuted,
    fontSize: 14
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  composerInput: {
    ...sharedStyles.input,
    minHeight: 72,
    maxHeight: 160,
    textAlignVertical: 'top',
    marginBottom: 8
  },
  attachRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  }
});
