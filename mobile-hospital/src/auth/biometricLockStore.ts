import { create } from 'zustand';

import { getBiometricLockEnabled, isBiometricHardwareAvailable } from '@/auth/biometricPreferences';

interface BiometricLockState {
  enabled: boolean;
  syncFromStorage: () => Promise<void>;
  setEnabled: (value: boolean) => void;
}

export const useBiometricLockStore = create<BiometricLockState>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  syncFromStorage: async () => {
    const [pref, hardware] = await Promise.all([
      getBiometricLockEnabled(),
      isBiometricHardwareAvailable()
    ]);
    set({ enabled: pref && hardware });
  }
}));
