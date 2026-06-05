import { create } from 'zustand';

type NetworkState = {
  /** True when the device has no connection or internet is explicitly unreachable. */
  isOffline: boolean;
  setOffline: (value: boolean) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  isOffline: false,
  setOffline: (isOffline) => set({ isOffline })
}));
