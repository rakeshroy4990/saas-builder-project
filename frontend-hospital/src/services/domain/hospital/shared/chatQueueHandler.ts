import { stompClient } from '../../../realtime/stompClient';
import { useAppStore } from '../../../../store/useAppStore';

type AppStore = ReturnType<typeof useAppStore>;

function resolveMessageId(row: Record<string, unknown>): string {
  return String(row.messageId ?? row.id ?? row.Id ?? row._id ?? '').trim();
}

function findExistingMessageIndex(
  existing: unknown[],
  clientMessageId: string,
  messageId: string
): number {
  return existing.findIndex((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const existingClientMessageId = String(row.clientMessageId ?? '').trim();
    const existingMessageId = resolveMessageId(row);
    if (clientMessageId && existingClientMessageId === clientMessageId) return true;
    if (messageId && existingMessageId === messageId) return true;
    return false;
  });
}

/** STOMP `/user/queue/chat` handler shared by `chat-connect` and `chat-start`. */
export function createChatQueueMessageHandler(appStore: AppStore) {
  return (msg: { body?: string }) => {
    try {
      const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
      const roomId = String(event.roomId ?? '').trim();
      if (!roomId) return;
      const messageId = String(event.messageId ?? '').trim();
      const sequenceNumber = Number(event.sequenceNumber ?? 0);
      const senderId = String(event.senderId ?? '').trim();
      const body = String(event.body ?? '');
      const clientMessageId = String(event.clientMessageId ?? '').trim();
      const createdTimestamp = String(event.createdTimestamp ?? '');

      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];
      const idx = findExistingMessageIndex(existing, clientMessageId, messageId);
      let didChange = false;
      let next = existing;

      if (idx >= 0) {
        const prior = (existing[idx] ?? {}) as Record<string, unknown>;
        next = [...existing];
        next[idx] = {
          ...prior,
          roomId,
          messageId: messageId || resolveMessageId(prior),
          sequenceNumber: sequenceNumber || Number(prior.sequenceNumber ?? 0),
          senderId: senderId || String(prior.senderId ?? '').trim(),
          body,
          clientMessageId: clientMessageId || String(prior.clientMessageId ?? '').trim(),
          createdTimestamp: createdTimestamp || String(prior.createdTimestamp ?? '').trim(),
          status: 'received'
        };
        didChange = true;
      } else {
        next = [
          ...existing,
          {
            roomId,
            messageId,
            sequenceNumber,
            senderId,
            body,
            clientMessageId,
            createdTimestamp,
            status: 'received'
          }
        ];
        didChange = true;
      }

      if (didChange) {
        next = [...next].sort((a, b) => {
          const left = a as { sequenceNumber?: number };
          const right = b as { sequenceNumber?: number };
          return Number(left.sequenceNumber ?? 0) - Number(right.sequenceNumber ?? 0);
        });
        appStore.setData('hospital', 'Chat', {
          ...chat,
          status: 'connected',
          messagesByRoomId: { ...messagesByRoomId, [roomId]: next }
        });
      }
      if (sequenceNumber > 0) {
        const lastAcked = (chat.lastAckedSequenceByRoomId ?? {}) as Record<string, unknown>;
        const prior = Number(lastAcked[roomId] ?? 0);
        const upTo = Math.max(prior, sequenceNumber);
        appStore.setData('hospital', 'Chat', {
          ...(appStore.getData('hospital', 'Chat') as object),
          lastAckedSequenceByRoomId: { ...lastAcked, [roomId]: upTo }
        });
        stompClient.publish('/app/chat.ack', { roomId, upToSequenceNumber: upTo });
      }
    } catch {
      // no-op
    }
  };
}
