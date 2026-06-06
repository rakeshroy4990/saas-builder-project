import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export type HomeQuickAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  background: string;
  onPress: () => void;
};

type HomeQuickActionsProps = {
  actions: HomeQuickAction[];
};

export function HomeQuickActions({ actions }: HomeQuickActionsProps) {
  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={styles.item}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <View style={[styles.iconWrap, { backgroundColor: action.background }]}>
            <Ionicons name={action.icon} size={22} color={action.tint} />
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24
  },
  item: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center'
  }
});
