import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AuthGate } from '@/components/AuthGate';
import { KeyboardSafeView } from '@/components/KeyboardSafeView';
import { sendAiChatMessageStreaming, type ChatTurn } from '@/features/chat/aiChatApi';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type UiMessage = { id: string; role: 'user' | 'assistant'; text: string };

const WELCOME_ID = 'welcome';

export function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const listRef = useRef<FlatList<UiMessage>>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: WELCOME_ID, role: 'assistant', text: t('chat.welcome') }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

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

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', text };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '' }]);
    setSending(true);
    scrollToEnd();
    try {
      const history: ChatTurn[] = messages
        .filter((m) => m.id !== WELCOME_ID)
        .map((m) => ({ role: m.role, content: m.text }));
      const reply = await sendAiChatMessageStreaming(text, history, {
        onDelta: (textSoFar) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: textSoFar } : m))
          );
          listRef.current?.scrollToEnd({ animated: false });
        }
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: reply } : m))
      );
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      const msg = err instanceof Error ? err.message.trim() : '';
      setError(msg || t('chat.sendError'));
    } finally {
      setSending(false);
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
            renderItem={({ item }) => (
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
                      item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant
                    ]}
                  >
                    {item.text || (item.role === 'assistant' && sending ? '…' : '')}
                  </Text>
                </View>
              </View>
            )}
          />

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}
            <View style={styles.composerRow}>
              <TextInput
                style={[styles.input, keyboardVisible && styles.inputWithKeyboard]}
                value={input}
                onChangeText={setInput}
                placeholder={t('chat.placeholder')}
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
