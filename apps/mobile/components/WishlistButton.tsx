import { Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProductSearchResult } from '@adore/shared';
import { createWishlistItem, type CreateWishlistItemPayload } from '../lib/api';
import { colors } from '../lib/theme';

interface WishlistButtonProps {
  product: ProductSearchResult;
  defaults?: Partial<CreateWishlistItemPayload>;
  size?: 'sm' | 'md';
  onSuccess?: (itemId: string) => void;
}

export default function WishlistButton({
  product,
  defaults,
  size = 'sm',
  onSuccess,
}: WishlistButtonProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => {
      // Spread defaults first so product identity fields always take precedence
      const { name: _n, source_url: _s, external_product_id: _e, ...safeDefaults } = defaults ?? {};
      return createWishlistItem({
        priority: 'want',
        ...safeDefaults,
        name: product.name,
        price: product.price,
        brand: product.brand ?? null,
        source_url: product.source_url,
        image_url: product.image_url || null,
        external_product_id: product.external_product_id ?? null,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
      if (data?.data?.id) onSuccess?.(data.data.id);
    },
    onError: (err: Error) => {
      Alert.alert('Could not save', err.message);
    },
  });

  const iconSize = size === 'sm' ? 20 : 28;
  const isFilled = mutation.isSuccess;

  return (
    <Pressable
      onPress={() => {
        if (!isFilled && !mutation.isPending) mutation.mutate();
      }}
      disabled={mutation.isPending || isFilled}
      style={[styles.button, (mutation.isPending || isFilled) && styles.disabled]}
      hitSlop={8}
      accessibilityLabel={isFilled ? 'Saved to wishlist' : 'Add to wishlist'}
      accessibilityRole="button"
    >
      <Ionicons
        name={isFilled ? 'heart' : 'heart-outline'}
        size={iconSize}
        color={isFilled ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
  disabled: {
    opacity: 0.6,
  },
});
