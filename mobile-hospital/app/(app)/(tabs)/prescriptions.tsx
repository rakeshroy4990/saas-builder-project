import { AuthGate } from '@/components/AuthGate';
import { PrescriptionsScreen } from '@/features/prescriptions/PrescriptionsScreen';

export default function PrescriptionsTab() {
  return (
    <AuthGate>
      <PrescriptionsScreen />
    </AuthGate>
  );
}
