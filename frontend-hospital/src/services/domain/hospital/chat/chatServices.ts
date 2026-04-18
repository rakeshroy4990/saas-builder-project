import type { ServiceDefinition } from '../../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../../store/useAppStore';
import { useToastStore } from '../../../../store/useToastStore';
import { pinia } from '../../../../store/pinia';
import { apiClient } from '../../../http/apiClient';
import { URLRegistry } from '../../../http/URLRegistry';
import { stompClient } from '../../../realtime/stompClient';
import { ok } from '../shared/response';
import {
  clearChatSubscription,
  clearSupportSubscription,
  dismissedSupportRequestIds,
  getChatSubscription,
  getSupportSubscription,
  setChatSubscription,
  setSupportSubscription
} from '../shared/chatState';
import { createChatQueueMessageHandler } from '../shared/chatQueueHandler';
import { flushQueuedSupportMessages } from '../shared/flushQueuedSupportMessages';

export const chatHospitalServices: ServiceDefinition[] = [
  {
    packageName: 'hospital',
    serviceId: 'chat-connect',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);
      const authSession = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<string, unknown>;
      const currentRole = String(authSession.role ?? '').trim().toUpperCase();
      const isAdmin = currentRole === 'ADMIN';
      appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'connecting' });
      let wsConnected = false;
      try {
        await stompClient.connect();
        wsConnected = true;
      } catch {
        wsConnected = false;
      }
      try {
        if (!getChatSubscription()) {
          if (wsConnected) {
            setChatSubscription(stompClient.subscribe('/user/queue/chat', createChatQueueMessageHandler(appStore)));
          }
        }

        if (!getSupportSubscription()) {
          if (wsConnected) {
            setSupportSubscription(
              stompClient.subscribe('/user/queue/support', async (msg) => {
                try {
                  const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
                  const type = String(event.type ?? '').trim();
                  if (!type) return;

                  const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;

                  if (type === 'support_request_created') {
                    if (!isAdmin) return;
                    const requestId = String(event.requestId ?? '').trim();
                    const requesterUserId = String(event.requesterUserId ?? '').trim();
                    const requesterDisplayName = String(event.requesterDisplayName ?? '').trim();
                    if (!requestId || !requesterUserId) return;
                    if (dismissedSupportRequestIds.has(requestId)) return;
                    const existing = Array.isArray(chat.supportRequests) ? (chat.supportRequests as unknown[]) : [];
                    const already = existing.some((raw) => {
                      const r = raw as { requestId?: string; id?: string };
                      return String(r?.requestId ?? r?.id ?? '') === requestId;
                    });
                    if (already) return;
                    appStore.setData('hospital', 'Chat', {
                      ...chat,
                      supportRequests: [{ requestId, requesterUserId, requesterDisplayName }, ...existing].slice(0, 20)
                    });
                    return;
                  }

                  if (type === 'support_request_assigned') {
                    const roomId = String(event.roomId ?? '').trim();
                    const requestId = String(event.requestId ?? '').trim();
                    const assignedAgentUserId = String(event.assignedAgentUserId ?? '').trim();
                    if (!roomId) return;
                    if (requestId) dismissedSupportRequestIds.delete(requestId);

                    const existing = Array.isArray(chat.supportRequests)
                      ? (chat.supportRequests as { requestId?: string; id?: string }[])
                      : [];
                    const remaining = requestId
                      ? existing.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId)
                      : existing;
                    const authSessionInner = (appStore.getData('hospital', 'AuthSession') ?? {}) as Record<
                      string,
                      unknown
                    >;
                    const myUserId = String(authSessionInner.userId ?? '').trim();
                    const isAssignedAgent = assignedAgentUserId && myUserId && assignedAgentUserId === myUserId;
                    const isRequester = requestId && String(chat.supportRequestId ?? '').trim() === requestId;

                    if (!isAssignedAgent && !isRequester) {
                      appStore.setData('hospital', 'Chat', { ...chat, supportRequests: remaining });
                      return;
                    }

                    const messagesResponse = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
                    const messagesNode = (messagesResponse.data?.Data ?? messagesResponse.data?.data ?? []) as unknown;
                    const messages = Array.isArray(messagesNode) ? messagesNode : [];
                    const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;

                    appStore.setData('hospital', 'Chat', {
                      ...chat,
                      status: 'connected',
                      activeRoomId: roomId,
                      supportRequests: remaining,
                      messagesByRoomId: { ...messagesByRoomId, [roomId]: messages }
                    });

                    await flushQueuedSupportMessages(roomId, appStore);
                    return;
                  }

                  if (type === 'support_request_closed') {
                    const requestId = String(event.requestId ?? '').trim();
                    if (!requestId) return;
                    dismissedSupportRequestIds.delete(requestId);
                    const existingClosed = Array.isArray(chat.supportRequests)
                      ? (chat.supportRequests as { requestId?: string; id?: string }[])
                      : [];
                    const remainingClosed = existingClosed.filter(
                      (r) => String(r?.requestId ?? r?.id ?? '') !== requestId
                    );
                    appStore.setData('hospital', 'Chat', { ...chat, supportRequests: remainingClosed });
                  }
                } catch {
                  // no-op
                }
              })
            );
          }
        }

        if (isAdmin) {
          try {
            const openResponse = await apiClient.get(URLRegistry.paths.chatSupportOpen);
            const openNode = (openResponse.data?.Data ?? openResponse.data?.data ?? []) as unknown;
            const openRequests = Array.isArray(openNode) ? openNode : [];
            const normalized = openRequests
              .map((entry) => {
                const row = (entry ?? {}) as Record<string, unknown>;
                const requestId = String(
                  row.id ?? row.Id ?? row._id ?? row.requestId ?? row['request_id'] ?? ''
                ).trim();
                const requesterUserId = String(
                  row.requesterUserId ?? row.RequesterUserId ?? row['requester_user_id'] ?? ''
                ).trim();
                const requesterDisplayName = String(
                  row.requesterDisplayName ?? row.RequesterDisplayName ?? row['requester_display_name'] ?? ''
                ).trim();
                if (!requestId || !requesterUserId) return null;
                if (dismissedSupportRequestIds.has(requestId)) return null;
                return { requestId, requesterUserId, requesterDisplayName };
              })
              .filter(
                (value): value is { requestId: string; requesterUserId: string; requesterDisplayName: string } =>
                  value !== null
              );

            if (normalized.length > 0) {
              const latestChat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
              const existing = Array.isArray(latestChat.supportRequests) ? (latestChat.supportRequests as unknown[]) : [];
              const seen = new Set<string>();
              const merged = [...normalized, ...existing]
                .map((item) => {
                  const row = (item ?? {}) as Record<string, unknown>;
                  const requestId = String(row.requestId ?? row.id ?? '').trim();
                  const requesterUserId = String(row.requesterUserId ?? '').trim();
                  const requesterDisplayName = String(row.requesterDisplayName ?? '').trim();
                  if (!requestId || !requesterUserId) return null;
                  if (seen.has(requestId)) return null;
                  seen.add(requestId);
                  return { requestId, requesterUserId, requesterDisplayName };
                })
                .filter(
                  (value): value is { requestId: string; requesterUserId: string; requesterDisplayName: string } =>
                    value !== null
                )
                .slice(0, 20);

              appStore.setData('hospital', 'Chat', { ...latestChat, supportRequests: merged });
            }
          } catch {
            // no-op: live websocket events still update support requests
          }
        } else {
          const latestChat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
          appStore.setData('hospital', 'Chat', { ...latestChat, supportRequests: [] });
        }

        appStore.setData('hospital', 'Chat', {
          ...(appStore.getData('hospital', 'Chat') as object),
          status: 'connected'
        });
        return ok();
      } catch {
        if (!wsConnected) {
          appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'connected' });
          return ok({ degraded: true });
        }
        toastStore.show('Unable to connect to chat right now.', 'error');
        appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'error' });
        return { responseCode: 'CHAT_CONNECT_FAILED', message: 'Unable to connect to chat right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-disconnect',
    execute: async () => {
      clearChatSubscription();
      clearSupportSubscription();
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-load-rooms',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const response = await apiClient.get(URLRegistry.paths.chatRooms);
      const dataNode = (response.data?.Data ?? response.data?.data ?? []) as unknown;
      const rooms = Array.isArray(dataNode) ? dataNode : [];
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'Chat', { ...chat, rooms });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-open-room',
    execute: async (request) => {
      const roomId = String(request.data.roomId ?? '').trim();
      const appStore = useAppStore(pinia);
      if (!roomId) return { responseCode: 'CHAT_OPEN_FAILED', message: 'Missing roomId' };
      const response = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
      const dataNode = (response.data?.Data ?? response.data?.data ?? []) as unknown;
      const messages = Array.isArray(dataNode) ? dataNode : [];
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
      appStore.setData('hospital', 'Chat', {
        ...chat,
        activeRoomId: roomId,
        messagesByRoomId: { ...messagesByRoomId, [roomId]: messages }
      });
      return ok();
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-start',
    execute: async () => {
      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);

      try {
        appStore.setData('hospital', 'Chat', { ...(appStore.getData('hospital', 'Chat') as object), status: 'starting' });

        try {
          await stompClient.connect();

          if (!getChatSubscription()) {
            setChatSubscription(stompClient.subscribe('/user/queue/chat', createChatQueueMessageHandler(appStore)));
          }
        } catch {
          // WS connect/subscribe failed; still proceed to create/load the direct room.
        }

        const response = await apiClient.post(URLRegistry.paths.chatSupportRequest, {});
        const dataNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const requestId = String(dataNode.id ?? dataNode.Id ?? '').trim();
        const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
        appStore.setData('hospital', 'Chat', {
          ...chat,
          status: 'waiting_for_admin',
          activeRoomId: '',
          supportRequestId: requestId
        });

        try {
          await stompClient.connect();
        } catch {
          // no-op
        }

        return ok({ requestId });
      } catch (err) {
        const currentChat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
        appStore.setData('hospital', 'Chat', { ...currentChat, status: 'error', activeRoomId: '' });

        if (isAxiosError(err)) {
          const status = err.response?.status;
          const serverMessage =
            String(err.response?.data?.message ?? err.response?.data?.Message ?? err.message ?? '').trim() ||
            'Unable to start chat right now.';

          if (status === 401 || status === 403) {
            return { responseCode: 'CHAT_START_AUTH_FAILED', message: serverMessage };
          }

          toastStore.show(serverMessage, 'error');
          return { responseCode: 'CHAT_START_FAILED', message: serverMessage };
        }

        toastStore.show('Unable to start chat right now.', 'error');
        return { responseCode: 'CHAT_START_FAILED', message: 'Unable to start chat right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-send-message',
    execute: async (request) => {
      const roomId = String(request.data.roomId ?? '').trim();
      const body = String(request.data.body ?? '').trim();
      const clientMessageId = String(request.data.clientMessageId ?? crypto.randomUUID()).trim();
      if (!body) return { responseCode: 'CHAT_SEND_FAILED', message: 'Message is empty' };

      const appStore = useAppStore(pinia);
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;

      if (!roomId) {
        const status = String(chat.status ?? '').trim();
        const canQueue = status === 'waiting_for_admin' || status === 'starting' || status === 'connecting';
        if (!canQueue) {
          return { responseCode: 'CHAT_SEND_FAILED', message: 'Chat is not connected yet' };
        }

        const pending = Array.isArray(chat.pendingMessages) ? (chat.pendingMessages as unknown[]) : [];
        const queued = [
          ...pending,
          {
            body,
            clientMessageId,
            createdTimestamp: new Date().toISOString(),
            status: 'queued'
          }
        ];
        appStore.setData('hospital', 'Chat', { ...chat, pendingMessages: queued });
        return ok({ clientMessageId, queued: true });
      }

      const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
      const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];
      const optimistic = [
        ...existing,
        {
          roomId,
          messageId: '',
          sequenceNumber: 0,
          senderId: 'me',
          body,
          clientMessageId,
          createdTimestamp: new Date().toISOString(),
          status: 'pending'
        }
      ];
      appStore.setData('hospital', 'Chat', {
        ...chat,
        messagesByRoomId: { ...messagesByRoomId, [roomId]: optimistic }
      });
      try {
        stompClient.publish('/app/chat.send', { roomId, body, clientMessageId });
      } catch {
        await stompClient.connect();
        stompClient.publish('/app/chat.send', { roomId, body, clientMessageId });
      }
      return ok({ clientMessageId });
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-support-accept',
    execute: async (request) => {
      const requestId = String(request.data?.requestId ?? '').trim();
      if (!requestId) return { responseCode: 'CHAT_SUPPORT_ACCEPT_FAILED', message: 'Missing requestId' };

      const appStore = useAppStore(pinia);
      const toastStore = useToastStore(pinia);

      try {
        const response = await apiClient.post(URLRegistry.paths.chatSupportAccept, { requestId });
        const roomNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const roomId = String(roomNode.id ?? roomNode.Id ?? roomNode._id ?? '').trim();
        if (!roomId) {
          toastStore.show('Unable to accept chat right now.', 'error');
          return { responseCode: 'CHAT_SUPPORT_ACCEPT_FAILED', message: 'Unable to accept chat right now.' };
        }

        const messagesResponse = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
        const messagesNode = (messagesResponse.data?.Data ?? messagesResponse.data?.data ?? []) as unknown;
        const messages = Array.isArray(messagesNode) ? messagesNode : [];

        const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
        const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
        const existingReqs = Array.isArray(chat.supportRequests)
          ? (chat.supportRequests as { requestId?: string; id?: string }[])
          : [];
        const remaining = existingReqs.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId);

        appStore.setData('hospital', 'Chat', {
          ...chat,
          status: 'connected',
          activeRoomId: roomId,
          supportRequests: remaining,
          messagesByRoomId: { ...messagesByRoomId, [roomId]: messages }
        });

        await flushQueuedSupportMessages(roomId, appStore);

        return ok({ roomId });
      } catch {
        toastStore.show('Unable to accept chat right now.', 'error');
        return { responseCode: 'CHAT_SUPPORT_ACCEPT_FAILED', message: 'Unable to accept chat right now.' };
      }
    }
  },
  {
    packageName: 'hospital',
    serviceId: 'chat-support-reject',
    execute: async (request) => {
      const requestId = String(request.data?.requestId ?? '').trim();
      if (!requestId) return { responseCode: 'CHAT_SUPPORT_REJECT_FAILED', message: 'Missing requestId' };

      const appStore = useAppStore(pinia);
      dismissedSupportRequestIds.add(requestId);
      const chat = (appStore.getData('hospital', 'Chat') ?? {}) as Record<string, unknown>;
      const existingReqs = Array.isArray(chat.supportRequests)
        ? (chat.supportRequests as { requestId?: string; id?: string }[])
        : [];
      const remaining = existingReqs.filter((r) => String(r?.requestId ?? r?.id ?? '') !== requestId);
      appStore.setData('hospital', 'Chat', { ...chat, supportRequests: remaining });

      try {
        await apiClient.post(URLRegistry.paths.chatSupportReject, { requestId });
        return ok({ requestId });
      } catch {
        return ok({ requestId, pendingServerSync: true });
      }
    }
  }
];
