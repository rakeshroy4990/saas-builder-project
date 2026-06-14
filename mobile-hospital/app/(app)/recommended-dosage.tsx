import { Redirect, Stack } from 'expo-router';

import { AuthGate } from '@/components/AuthGate';
import { useSessionStore } from '@/auth/sessionStore';
import { DoctorRecommendedDosageScreen } from '@/features/prescriptionSafety/DoctorRecommendedDosageScreen';

function isDoctorRole(role: string): boolean {
  const normalized = role.trim().toUpperCase();
  return normalized === 'DOCTOR' || normalized === 'ADMIN';
}

export default function RecommendedDosageRoute() {
  const role = String(useSessionStore((s) => s.user?.role ?? '')).toUpperCase();

  return (
    <AuthGate>
      <Stack.Screen options={{ title: 'Recommended Dosage' }} />
      {isDoctorRole(role) ? (
        <DoctorRecommendedDosageScreen />
      ) : (
        <Redirect href={'/(app)/(tabs)/home' as never} />
      )}
    </AuthGate>
  );
}
