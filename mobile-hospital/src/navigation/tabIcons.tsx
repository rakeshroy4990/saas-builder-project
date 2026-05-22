import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { colors } from '@/theme/colors';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function tabIcon(name: IconName, focused: boolean) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={focused ? colors.primary : colors.textMuted}
    />
  );
}
