import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LOCALE_CONFIG } from '@saas-builder/i18n-contract';

import { AuthGate } from '@/components/AuthGate';
import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { sendAiChatMessageStreaming, type ChatTurn } from '@/features/chat/aiChatApi';
import {
  detectScriptLocale,
  localeBadgeLabel,
  messageFontFamily
} from '@/features/chat/chatLocale';
import { activeMobileLocale } from '@/i18n/locale';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  detectedLocale?: string;
  answerEnglish?: string;
  showTranslationToggle?: boolean;
  showEnglishTranslation?: boolean;
  emergencyCall108?: boolean;
};

const WELCOME_ID = 'welcome';

export function ChatScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const listRef = useRef<FlatList<UiMessage>>(null);
  const activeLocale = activeMobileLocale();
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: WELCOME_ID, role: 'assistant', text: '' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [statusPhase, setStatusPhase] = useState('');
  const [error, setError] = useState('');
  const [scriptHint, setScriptHint] = useState('');

  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => (m.id === WELCOME_ID ? { ...m, text: t('chat.welcome') } : m))
    );
  }, [activeLocale, t]);

  const inputPlaceholder = useMemo(() => {
    if (activeLocale === 'hi') return t('chat.placeholderHi');
    if (activeLocale === 'kn') return t('chat.placeholderKn');
    return t('chat.placeholder');
  }, [activeLocale, t]);

  function scrollToEnd() {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }

  function onClose() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(app)/(tabs)/home' as never);
  }

  function onInputChange(text: string) {
    setInput(text);
    if (activeLocale !== 'en') {
      setScriptHint('');
      return;
    }
    const scriptLocale = detectScriptLocale(text);
    if (scriptLocale) {
      setScriptHint(
        t('chat.scriptDetectToast', { language: LOCALE_CONFIG[scriptLocale].englishLabel })
      );
      return;
    }
    setScriptHint('');
  }

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    setStatusPhase('');
    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', text };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '' }]);
    setSending(true);
    scrollToEnd();
    try {
      const history: ChatTurn[] = messages
        .filter((m) => m.id !== WELCOME_ID)
        .map((m) => ({ role: m.role, content: m.text }));
      const { reply, metadata } = await sendAiChatMessageStreaming(text, history, {
        onStatus: (phase) => {
          setStatusPhase(phase);
          if (activeLocale !== 'en' && (phase === 'translating' || phase === 'generating')) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: t('chat.translatingQuestion') } : m
              )
            );
          }
        },
        onDelta: (textSoFar) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: textSoFar } : m))
          );
          listRef.current?.scrollToEnd({ animated: false });
        }
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: reply,
                detectedLocale: metadata.detectedLocale,
                answerEnglish: metadata.answerEnglish,
                showTranslationToggle: metadata.showTranslationToggle,
                emergencyCall108: metadata.emergencyCall108
              }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      const msg = err instanceof Error ? err.message.trim() : '';
      setError(msg || t('chat.sendError'));
    } finally {
      setSending(false);
      setStatusPhase('');
    }
  }

  return (
    <AuthGate>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <KeyboardSafeView style={styles.flex}>
          <View style={styles.topBar}>
            <Pressable
              onPress={onClose}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('education.exitFullScreen')}
            >
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.topTitle}>{t('nav.chat')}</Text>
            <View style={styles.iconBtn} />
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets
            onContentSizeChange={scrollToEnd}
            renderItem={({ item }) => {
              const displayText =
                item.showEnglishTranslation && item.answerEnglish ? item.answerEnglish : item.text;
              const bubbleLocale =
                item.role === 'user'
                  ? detectScriptLocale(item.text) ?? activeLocale
                  : item.detectedLocale;
              const fontFamily = messageFontFamily(bubbleLocale);
              const badge = item.role === 'assistant' ? localeBadgeLabel(item.detectedLocale) : '';
              return (
                <View
                  style={[
                    styles.bubbleWrap,
                    item.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapAssistant
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                        fontFamily ? { fontFamily } : null
                      ]}
                    >
                      {displayText || (item.role === 'assistant' && sending ? t('chat.translating') : '')}
                    </Text>
                    {badge ? <Text style={styles.localeBadge}>{badge}</Text> : null}
                    {item.showTranslationToggle && item.answerEnglish ? (
                      <Pressable
                        onPress={() =>
                          setMessages((prev) =>
                            prev.map((m) =>
                              m.id === item.id
                                ? { ...m, showEnglishTranslation: !m.showEnglishTranslation }
                                : m
                            )
                          )
                        }
                      >
                        <Text style={styles.seeEnglish}>{t('chat.seeInEnglish')}</Text>
                      </Pressable>
                    ) : null}
                    {item.emergencyCall108 ? (
                      <Pressable style={styles.call108} onPress={() => void Linking.openURL('tel:108')}>
                        <Text style={styles.call108Text}>{t('chat.call108')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            }}
          />

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}
            {scriptHint ? <Text style={styles.scriptHint}>{scriptHint}</Text> : null}
            {sending && statusPhase ? (
              <Text style={styles.statusText}>
                {statusPhase === 'translating' ? t('chat.translatingQuestion') : t('chat.translating')}
              </Text>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                style={[
                  styles.input,
                  keyboardVisible && styles.inputWithKeyboard,
                  messageFontFamily(activeLocale) ? { fontFamily: messageFontFamily(activeLocale) } : null
                ]}
                value={input}
                onChangeText={onInputChange}
                placeholder={inputPlaceholder}
                placeholderTextColor={colors.textMuted}
                multiline
                onFocus={scrollToEnd}
              />
              <Pressable
                style={[sharedStyles.button, styles.sendBtn, { opacity: sending ? 0.6 : 1 }]}
                onPress={() => void onSend()}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={sharedStyles.buttonText}>{t('chat.send')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardSafeView>
      </View>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  flex: {
    flex: 1
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    flexGrow: 1
  },
  bubbleWrap: {
    width: '100%',
    marginBottom: 12
  },
  bubbleWrapUser: {
    alignItems: 'flex-end'
  },
  bubbleWrapAssistant: {
    alignItems: 'flex-start'
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '88%'
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderWidth: 0
  },
  bubbleAssistant: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: colors.surface
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 24
  },
  bubbleTextUser: {
    color: '#fff'
  },
  bubbleTextAssistant: {
    color: colors.text
  },
  seeEnglish: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textDecorationLine: 'underline'
  },
  localeBadge: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted
  },
  scriptHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
    lineHeight: 18
  },
  call108: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  call108Text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  statusText: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4
  },
  input: {
    ...sharedStyles.input,
    flex: 1,
    marginBottom: 0,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top'
  },
  inputWithKeyboard: {
    minHeight: 48,
    maxHeight: 120
  },
  sendBtn: {
    paddingHorizontal: 16,
    minWidth: 72,
    marginBottom: 0
  }
});
