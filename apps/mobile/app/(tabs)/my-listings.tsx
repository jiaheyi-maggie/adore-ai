import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MarketplaceListing, PaginatedResponse, ListingStatus } from '@adore/shared';
import {
  listListings,
  markListingSold,
  cancelListing,
} from '../../lib/api';
import { colors, fonts, radii, spacing } from '../../lib/theme';

type TabFilter = 'active' | 'sold' | 'all';

const PLATFORM_LABELS: Record<string, string> = {
  depop: 'Depop',
  poshmark: 'Poshmark',
  ebay: 'eBay',
  mercari: 'Mercari',
  other: 'Other',
};

const PLATFORM_COLORS: Record<string, string> = {
  depop: '#FF2300',
  poshmark: '#7B2D8E',
  ebay: '#0064D2',
  mercari: '#4DC3F7',
  other: colors.secondary,
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  pending_sale: 'Pending',
  sold: 'Sold',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const STATUS_COLORS: Record<string, string> = {
  draft: colors.textMuted,
  active: colors.success,
  pending_sale: colors.warning,
  sold: colors.accent,
  cancelled: colors.error,
  expired: colors.textMuted,
};

export default function MyListingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabFilter>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [soldPriceInput, setSoldPriceInput] = useState('');
  const [markSoldId, setMarkSoldId] = useState<string | null>(null);

  // Map tab filter to API status param
  const statusFilter: ListingStatus | undefined =
    activeTab === 'all' ? undefined : activeTab === 'active' ? 'active' : 'sold';

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<PaginatedResponse<MarketplaceListing>>({
    queryKey: ['marketplace-listings', statusFilter],
    queryFn: ({ pageParam }) =>
      listListings({
        status: statusFilter,
        cursor: pageParam as string | undefined,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
  });

  const allListings = data?.pages.flatMap((page) => page.data) ?? [];

  // Compute summary stats from all loaded listings
  const soldListings = allListings.filter((l) => l.status === 'sold');
  const totalRevenue = soldListings.reduce((sum, l) => sum + (l.sold_price ?? 0), 0);
  const avgDaysToSell =
    soldListings.length > 0
      ? Math.round(
          soldListings.reduce((sum, l) => {
            if (l.listed_at && l.sold_at) {
              return sum + (new Date(l.sold_at).getTime() - new Date(l.listed_at).getTime()) / (1000 * 60 * 60 * 24);
            }
            return sum;
          }, 0) / soldListings.length
        )
      : 0;

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

  // Mark sold mutation
  const markSoldMutation = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => markListingSold(id, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
      setMarkSoldId(null);
      setSoldPriceInput('');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const handleMarkSold = useCallback(
    (id: string) => {
      setMarkSoldId(id);
      // Find listing to seed default price
      const listing = allListings.find((l) => l.id === id);
      if (listing?.listed_price) {
        setSoldPriceInput(String(listing.listed_price));
      }
    },
    [allListings]
  );

  const handleConfirmSold = useCallback(() => {
    if (!markSoldId) return;
    const price = parseFloat(soldPriceInput);
    if (isNaN(price) || price < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid sale price.');
      return;
    }
    markSoldMutation.mutate({ id: markSoldId, price });
  }, [markSoldId, soldPriceInput, markSoldMutation]);

  const handleCancel = useCallback(
    (id: string) => {
      Alert.alert('Cancel Listing', 'This will remove the listing and revert the item to active.', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Listing',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(id),
        },
      ]);
    },
    [cancelMutation]
  );

  const daysListed = (listing: MarketplaceListing): number => {
    if (!listing.listed_at) return 0;
    return Math.ceil(
      (Date.now() - new Date(listing.listed_at).getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const renderListing = ({ item: listing }: { item: MarketplaceListing }) => {
    const isMarkingSold = markSoldId === listing.id;

    return (
      <View style={styles.listingCard}>
        <View style={styles.listingHeader}>
          <View style={styles.listingTitleRow}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {listing.title || 'Untitled'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[listing.status] + '20' }]}>
              <Text style={[styles.statusText, { color: STATUS_COLORS[listing.status] }]}>
                {STATUS_LABELS[listing.status]}
              </Text>
            </View>
          </View>

          <View style={styles.listingMeta}>
            <View style={[styles.platformBadge, { backgroundColor: PLATFORM_COLORS[listing.platform] + '20' }]}>
              <Text style={[styles.platformText, { color: PLATFORM_COLORS[listing.platform] }]}>
                {PLATFORM_LABELS[listing.platform] || listing.platform}
              </Text>
            </View>
            {listing.listed_price != null && (
              <Text style={styles.listingPrice}>${listing.listed_price}</Text>
            )}
            {listing.status === 'active' && (
              <Text style={styles.daysText}>{daysListed(listing)}d listed</Text>
            )}
            {listing.status === 'sold' && listing.sold_price != null && (
              <Text style={styles.soldPrice}>Sold: ${listing.sold_price}</Text>
            )}
          </View>
        </View>

        {/* Mark Sold inline form */}
        {isMarkingSold && (
          <View style={styles.soldForm}>
            <Text style={styles.soldFormLabel}>Sale price:</Text>
            <View style={styles.soldFormRow}>
              <View style={styles.soldPriceInput}>
                <Text style={styles.soldCurrency}>$</Text>
                <TextInput
                  style={styles.soldPriceField}
                  value={soldPriceInput}
                  onChangeText={setSoldPriceInput}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
              </View>
              <Pressable
                style={styles.soldConfirmButton}
                onPress={handleConfirmSold}
                disabled={markSoldMutation.isPending}
              >
                {markSoldMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.soldConfirmText}>Confirm</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.soldCancelButton}
                onPress={() => {
                  setMarkSoldId(null);
                  setSoldPriceInput('');
                }}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Action buttons for active listings */}
        {listing.status === 'active' && !isMarkingSold && (
          <View style={styles.listingActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleMarkSold(listing.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={[styles.actionText, { color: colors.success }]}>Mark Sold</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleCancel(listing.id)}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.actionText, { color: colors.error }]}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Earnings Summary (only show if there are sold items) */}
      {activeTab !== 'active' && soldListings.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{soldListings.length}</Text>
            <Text style={styles.summaryLabel}>Sold</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${totalRevenue.toFixed(0)}</Text>
            <Text style={styles.summaryLabel}>Revenue</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgDaysToSell}d</Text>
            <Text style={styles.summaryLabel}>Avg. to sell</Text>
          </View>
        </View>
      )}

      {/* Tab Filter */}
      <View style={styles.tabs}>
        {(['active', 'sold', 'all'] as TabFilter[]).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={allListings}
        keyExtractor={(item) => item.id}
        renderItem={renderListing}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptySubtitle}>
                Long-press an item in your wardrobe to start selling
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.accent} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },

  // Summary
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontFamily: fonts.mono.medium,
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#fff',
  },

  // Listing card
  listingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  listingHeader: {
    gap: 8,
  },
  listingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listingTitle: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  platformText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
  },
  listingPrice: {
    fontFamily: fonts.mono.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  daysText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  soldPrice: {
    fontFamily: fonts.mono.medium,
    fontSize: 14,
    color: colors.success,
  },

  // Listing actions
  listingActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
  },

  // Sold form
  soldForm: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  soldFormLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  soldFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soldPriceInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  soldCurrency: {
    fontFamily: fonts.mono.medium,
    fontSize: 16,
    color: colors.textPrimary,
    marginRight: 4,
  },
  soldPriceField: {
    flex: 1,
    fontFamily: fonts.mono.medium,
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  soldConfirmButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.sm,
  },
  soldConfirmText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: '#fff',
  },
  soldCancelButton: {
    padding: 8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 22,
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
});
