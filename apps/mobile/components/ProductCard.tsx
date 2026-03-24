import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProductSearchResult } from '@adore/shared';
import { colors, fonts, spacing, radii } from '../lib/theme';

interface ProductCardProps {
  product: ProductSearchResult;
  onPress?: () => void;
  rightAction?: React.ReactNode;
}

export default function ProductCard({ product, onPress, rightAction }: ProductCardProps) {
  const hasImage = !!product.image_url && product.image_url.length > 0;

  return (
    <Pressable style={styles.card} onPress={onPress} disabled={!onPress}>
      {hasImage ? (
        <Image source={{ uri: product.image_url }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Ionicons name="bag-outline" size={24} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.retailer ? (
          <Text style={styles.retailer} numberOfLines={1}>
            {product.retailer}
          </Text>
        ) : null}
        {product.price != null && product.price > 0 ? (
          <Text style={styles.price}>${product.price.toFixed(0)}</Text>
        ) : null}
      </View>

      {rightAction && <View style={styles.action}>{rightAction}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  retailer: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  price: {
    fontFamily: fonts.mono.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent,
  },
  action: {
    marginLeft: spacing.xs,
  },
});
