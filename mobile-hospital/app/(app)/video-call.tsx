import { useEffect, useState, type ComponentType } from 'react';

import { LoadingView } from '@/components/LoadingView';

/**
 * Route shell — video RTC runs in WebView (agora-rtc-sdk-ng), not native Agora SDK.
 */
export default function VideoCallRoute() {
  const [Screen, setScreen] = useState<ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('@/features/video/VideoCallScreen').then((mod) => {
      if (!cancelled) {
        setScreen(() => mod.VideoCallScreen);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Screen) {
    return <LoadingView />;
  }

  return <Screen />;
}
