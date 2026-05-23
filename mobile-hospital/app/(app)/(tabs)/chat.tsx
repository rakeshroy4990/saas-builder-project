import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import { sendAiChatMessage, type ChatTurn } from '@/features/chat/aiChatApi';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type UiMessage = { id: string; role: 'user' | 'assistant'; text: string };

const WELCOME_ID = 'welcome';

export default function ChatTab() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: WELCOME_ID, role: 'assistant', text: t('chat.welcome') }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setError('');
    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const history: ChatTurn[] = messages
        .filter((m) => m.id !== WELCOME_ID)
        .map((m) => ({ role: m.role, content: m.text }));
      const reply = await sendAiChatMessage(text, history);
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: reply }]);
    } catch {
      setError(t('chat.sendError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthGate>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: item.role === 'user' ? '88%' : '100%',
                width: item.role === 'assistant' ? '100%' : undefined,
                marginBottom: 10,
                backgroundColor: item.role === 'user' ? colors.primary : colors.surface,
                borderRadius: 14,
                padding: 12,
                borderWidth: item.role === 'user' ? 0 : 1,
                borderColor: colors.border
              }}
            >
              <Text
                style={{
                  color: item.role === 'user' ? '#fff' : colors.text,
                  fontSize: item.role === 'assistant' ? 16 : 15,
                  lineHeight: item.role === 'assistant' ? 24 : 22
                }}
              >
                {item.text}
              </Text>
            </View>
          )}
        />
        {error ? <Text style={[sharedStyles.errorText, { paddingHorizontal: 16 }]}>{error}</Text> : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface
          }}
        >
          <TextInput
            style={[sharedStyles.input, { flex: 1, marginBottom: 0 }]}
            value={input}
            onChangeText={setInput}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            style={[sharedStyles.button, { paddingHorizontal: 16, minWidth: 72, opacity: sending ? 0.6 : 1 }]}
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
      </KeyboardAvoidingView>
    </AuthGate>
  );
}
