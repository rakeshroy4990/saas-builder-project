import { create } from 'zustand';

import { getBiometricLockEnabled, isBiometricHardwareAvailable } from '@/auth/biometricPreferences';

const UNLOCK_GRACE_MS = 4000;

interface BiometricLockState {
  enabled: boolean;
  unlockGraceUntilMs: number;
  syncFromStorage: () => Promise<void>;
  setEnabled: (value: boolean) => void;
  grantUnlockGrace: () => void;
  isWithinUnlockGrace: () => boolean;
}

export const useBiometricLockStore = create<BiometricLockState>((set, get) => ({
  enabled: false,
  unlockGraceUntilMs: 0,
  grantUnlockGrace: () => set({ unlockGraceUntilMs: Date.now() + UNLOCK_GRACE_MS }),
  isWithinUnlockGrace: () => Date.now() < get().unlockGraceUntilMs,
  setEnabled: (enabled) => set({ enabled }),
  syncFromStorage: async () => {
    const [pref, hardware] = await Promise.all([
      getBiometricLockEnabled(),
      isBiometricHardwareAvailable()
    ]);
    set({ enabled: pref && hardware });
  }
}));
