import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { SECTION_GAP } from '@/theme/layout';

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
  /** Two-column grid for four doctor shortcuts; default is a single row. */
  layout?: 'row' | 'grid';
};

export function HomeQuickActions({ actions, layout = 'row' }: HomeQuickActionsProps) {
  const isGrid = layout === 'grid';

  return (
    <View style={[styles.grid, isGrid && styles.gridTwoCol]}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={[styles.item, isGrid && styles.itemGrid]}
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
    marginBottom: SECTION_GAP
  },
  gridTwoCol: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  item: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0
  },
  itemGrid: {
    flexGrow: 0,
    flexBasis: '47%',
    maxWidth: '47%'
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
