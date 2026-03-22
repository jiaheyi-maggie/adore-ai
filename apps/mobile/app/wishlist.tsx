import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';

export default function WishlistScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Your wish list is empty</Text>
        <Text style={styles.emptySubtitle}>
          Screenshot something you want to buy, and Adore will tell you
          if it's worth it based on your wardrobe and budget.
        </Text>
        <Pressable style={styles.addButton}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addText}>Add from Screenshot</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 24,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  addText: {
    fontFamily: fonts.inter.medium,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
