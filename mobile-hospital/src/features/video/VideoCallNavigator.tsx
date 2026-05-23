import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useVideoCallStore } from './videoCallStore';

/**
 * Navigates to the full-screen call UI when an inbound STOMP invite arrives.
 */
export function VideoCallNavigator() {
  const router = useRouter();
  const incomingRing = useVideoCallStore((s) => s.incomingRing);
  const callId = useVideoCallStore((s) => s.callId);
  const navigatedRef = useRef<string>('');

  useEffect(() => {
    if (!incomingRing || !callId) return;
    if (navigatedRef.current === callId) return;
    navigatedRef.current = callId;
    router.push('/(app)/video-call' as never);
  }, [incomingRing, callId, router]);

  return null;
}
