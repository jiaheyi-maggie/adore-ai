import { View, Text, Image, StyleSheet, Pressable, Dimensions } from 'react-native';
import type { WardrobeItem } from '@adore/shared';
import { colors, fonts, categoryColors } from '../lib/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;

interface ItemCardProps {
  item: WardrobeItem;
  onPress?: () => void;
}

export default function ItemCard({ item, onPress }: ItemCardProps) {
  const imageUrl = item.image_url_clean ?? item.image_url;
  const dotColor = categoryColors[item.category] ?? colors.textMuted;

  // Cost-per-wear calculation (if data available)
  const costPerWear =
    item.purchase_price != null && item.times_worn != null && item.times_worn > 0
      ? (item.purchase_price / item.times_worn).toFixed(2)
      : null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <View style={[styles.categoryDot, { backgroundColor: dotColor }]} />
            <Text style={styles.badgeText}>{item.category}</Text>
          </View>
          {costPerWear && (
            <Text style={styles.cpw}>${costPerWear}/wear</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
    shadowColor: '#2D2926',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    backgroundColor: colors.accentSoft,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  info: {
    padding: 10,
  },
  name: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  cpw: {
    fontFamily: fonts.mono.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.accent,
  },
});
