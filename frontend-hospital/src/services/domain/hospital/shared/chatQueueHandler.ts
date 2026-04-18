import { stompClient } from '../../../realtime/stompClient';
import { useAppStore } from '../../../../store/useAppStore';

type AppStore = ReturnType<typeof useAppStore>;

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
      let didChange = false;
      let next = existing;

        if (clientMessageId) {
        const idx = existing.findIndex((raw) => {
          const m = raw as { clientMessageId?: string; messageId?: string; status?: string };
          const existingClientMessageId = String(m?.clientMessageId ?? '').trim();
          const existingMessageId = String(m?.messageId ?? '').trim();
          return existingClientMessageId === clientMessageId && (!existingMessageId || m?.status === 'pending');
        });

        if (idx >= 0) {
          next = [...existing];
          next[idx] = {
            roomId,
            messageId,
            sequenceNumber,
            senderId,
            body,
            clientMessageId,
            createdTimestamp,
            status: 'received'
          };
          didChange = true;
        }
      }

      if (!didChange) {
        const already = messageId
          ? existing.some((m) => (m as { messageId?: string })?.messageId === messageId)
          : false;
        if (!already) {
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
