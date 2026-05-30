import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { useSessionStore } from '@/auth/sessionStore';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import {
  askEducationQuestionStreaming,
  fetchEducationKeyTopics,
  searchSimilarPrescriptions,
  type EducationChatTurn,
  type PrescriptionSimilarityHit
} from '@/features/education/api';
import { loadEducationBooksCached, peekCachedEducationBooks } from '@/features/education/booksCache';
import { EducationBookPicker } from '@/features/education/EducationBookPicker';
import { EducationAttachmentSequenceModal } from '@/features/education/EducationAttachmentSequenceModal';
import {
  buildEducationAttachmentDisplayContent,
  buildEducationRetrievalQuestionWithAttachments,
  newClinicalAttachmentId,
  stripEducationAttachedFileHeaders,
  type EducationClinicalAttachment
} from '@/features/education/educationClinicalAttachments';
import {
  pickPrescriptionFromCamera,
  pickPrescriptionFromDocuments,
  pickPrescriptionFromGallery
} from '@/features/education/pickPrescriptionFile';
import {
  buildPrescriptionQuestionDraft,
  buildSimilarityQueryFromTranscribe,
  isPrescriptionFullyNotStated,
  postEducationPrescriptionTranscribe
} from '@/features/education/prescriptionTranscribe';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type QueryTab = 'books' | 'prescription';

const MAX_CONVERSATION_ATTACHMENTS = 3;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  retrievalQuestion?: string;
  submittedQuestion?: string;
  autoAttachmentPrompt?: boolean;
  sendFailedTimeout?: boolean;
};

type SubmitConversationOpts = {
  question?: string;
  userDisplayContent?: string;
  retrievalQuestion?: string;
  submittedQuestion?: string;
  autoAttachmentPrompt?: boolean;
  replaceUserMessageId?: string;
  bypassComposerGate?: boolean;
  skipSequenceModal?: boolean;
  attachments?: EducationClinicalAttachment[];
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

function AttachMenuButton({
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
  const [open, setOpen] = useState(false);

  function closeAndRun(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <View style={styles.attachMenuAnchor}>
      {open ? (
        <View style={styles.attachMenuPopover}>
          <Pressable
            style={styles.attachMenuItem}
            onPress={() => closeAndRun(onDocument)}
            accessibilityRole="button"
            accessibilityLabel={t('education.attachFile')}
          >
            <Ionicons name="attach" size={20} color={colors.primary} />
            <Text style={styles.attachMenuLabel}>{t('education.attachFile')}</Text>
          </Pressable>
          <Pressable
            style={styles.attachMenuItem}
            onPress={() => closeAndRun(onGallery)}
            accessibilityRole="button"
            accessibilityLabel={t('education.attachGallery')}
          >
            <Ionicons name="images-outline" size={20} color={colors.primary} />
            <Text style={styles.attachMenuLabel}>{t('education.attachGallery')}</Text>
          </Pressable>
          <Pressable
            style={[styles.attachMenuItem, styles.attachMenuItemLast]}
            onPress={() => closeAndRun(onCamera)}
            accessibilityRole="button"
            accessibilityLabel={t('education.attachCamera')}
          >
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text style={styles.attachMenuLabel}>{t('education.attachCamera')}</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        style={[styles.plusBtn, open && styles.plusBtnActive, disabled && styles.plusBtnDisabled]}
        onPress={() => setOpen((prev) => !prev)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={open ? t('education.closeAttachMenu') : t('education.openAttachMenu')}
      >
        <Ionicons
          name={open ? 'close' : 'add'}
          size={26}
          color={disabled ? colors.textMuted : open ? colors.text : colors.primary}
        />
      </Pressable>
    </View>
  );
}

function CollapsiblePanelHeader({
  title,
  subtitle,
  expanded,
  onToggle,
  expandLabel,
  collapseLabel
}: {
  title: string;
  subtitle?: string;
  expanded: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.panelHeader}
      accessibilityRole="button"
      accessibilityLabel={expanded ? collapseLabel : expandLabel}
      accessibilityState={{ expanded }}
    >
      <View style={styles.panelHeaderText}>
        <Text style={styles.panelHeaderTitle}>{title}</Text>
        {subtitle ? <Text style={styles.panelHeaderSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export function DoctorEducationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const keyboardInset = useKeyboardInset();
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();
  const isDoctor = role === 'DOCTOR' || role === 'ADMIN';
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const prescriptionScrollRef = useRef<ScrollView>(null);
  const questionInputRef = useRef<TextInput>(null);

  const [tab, setTab] = useState<QueryTab>('books');
  const [books, setBooks] = useState<string[]>(() => peekCachedEducationBooks() ?? []);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
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
  const [educationExpanded, setEducationExpanded] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [prescriptionComposerExpanded, setPrescriptionComposerExpanded] = useState(false);
  const [clinicalAttachments, setClinicalAttachments] = useState<EducationClinicalAttachment[]>([]);
  const [sequenceModalVisible, setSequenceModalVisible] = useState(false);
  const [sequencePending, setSequencePending] = useState<EducationClinicalAttachment[]>([]);
  const [showAutoSentNotice, setShowAutoSentNotice] = useState(false);
  const autoSentNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationId = 'mobile-education';

  const loadBooks = useCallback(async () => {
    const hadCache = Boolean(peekCachedEducationBooks()?.length);
    if (!hadCache) setLoadingBooks(true);
    try {
      const list = await loadEducationBooksCached();
      setBooks(list);
      setSelectedBooks((prev) => prev.filter((b) => list.includes(b)));
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
    navigation.setOptions({ headerShown: tab === 'prescription' });
  }, [navigation, tab]);

  useEffect(() => {
    if (!isDoctor || selectedBooks.length === 0) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const booksForTopics =
          selectedBooks.length === 1 ? selectedBooks : selectedBooks.slice(0, 5);
        const perBookLimit = selectedBooks.length === 1 ? 10 : 4;
        const lists = await Promise.all(
          booksForTopics.map((book) => fetchEducationKeyTopics(book, perBookLimit))
        );
        const merged: string[] = [];
        const seen = new Set<string>();
        for (const list of lists) {
          for (const topic of list) {
            const key = topic.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(topic);
            }
          }
        }
        if (!cancelled) setTopics(merged.slice(0, 10));
      } catch {
        if (!cancelled) setTopics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDoctor, selectedBooks]);

  useEffect(() => {
    if (messages.length === 0) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  useEffect(() => {
    if (tab !== 'books' || keyboardInset <= 0) return;
    scrollChatToEnd();
    const t = setTimeout(scrollChatToEnd, 120);
    return () => clearTimeout(t);
  }, [keyboardInset, tab]);

  useEffect(() => {
    if (messages.length === 0) return;
    setEducationExpanded(true);
  }, [messages.length]);

  useEffect(() => {
    if (sending) setEducationExpanded(true);
  }, [sending]);

  useEffect(() => {
    if (!composerExpanded) return;
    const timer = setTimeout(() => questionInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [composerExpanded]);

  useEffect(() => {
    return () => {
      if (autoSentNoticeTimer.current) clearTimeout(autoSentNoticeTimer.current);
    };
  }, []);

  function autoQuestionFromAttachments(): string {
    return t('education.autoQuestionFromAttachments');
  }

  function doctorBubbleDisplayContent(message: ChatMessage): string {
    return stripEducationAttachedFileHeaders(String(message.content ?? ''));
  }

  function canSendComposer(): boolean {
    if (sending || readingFile) return false;
    return Boolean(question.trim());
  }

  function moveAttachmentRows(
    rows: EducationClinicalAttachment[],
    index: number,
    direction: -1 | 1
  ): EducationClinicalAttachment[] {
    const next = [...rows];
    const nextIndex = index + direction;
    if (index < 0 || index >= next.length) return next;
    if (nextIndex < 0 || nextIndex >= next.length) return next;
    const current = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = current;
    return next;
  }

  function openSequenceModal(files: EducationClinicalAttachment[]): void {
    setSequencePending(files.map((row) => ({ ...row })));
    setSequenceModalVisible(true);
  }

  function closeSequenceModal(): void {
    setSequenceModalVisible(false);
  }

  function triggerAutoSentNotice(): void {
    setShowAutoSentNotice(true);
    if (autoSentNoticeTimer.current) clearTimeout(autoSentNoticeTimer.current);
    autoSentNoticeTimer.current = setTimeout(() => {
      setShowAutoSentNotice(false);
      autoSentNoticeTimer.current = null;
    }, 2600);
  }

  function removeClinicalAttachment(id: string): void {
    setClinicalAttachments((prev) => prev.filter((row) => row.id !== id));
  }

  async function sendWithAttachedFiles(filesSnapshot = clinicalAttachments): Promise<void> {
    const apiQuestion = question.trim() || autoQuestionFromAttachments();
    await submitConversation({
      question: apiQuestion,
      attachments: filesSnapshot,
      bypassComposerGate: true,
      skipSequenceModal: true
    });
    triggerAutoSentNotice();
  }

  async function confirmSequenceAndSend(): Promise<void> {
    if (sequencePending.length < 2) {
      closeSequenceModal();
      return;
    }
    setClinicalAttachments(sequencePending.map((row) => ({ ...row })));
    closeSequenceModal();
    await sendWithAttachedFiles([...sequencePending]);
  }

  async function submitConversation(opts: SubmitConversationOpts = {}): Promise<void> {
    const draft = String(opts.question ?? question).trim();
    if (!draft || sending) return;
    if (!opts.bypassComposerGate && !canSendComposer()) return;

    const filesSnapshot = opts.attachments ?? clinicalAttachments;
    if (filesSnapshot.length > 1 && !opts.skipSequenceModal) {
      openSequenceModal(filesSnapshot);
      return;
    }

    const autoQuestion = autoQuestionFromAttachments();
    const retrievalQuestion =
      String(opts.retrievalQuestion ?? '').trim() ||
      buildEducationRetrievalQuestionWithAttachments(draft, filesSnapshot);
    const userDisplayContent =
      String(opts.userDisplayContent ?? '').trim() ||
      buildEducationAttachmentDisplayContent(draft, filesSnapshot, { autoQuestion });
    const submittedQuestion = String(opts.submittedQuestion ?? draft).trim();
    const autoAttachmentPrompt =
      opts.autoAttachmentPrompt ?? (draft === autoQuestion && filesSnapshot.length > 0);
    const hadAttachments = filesSnapshot.length > 0;

    setChatError('');
    setSending(true);
    if (hadAttachments) setClinicalAttachments([]);
    if (!opts.question) setQuestion('');

    const userMessageId = `u-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: userDisplayContent || draft,
      retrievalQuestion,
      submittedQuestion,
      autoAttachmentPrompt
    };
    const assistantId = `a-${Date.now()}`;

    const priorMessages = opts.replaceUserMessageId
      ? messages.slice(
          0,
          Math.max(0, messages.findIndex((m) => m.id === opts.replaceUserMessageId))
        )
      : messages;

    let priorHistory = history;
    if (opts.replaceUserMessageId) {
      const replaceIdx = messages.findIndex((m) => m.id === opts.replaceUserMessageId);
      let userTurnsBefore = 0;
      for (let i = 0; i < replaceIdx; i += 1) {
        if (messages[i]?.role === 'user') userTurnsBefore += 1;
      }
      priorHistory = history.slice(0, userTurnsBefore * 2);
    }

    setMessages([...priorMessages, userMessage, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      const reply = await askEducationQuestionStreaming(
        submittedQuestion,
        selectedBooks,
        priorHistory,
        conversationId,
        {
          onDelta: (textSoFar) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: textSoFar } : m))
            );
          }
        },
        retrievalQuestion
      );
      const finalText = reply.trim() || t('education.emptyAnswer');
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: finalText } : m))
      );
      setHistory([...priorHistory, { role: 'user', content: submittedQuestion }, { role: 'assistant', content: finalText }]);
    } catch (err) {
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== assistantId)
          .map((m) => (m.id === userMessageId ? { ...m, sendFailedTimeout: true } : m))
      );
      const msg = err instanceof Error ? err.message.trim() : '';
      setChatError(msg || t('education.chatFailed'));
    } finally {
      setSending(false);
    }
  }

  async function onSendQuestion(overrideText?: string) {
    await submitConversation({
      question: overrideText,
      bypassComposerGate: Boolean(overrideText?.trim())
    });
  }

  async function resendUserQuestion(message: ChatMessage) {
    const display = doctorBubbleDisplayContent(message);
    if (!display || sending) return;
    const submittedQuestion = String(message.submittedQuestion ?? '').trim() || display;
    const retrievalQuestion =
      String(message.retrievalQuestion ?? '').trim() ||
      buildEducationRetrievalQuestionWithAttachments(submittedQuestion, []);
    await submitConversation({
      question: submittedQuestion,
      userDisplayContent: display,
      retrievalQuestion,
      submittedQuestion,
      autoAttachmentPrompt: Boolean(message.autoAttachmentPrompt),
      replaceUserMessageId: message.id,
      bypassComposerGate: true
    });
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
      const draft = buildPrescriptionQuestionDraft(extracted).trim();
      if (!draft) return;
      if (isPrescriptionFullyNotStated(extracted)) {
        setQuestion(buildPrescriptionQuestionDraft(extracted));
        setComposerExpanded(true);
        return;
      }
      const remainingSlots = MAX_CONVERSATION_ATTACHMENTS - clinicalAttachments.length;
      if (remainingSlots <= 0) {
        setChatError(t('education.attachmentLimitReached', { count: MAX_CONVERSATION_ATTACHMENTS }));
        return;
      }
      const added: EducationClinicalAttachment = {
        id: newClinicalAttachmentId(),
        name: file.name || 'attachment',
        retrievalText: draft
      };
      const merged = [...clinicalAttachments, added].slice(0, MAX_CONVERSATION_ATTACHMENTS);
      setClinicalAttachments(merged);
      setComposerExpanded(true);
      if (merged.length > 1) {
        openSequenceModal(merged);
      } else {
        await sendWithAttachedFiles(merged);
      }
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
    const display = isUser ? doctorBubbleDisplayContent(item) : item.content;
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={styles.messageLabel}>
            {isUser ? t('education.userLabel') : t('education.assistantLabel')}
          </Text>
          <Text style={isUser ? styles.messageBodyUser : styles.messageBodyAssistant}>{display}</Text>
        </View>
        {isUser && display ? (
          <Pressable
            style={[styles.resendBtn, item.sendFailedTimeout && styles.resendBtnFailed]}
            onPress={() => void resendUserQuestion(item)}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={t('education.resendAria')}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={item.sendFailedTimeout ? '#b45309' : colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    );
  }

  const typingFooter = sending ? (
    <View style={styles.typingRow}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.typingText}>{t('education.sending')}</Text>
    </View>
  ) : null;

  function scrollChatToEnd() {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }

  function scrollPrescriptionToInput() {
    requestAnimationFrame(() => {
      prescriptionScrollRef.current?.scrollTo({ y: 140, animated: true });
    });
  }

  function onQuestionFocus() {
    scrollChatToEnd();
    setTimeout(scrollChatToEnd, 120);
    setTimeout(scrollChatToEnd, 320);
  }

  function collapseComposer() {
    setComposerExpanded(false);
    Keyboard.dismiss();
  }

  function collapsePrescriptionComposer() {
    setPrescriptionComposerExpanded(false);
    Keyboard.dismiss();
  }

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.trim());

  function renderBooksComposer() {
    return (
      <View style={styles.composer}>
        {chatError && !composerExpanded ? (
          <Text style={[sharedStyles.errorText, styles.composerError]}>{chatError}</Text>
        ) : null}
        <CollapsiblePanelHeader
          title={t('education.sendQuestion')}
          subtitle={composerExpanded ? undefined : question.trim() || t('education.questionPlaceholder')}
          expanded={composerExpanded}
          onToggle={() => {
            if (composerExpanded) collapseComposer();
            else setComposerExpanded(true);
          }}
          expandLabel={t('education.expandComposer')}
          collapseLabel={t('education.collapseComposer')}
        />
        {composerExpanded ? (
          <>
            {chatError ? <Text style={[sharedStyles.errorText, styles.composerError]}>{chatError}</Text> : null}
            {readingFile ? (
              <View style={styles.readingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.typingText}>{t('education.readingPrescription')}</Text>
              </View>
            ) : null}
            <TextInput
              ref={questionInputRef}
              style={[styles.composerInput, keyboardVisible && styles.composerInputWithKeyboard]}
              multiline
              value={question}
              onChangeText={setQuestion}
              placeholder={t('education.questionPlaceholder')}
              placeholderTextColor={colors.textMuted}
              onFocus={onQuestionFocus}
            />
            {clinicalAttachments.length > 0 ? (
              <View style={styles.attachmentChipRow}>
                {clinicalAttachments.map((file, fileIndex) => (
                  <View key={file.id} style={styles.attachmentChip}>
                    <View style={styles.attachmentOrderBadge}>
                      <Text style={styles.attachmentOrderText}>{fileIndex + 1}</Text>
                    </View>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {t('education.attachedFile', { name: file.name })}
                    </Text>
                    {clinicalAttachments.length === 1 ? (
                      <Pressable onPress={() => removeClinicalAttachment(file.id)}>
                        <Text style={styles.attachmentRemove}>{t('education.removeFile')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {clinicalAttachments.length > 1 ? (
                  <Pressable style={styles.reviewSequenceBtn} onPress={() => openSequenceModal(clinicalAttachments)}>
                    <Text style={styles.reviewSequenceText}>{t('education.reviewSequence')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.composerHint}>
              {readingFile ? (
                t('education.readingPrescription')
              ) : clinicalAttachments.length > 1 ? (
                t('education.attachmentsConfirmSequenceHint', { count: clinicalAttachments.length })
              ) : clinicalAttachments.length === 1 ? (
                t('education.attachmentsReadyHint', { count: 1 })
              ) : (
                t('education.composerHint')
              )}
              {showAutoSentNotice ? (
                <Text style={styles.autoSentNotice}> {t('education.autoSentNotice')}</Text>
              ) : null}
            </Text>
            <View style={styles.sendRow}>
              <AttachMenuButton
                disabled={sending || readingFile || clinicalAttachments.length >= MAX_CONVERSATION_ATTACHMENTS}
                onDocument={() => void ingestPrescriptionFile(pickPrescriptionFromDocuments)}
                onGallery={() => void ingestPrescriptionFile(pickPrescriptionFromGallery)}
                onCamera={() => void ingestPrescriptionFile(pickPrescriptionFromCamera)}
              />
              <Pressable
                style={[
                  sharedStyles.button,
                  styles.sendBtn,
                  { opacity: sending || readingFile || !canSendComposer() ? 0.7 : 1 }
                ]}
                onPress={() => void submitConversation()}
                disabled={sending || readingFile || !canSendComposer()}
              >
                <Text style={sharedStyles.buttonText}>
                  {sending ? t('education.sending') : t('education.sendQuestion')}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    );
  }

  if (!isDoctor) {
    return <DoctorOnlyGate />;
  }

  return (
    <View style={sharedStyles.screen}>
      <KeyboardSafeView style={styles.flex}>
      <View style={[styles.header, tab === 'books' && { paddingTop: insets.top + 6 }]}>
        {tab === 'prescription' ? (
          <Text style={sharedStyles.subtitle}>{t('education.subtitle')}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: tab === 'prescription' ? 10 : 0 }}>
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
              selectedBooks={selectedBooks}
              loading={loadingBooks}
              onChange={setSelectedBooks}
            />
            {topics.length > 0 && !keyboardVisible ? (
              <>
                <Text style={sharedStyles.label}>{t('education.quickStarts')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  {topics.map((topic) => (
                    <Pressable
                      key={topic}
                      onPress={() => {
                        setQuestion(topic);
                        setComposerExpanded(true);
                      }}
                      style={styles.topicChip}
                    >
                      <Text style={styles.topicChipText} numberOfLines={2}>
                        {topic}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </View>

          <View style={[styles.educationPanel, educationExpanded ? styles.educationPanelExpanded : styles.educationPanelCollapsed]}>
            <CollapsiblePanelHeader
              title={t('education.assistantLabel')}
              subtitle={
                messages.length > 0
                  ? t('education.messageCount', { count: messages.length })
                  : t('education.noMessagesYet')
              }
              expanded={educationExpanded}
              onToggle={() => setEducationExpanded((prev) => !prev)}
              expandLabel={t('education.expandEducationAi')}
              collapseLabel={t('education.collapseEducationAi')}
            />
            {educationExpanded ? (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                style={styles.messageList}
                contentContainerStyle={[
                  styles.messageListContent,
                  messages.length === 0 && styles.messageListContentEmpty
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
                onContentSizeChange={scrollChatToEnd}
                renderItem={renderMessage}
                ListFooterComponent={typingFooter}
                ListEmptyComponent={
                  <Text style={styles.emptyChatHint}>{t('education.booksEmptyHint')}</Text>
                }
              />
            ) : lastAssistantMessage ? (
              <Pressable
                style={styles.collapsedPreview}
                onPress={() => setEducationExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel={t('education.expandEducationAi')}
              >
                <Text style={styles.collapsedPreviewText} numberOfLines={3}>
                  {lastAssistantMessage.content}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {renderBooksComposer()}
        </View>
      ) : (
        <ScrollView
          ref={prescriptionScrollRef}
          style={sharedStyles.screenPadded}
          contentContainerStyle={{
            paddingBottom: 8 + keyboardInset
          }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={sharedStyles.subtitle}>{t('education.prescriptionBanner')}</Text>
          {readingFile ? (
            <View style={styles.readingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.typingText}>{t('education.readingPrescription')}</Text>
            </View>
          ) : null}
          <View style={styles.composer}>
            <CollapsiblePanelHeader
              title={t('education.prescriptionSearch')}
              subtitle={
                prescriptionComposerExpanded
                  ? undefined
                  : prescriptionQuery.trim() || t('education.prescriptionPlaceholder')
              }
              expanded={prescriptionComposerExpanded}
              onToggle={() => {
                if (prescriptionComposerExpanded) collapsePrescriptionComposer();
                else setPrescriptionComposerExpanded(true);
              }}
              expandLabel={t('education.expandComposer')}
              collapseLabel={t('education.collapseComposer')}
            />
            {prescriptionComposerExpanded ? (
              <>
                <TextInput
                  style={[
                    sharedStyles.input,
                    { minHeight: keyboardVisible ? 80 : 120, textAlignVertical: 'top', marginTop: 4 }
                  ]}
                  multiline
                  value={prescriptionQuery}
                  onChangeText={setPrescriptionQuery}
                  placeholder={t('education.prescriptionPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  onFocus={() => {
                    scrollPrescriptionToInput();
                    setTimeout(scrollPrescriptionToInput, 120);
                    setTimeout(scrollPrescriptionToInput, 320);
                  }}
                />
                <View style={[styles.sendRow, { marginTop: 8 }]}>
                  <AttachMenuButton
                    disabled={prescriptionLoading || readingFile}
                    onDocument={() => void ingestPrescriptionFile(pickPrescriptionFromDocuments)}
                    onGallery={() => void ingestPrescriptionFile(pickPrescriptionFromGallery)}
                    onCamera={() => void ingestPrescriptionFile(pickPrescriptionFromCamera)}
                  />
                  <Pressable
                    style={[sharedStyles.button, styles.sendBtn, { opacity: prescriptionLoading ? 0.7 : 1 }]}
                    onPress={() => void onSearchPrescriptions()}
                    disabled={prescriptionLoading || readingFile || !prescriptionQuery.trim()}
                  >
                    {prescriptionLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={sharedStyles.buttonText}>{t('education.prescriptionSearch')}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
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
      <EducationAttachmentSequenceModal
        visible={sequenceModalVisible}
        files={sequencePending}
        busy={sending || readingFile}
        onClose={closeSequenceModal}
        onConfirm={() => void confirmSequenceAndSend()}
        onMove={(index, direction) => {
          setSequencePending((prev) => moveAttachmentRows(prev, index, direction));
        }}
      />
      </KeyboardSafeView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
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
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
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
    paddingTop: 4,
    paddingBottom: 8
  },
  messageListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  emptyChatHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16
  },
  educationPanel: {
    flex: 1,
    minHeight: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background
  },
  educationPanelExpanded: {},
  educationPanelCollapsed: {},
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  panelHeaderText: {
    flex: 1,
    minWidth: 0
  },
  panelHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text
  },
  panelHeaderSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted
  },
  collapsedPreview: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface
  },
  collapsedPreviewText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text
  },
  messageRow: {
    width: '100%',
    marginBottom: 12
  },
  messageRowUser: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 8
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
    flex: 1,
    maxWidth: '82%',
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
  resendBtn: {
    width: 40,
    height: 40,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  resendBtnFailed: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb'
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
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    zIndex: 20,
    elevation: 12
  },
  composerError: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0
  },
  composerInput: {
    ...sharedStyles.input,
    minHeight: 88,
    maxHeight: 160,
    textAlignVertical: 'top',
    marginHorizontal: 16,
    marginBottom: 8
  },
  composerInputWithKeyboard: {
    minHeight: 48,
    maxHeight: 120
  },
  sendRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4
  },
  sendBtn: {
    flex: 1,
    marginBottom: 0
  },
  attachMenuAnchor: {
    position: 'relative',
    justifyContent: 'center'
  },
  attachMenuPopover: {
    position: 'absolute',
    left: 0,
    bottom: 52,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden'
  },
  attachMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border
  },
  attachMenuItemLast: {
    borderBottomWidth: 0
  },
  attachMenuLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text
  },
  plusBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background
  },
  plusBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface
  },
  plusBtnDisabled: {
    opacity: 0.6
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  attachmentChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff'
  },
  attachmentOrderBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  attachmentOrderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369a1'
  },
  attachmentName: {
    flexShrink: 1,
    fontSize: 12,
    color: '#0c4a6e',
    maxWidth: 180
  },
  attachmentRemove: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1'
  },
  reviewSequenceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    backgroundColor: '#fff'
  },
  reviewSequenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1'
  },
  composerHint: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted
  },
  autoSentNotice: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857'
  }
});
