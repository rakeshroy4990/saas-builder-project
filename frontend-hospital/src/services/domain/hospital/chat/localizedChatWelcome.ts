import type { Composer } from 'vue-i18n';
import { useAppStore } from '../../../../store/useAppStore';
import { pinia } from '../../../../store/pinia';

const SMART_AI_ROOM_ID = 'smart-ai';

/** Re-translates the Smart AI welcome bubble when the UI language changes. */
export function refreshHospitalLocalizedChatWelcome(composer: Composer): void {
  const appStore = useAppStore(pinia);
  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
  const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(messagesByRoomId[SMART_AI_ROOM_ID])
    ? (messagesByRoomId[SMART_AI_ROOM_ID] as unknown[])
    : [];
  if (existing.length === 0) return;

  let changed = false;
  const welcome = composer.t('chat.widget.welcomeMessage');
  const nextMessages = existing.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const isWelcome =
      String(row.kind ?? '').trim() === 'welcome' ||
      (String(row.senderId ?? '').trim().toLowerCase() === 'ai' &&
        (String(row.body ?? '').includes('Hi 👋') ||
          String(row.body ?? '').includes('I’m here to help') ||
          String(row.body ?? '').includes("I'm here to help") ||
          String(row.body ?? '').includes('मदद के लिए यहाँ')));
    if (!isWelcome) return row;
    if (String(row.body ?? '') === welcome) return row;
    changed = true;
    return { ...row, kind: 'welcome', body: welcome };
  });
  if (!changed) return;

  appStore.setData('hospital', 'Chat', {
    ...chat,
    messagesByRoomId: { ...messagesByRoomId, [SMART_AI_ROOM_ID]: nextMessages }
  });
}
