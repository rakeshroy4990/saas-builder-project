import type { ServiceDefinition } from '../../../core/types/ServiceDefinition';
import { isAxiosError } from 'axios';
import { useAppStore } from '../../../store/useAppStore';
import { useToastStore } from '../../../store/useToastStore';
import { apiClient } from '../../http/apiClient';
import { URLRegistry } from '../../http/URLRegistry';
import { stompClient } from '../../realtime/stompClient';

const asSuccess = (data: Record<string, unknown> = {}) => ({ responseCode: 'SUCCESS', ...data });

let chatSubscription: { unsubscribe: () => void } | null = null;

const demoHomeContent = {
  menu: [
    { label: 'New Arrivals' },
    { label: 'Women' },
    { label: 'Men' },
    { label: 'Accessories' },
    { label: 'Sale' }
  ],
  hero: {
    badge: 'Spring 2026 Collection',
    title: 'Comfort-first streetwear for everyday movement',
    subtitle: 'Breathable fabrics, modern fits, and fresh colors curated weekly.',
    ctaPrimary: 'Shop Women',
    ctaSecondary: 'Shop Men',
    image: 'sea_xgqlrq.jpg'
  },
  categories: [
    {
      name: 'Women',
      caption: 'Effortless everyday essentials',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Men',
      caption: 'Relaxed fits and utility layers',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Accessories',
      caption: 'Caps, bags, and daily carry',
      image: 'sea_xgqlrq.jpg'
    }
  ],
  products: [
    {
      name: 'Cloud Knit Hoodie',
      price: '$79',
      color: 'Heather Gray',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'AirFlex Cargo Pants',
      price: '$68',
      color: 'Olive',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Luna Ribbed Top',
      price: '$44',
      color: 'Ivory',
      image: 'sea_xgqlrq.jpg'
    },
    {
      name: 'Metro Trainer',
      price: '$92',
      color: 'Black / White',
      image: 'sea_xgqlrq.jpg'
    }
  ]
};

export const ecommerceServices: ServiceDefinition[] = [
  {
    packageName: 'ecommerce',
    serviceId: 'load-home-content',
    execute: async () => {
      useAppStore().setData('ecommerce', 'HomeContent', demoHomeContent);
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'load-products',
    execute: async () => {
      const store = useAppStore();
      try {
        const response = await apiClient.get(URLRegistry.paths.products);
        const payload = response.data ?? {};
        store.setData('ecommerce', 'Products', payload);
        if (!store.getData('ecommerce', 'HomeContent')) {
          store.setData('ecommerce', 'HomeContent', {
            ...demoHomeContent,
            products: payload.items ?? demoHomeContent.products
          });
        }
      } catch {
        store.setData('ecommerce', 'Products', { items: demoHomeContent.products });
        store.setData('ecommerce', 'HomeContent', demoHomeContent);
      }
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'load-cart',
    execute: async () => {
      useAppStore().setData('ecommerce', 'Cart', { cartId: 'cart-1', items: [] });
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'process-checkout',
    responseCodes: { failure: ['PAYMENT_FAILED'] },
    execute: async () => asSuccess({ orderId: 'ORD-001' })
  },
  { packageName: 'ecommerce', serviceId: 'load-product-detail', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'add-to-cart', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'update-cart-line', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'remove-cart-line', execute: async () => asSuccess() },
  { packageName: 'ecommerce', serviceId: 'load-orders', execute: async () => asSuccess() },
  {
    packageName: 'ecommerce',
    serviceId: 'chat-connect',
    execute: async () => {
      const toastStore = useToastStore();
      try {
        await stompClient.connect();

        if (!chatSubscription) {
          chatSubscription = stompClient.subscribe('/user/queue/chat', (msg) => {
            try {
              const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
              const roomId = String(event.roomId ?? '').trim();
              if (!roomId) return;

              const store = useAppStore();
              const chat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
              const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
              const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];

              const messageId = String(event.messageId ?? '').trim();
              const clientMessageId = String(event.clientMessageId ?? '').trim();

              let didChange = false;
              let next = existing;

              // Replace optimistic pending message once server ack arrives.
              if (clientMessageId) {
                const idx = existing.findIndex((m: any) => {
                  const existingClientMessageId = String(m?.clientMessageId ?? '').trim();
                  const existingMessageId = String(m?.messageId ?? '').trim();
                  return existingClientMessageId === clientMessageId && (!existingMessageId || m?.status === 'pending');
                });

                if (idx >= 0) {
                  next = [...existing];
                  next[idx] = { ...event, status: 'received' };
                  didChange = true;
                }
              }

              if (!didChange) {
                const already = messageId ? existing.some((m) => (m as any)?.messageId === messageId) : false;
                if (already) return;
                next = [...existing, { ...event, status: 'received' }];
              }

              const sorted = [...next].sort((a: any, b: any) => Number(a.sequenceNumber ?? 0) - Number(b.sequenceNumber ?? 0));
              store.setData('ecommerce', 'Chat', { ...chat, messagesByRoomId: { ...messagesByRoomId, [roomId]: sorted } });
            } catch {
              // no-op
            }
          });
        }
        return asSuccess();
      } catch {
        toastStore.show('Unable to connect to chat right now.', 'error');
        return { responseCode: 'CHAT_CONNECT_FAILED', message: 'Unable to connect to chat right now.' };
      }
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'chat-load-rooms',
    execute: async () => {
      const store = useAppStore();
      const response = await apiClient.get(URLRegistry.paths.chatRooms);
      const dataNode = (response.data?.Data ?? response.data?.data ?? []) as unknown;
      const rooms = Array.isArray(dataNode) ? dataNode : [];
      const chat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
      store.setData('ecommerce', 'Chat', { ...chat, rooms });
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'chat-open-room',
    execute: async (request) => {
      const roomId = String(request.data.roomId ?? '').trim();
      const store = useAppStore();
      if (!roomId) return { responseCode: 'CHAT_OPEN_FAILED', message: 'Missing roomId' };
      const response = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
      const dataNode = (response.data?.Data ?? response.data?.data ?? []) as unknown;
      const messages = Array.isArray(dataNode) ? dataNode : [];
      const chat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
      const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
      store.setData('ecommerce', 'Chat', {
        ...chat,
        activeRoomId: roomId,
        messagesByRoomId: { ...messagesByRoomId, [roomId]: messages }
      });
      return asSuccess();
    }
  },
  {
    packageName: 'ecommerce',
    serviceId: 'chat-start',
    execute: async (request) => {
      const toastStore = useToastStore();
      const store = useAppStore();

      const otherUserId = String(request.data?.otherUserId ?? '').trim() || 'support';
      try {
        store.setData('ecommerce', 'Chat', { ...(store.getData('ecommerce', 'Chat') ?? {}), status: 'connecting' });

        // `chat-connect` is usually executed via popup `initializeActions`, but
        // the widget can auto-start quickly. Don't block room creation on WS issues.
        try {
          await stompClient.connect();

          if (!chatSubscription) {
            chatSubscription = stompClient.subscribe('/user/queue/chat', (msg) => {
              try {
                const event = JSON.parse(String(msg.body ?? '{}')) as Record<string, unknown>;
                const roomId = String(event.roomId ?? '').trim();
                if (!roomId) return;
                const store = useAppStore();
                const chat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
                const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
                const existing = Array.isArray(messagesByRoomId[roomId]) ? (messagesByRoomId[roomId] as unknown[]) : [];

                const messageId = String(event.messageId ?? '').trim();
                const clientMessageId = String(event.clientMessageId ?? '').trim();

                let didChange = false;
                let next = existing;

                if (clientMessageId) {
                  const idx = existing.findIndex((m: any) => {
                    const existingClientMessageId = String(m?.clientMessageId ?? '').trim();
                    const existingMessageId = String(m?.messageId ?? '').trim();
                    return existingClientMessageId === clientMessageId && (!existingMessageId || m?.status === 'pending');
                  });
                  if (idx >= 0) {
                    next = [...existing];
                    next[idx] = { ...event, status: 'received' };
                    didChange = true;
                  }
                }

                if (!didChange) {
                  const already = messageId ? existing.some((m) => (m as any)?.messageId === messageId) : false;
                  if (already) return;
                  next = [...existing, { ...event, status: 'received' }];
                }

                const sorted = [...next].sort((a: any, b: any) => Number(a.sequenceNumber ?? 0) - Number(b.sequenceNumber ?? 0));
                store.setData('ecommerce', 'Chat', { ...chat, messagesByRoomId: { ...messagesByRoomId, [roomId]: sorted } });
              } catch {
                // no-op
              }
            });
          }
        } catch {
          // WS issues shouldn't prevent chat creation.
        }

        const response = await apiClient.post(URLRegistry.paths.chatDirectRoom, { otherUserId });
        const roomNode = (response.data?.Data ?? response.data?.data ?? response.data ?? {}) as Record<string, unknown>;
        const roomId = String(roomNode.id ?? roomNode.Id ?? roomNode._id ?? '').trim();

        if (!roomId) {
          const currentChat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
          store.setData('ecommerce', 'Chat', { ...currentChat, status: 'error', activeRoomId: '' });
          toastStore.show('Unable to start chat right now.', 'error');
          return { responseCode: 'CHAT_START_FAILED', message: 'Unable to start chat right now.' };
        }

        const messagesResponse = await apiClient.get(`${URLRegistry.paths.chatRooms}/${roomId}/messages`);
        const messagesNode = (messagesResponse.data?.Data ?? messagesResponse.data?.data ?? []) as unknown;
        const messages = Array.isArray(messagesNode) ? messagesNode : [];

        const chat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
        const messagesByRoomId = (chat.messagesByRoomId ?? {}) as Record<string, unknown>;
        store.setData('ecommerce', 'Chat', {
          ...chat,
          activeRoomId: roomId,
          messagesByRoomId: { ...messagesByRoomId, [roomId]: messages },
          status: 'connected'
        });

        return asSuccess({ roomId });
      } catch (err) {
        const currentChat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
        store.setData('ecommerce', 'Chat', { ...currentChat, status: 'error', activeRoomId: '' });

        if (isAxiosError(err)) {
          const status = err.response?.status;
          const serverMessage =
            String(err.response?.data?.message ?? err.response?.data?.Message ?? err.message ?? '').trim() ||
            'Unable to start chat right now.';

          // For auth failures, the API client interceptor already handles logout/redirect.
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
    packageName: 'ecommerce',
    serviceId: 'chat-send-message',
    execute: async (request) => {
      const roomId = String(request.data.roomId ?? '').trim();
      const body = String(request.data.body ?? '').trim();
      const clientMessageId = String(request.data.clientMessageId ?? crypto.randomUUID()).trim();
      if (!roomId || !body) return { responseCode: 'CHAT_SEND_FAILED', message: 'Message is empty' };
      const store = useAppStore();
      const chat = (store.getData('ecommerce', 'Chat') ?? {}) as Record<string, unknown>;
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
      store.setData('ecommerce', 'Chat', { ...chat, messagesByRoomId: { ...messagesByRoomId, [roomId]: optimistic } });

      try {
        stompClient.publish('/app/chat.send', { roomId, body, clientMessageId });
      } catch {
        await stompClient.connect();
        stompClient.publish('/app/chat.send', { roomId, body, clientMessageId });
      }
      return asSuccess({ clientMessageId });
    }
  }
];
