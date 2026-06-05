import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';

import { useNetworkStore } from '@/network/networkStore';

function computeOffline(state: NetInfoState): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/** Subscribes to NetInfo and updates {@link useNetworkStore}. */
export function useNetworkSync(): void {
  const setOffline = useNetworkStore((s) => s.setOffline);

  useEffect(() => {
    const apply = (state: NetInfoState) => setOffline(computeOffline(state));

    const unsubscribe = NetInfo.addEventListener(apply);
    void NetInfo.fetch().then(apply);

    return unsubscribe;
  }, [setOffline]);
}
