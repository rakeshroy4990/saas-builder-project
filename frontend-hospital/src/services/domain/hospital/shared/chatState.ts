let chatSubscription: { unsubscribe: () => void } | null = null;
let supportSubscription: { unsubscribe: () => void } | null = null;

export const dismissedSupportRequestIds = new Set<string>();

export function getChatSubscription(): { unsubscribe: () => void } | null {
  return chatSubscription;
}

export function setChatSubscription(sub: { unsubscribe: () => void } | null): void {
  chatSubscription = sub;
}

export function clearChatSubscription(): void {
  if (chatSubscription) {
    chatSubscription.unsubscribe();
    chatSubscription = null;
  }
}

export function getSupportSubscription(): { unsubscribe: () => void } | null {
  return supportSubscription;
}

export function setSupportSubscription(sub: { unsubscribe: () => void } | null): void {
  supportSubscription = sub;
}

export function clearSupportSubscription(): void {
  if (supportSubscription) {
    supportSubscription.unsubscribe();
    supportSubscription = null;
  }
}
