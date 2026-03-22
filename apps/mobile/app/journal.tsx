import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { MOOD_TAGS } from '@adore/shared';
import type { MoodTag, PaginatedResponse } from '@adore/shared';
import { listOutfits, type OutfitWithItems } from '../lib/api';
import { colors, fonts } from '../lib/theme';

// ── Constants ─────────────────────────────────────────────────

const MOOD_EMOJI: Record<MoodTag, string> = {
  confident: '\u{1F60E}',
  comfortable: '\u{1F60C}',
  creative: '\u{1F3A8}',
  powerful: '\u{1F4AA}',
  relaxed: '\u{1F9D8}',
  overdressed: '\u{1F454}',
  underdressed: '\u{1F62C}',
  meh: '\u{1F610}',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - date.getTime();
  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff < 7) return `${daysDiff} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

// ── Outfit Card Component ────────────────────────────────────

function OutfitCard({ outfit }: { outfit: OutfitWithItems }) {
  const itemCount = outfit.outfit_items?.length ?? 0;

  return (
    <View style={styles.card}>
      {/* Photo */}
      <View style={styles.cardImageContainer}>
        {outfit.photo_url ? (
          <Image
            source={{ uri: outfit.photo_url }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="shirt-outline" size={32} color={colors.textMuted} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardDate}>{formatDate(outfit.worn_date)}</Text>
          {outfit.mood_tag && (
            <Text style={styles.cardMood}>
              {MOOD_EMOJI[outfit.mood_tag as MoodTag] ?? ''}{' '}
              {outfit.mood_tag}
            </Text>
          )}
        </View>

        {outfit.occasion && (
          <View style={styles.occasionBadge}>
            <Text style={styles.occasionBadgeText}>
              {outfit.occasion.replace(/-/g, ' ')}
            </Text>
          </View>
        )}

        <Text style={styles.cardItemCount}>
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </Text>

        {/* Mini item thumbnails */}
        {outfit.outfit_items && outfit.outfit_items.length > 0 && (
          <View style={styles.miniThumbnails}>
            {outfit.outfit_items.slice(0, 4).map((oi, i) => {
              const imgUrl =
                oi.wardrobe_item?.image_url_clean ??
                oi.wardrobe_item?.image_url;
              return imgUrl ? (
                <Image
                  key={oi.id ?? i}
                  source={{ uri: imgUrl }}
                  style={styles.miniThumb}
                  resizeMode="cover"
                />
              ) : (
                <View key={oi.id ?? i} style={[styles.miniThumb, styles.miniThumbPlaceholder]}>
                  <Ionicons name="shirt-outline" size={12} color={colors.textMuted} />
                </View>
              );
            })}
            {outfit.outfit_items.length > 4 && (
              <View style={[styles.miniThumb, styles.miniThumbMore]}>
                <Text style={styles.miniThumbMoreText}>
                  +{outfit.outfit_items.length - 4}
                </Text>
              </View>
            )}
          </View>
        )}

        {outfit.notes && (
          <Text style={styles.cardNotes} numberOfLines={2}>
            {outfit.notes}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Main Journal Screen ──────────────────────────────────────

export default function JournalScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery<PaginatedResponse<OutfitWithItems>>({
    queryKey: ['outfits'],
    queryFn: ({ pageParam }) =>
      listOutfits({ cursor: pageParam as string | undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
  });

  const allOutfits = data?.pages.flatMap((page) => page.data) ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Empty state
  if (!isLoading && allOutfits.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No outfits logged yet</Text>
          <Text style={styles.emptySubtitle}>
            Snap a photo of what you're wearing today.{'\n'}
            Your wardrobe builds itself over time.
          </Text>
          <Pressable
            style={styles.captureButton}
            onPress={() => router.push('/log-outfit')}
          >
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={styles.captureText}>Log Today's Outfit</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allOutfits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <OutfitCard outfit={item} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerCount}>
              {allOutfits.length} outfit{allOutfits.length !== 1 ? 's' : ''} logged
            </Text>
          </View>
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} color={colors.accent} />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.accent}
              style={styles.loading}
            />
          ) : isError ? (
            <View style={styles.errorState}>
              <Text style={styles.errorText}>
                {error?.message ?? 'Failed to load outfits'}
              </Text>
              <Pressable style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* Floating Camera Button */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/log-outfit')}
      >
        <Ionicons name="camera" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    paddingVertical: 12,
  },
  headerCount: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  loading: {
    marginTop: 80,
  },
  footer: {
    paddingVertical: 20,
  },

  // Empty state
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
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
    gap: 10,
  },
  captureText: {
    fontFamily: fonts.inter.medium,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },

  // Error state
  errorState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  retryText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '500',
  },

  // Outfit card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImageContainer: {
    width: 110,
    backgroundColor: colors.accentSoft,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    minHeight: 140,
  },
  cardImagePlaceholder: {
    width: '100%',
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardDate: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardMood: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  occasionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  occasionBadgeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.secondary,
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  cardItemCount: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },

  // Mini thumbnails
  miniThumbnails: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  miniThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  miniThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniThumbMore: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.border,
  },
  miniThumbMoreText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  cardNotes: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
