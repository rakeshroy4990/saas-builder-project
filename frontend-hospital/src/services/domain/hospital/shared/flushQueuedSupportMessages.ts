import { stompClient } from '../../../realtime/stompClient';
import { useAppStore } from '../../../../store/useAppStore';

type AppStore = ReturnType<typeof useAppStore>;

export async function flushQueuedSupportMessages(roomId: string, appStore: AppStore): Promise<void> {
  const targetRoomId = String(roomId ?? '').trim();
  if (!targetRoomId) return;

  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
  const queued = Array.isArray(chat.pendingMessages) ? (chat.pendingMessages as unknown[]) : [];
  if (queued.length === 0) return;

  const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
  const existing = Array.isArray(messagesByRoomId[targetRoomId])
    ? (messagesByRoomId[targetRoomId] as unknown[])
    : [];

  const optimisticQueued = queued.map((raw) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const body = String(entry.body ?? '').trim();
    const clientMessageId = String(entry.clientMessageId ?? crypto.randomUUID()).trim();
    return {
      roomId: targetRoomId,
      messageId: '',
      sequenceNumber: 0,
      senderId: 'me',
      body,
      clientMessageId,
      createdTimestamp: String(entry.createdTimestamp ?? new Date().toISOString()),
      status: 'pending'
    };
  });

  appStore.setData('hospital', 'Chat', {
    ...chat,
    pendingMessages: [],
    messagesByRoomId: { ...messagesByRoomId, [targetRoomId]: [...existing, ...optimisticQueued] }
  });

  for (const item of optimisticQueued) {
    try {
      stompClient.publish('/app/chat.send', {
        roomId: targetRoomId,
        body: item.body,
        clientMessageId: item.clientMessageId
      });
    } catch {
      await stompClient.connect();
      stompClient.publish('/app/chat.send', {
        roomId: targetRoomId,
        body: item.body,
        clientMessageId: item.clientMessageId
      });
    }
  }
}
