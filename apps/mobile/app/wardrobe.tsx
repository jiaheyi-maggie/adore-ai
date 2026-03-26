import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { WardrobeItem, PaginatedResponse } from '@adore/shared';
import { listItems } from '../lib/api';
import ItemCard from '../components/ItemCard';
import { colors, fonts } from '../lib/theme';

export default function WardrobeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleLongPress = useCallback(
    (item: WardrobeItem) => {
      if (item.status === 'listed' || item.status === 'sold') return;

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Sell this item'],
            cancelButtonIndex: 0,
            title: item.name,
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              router.push({ pathname: '/sell-item', params: { itemId: item.id } });
            }
          }
        );
      } else {
        Alert.alert(item.name, undefined, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sell this item',
            onPress: () =>
              router.push({ pathname: '/sell-item', params: { itemId: item.id } }),
          },
        ]);
      }
    },
    [router]
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery<PaginatedResponse<WardrobeItem>>({
    queryKey: ['wardrobe-items'],
    queryFn: ({ pageParam }) =>
      listItems({ cursor: pageParam as string | undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
  });

  const allItems = data?.pages.flatMap((page) => page.data) ?? [];

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
  if (!isLoading && allItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="shirt-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Your wardrobe is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add your first item by taking a photo or scanning your closet
          </Text>
          <Pressable
            style={styles.addButton}
            onPress={() => router.push('/add-item')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Item</Text>
          </Pressable>
          <Pressable
            style={styles.batchScanButton}
            onPress={() => router.push('/batch-scan')}
          >
            <Ionicons name="scan-outline" size={20} color={colors.secondary} />
            <Text style={styles.batchScanButtonText}>Batch Scan</Text>
          </Pressable>
          <Pressable
            style={styles.closetScanButton}
            onPress={() => router.push('/hanger-scan')}
          >
            <Ionicons name="albums-outline" size={20} color={colors.secondary} />
            <Text style={styles.batchScanButtonText}>Closet Scan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onLongPress={() => handleLongPress(item)}
          />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.itemCount}>{allItems.length} items</Text>
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
                {error?.message ?? 'Failed to load wardrobe'}
              </Text>
              <Pressable style={styles.retryButton} onPress={() => refetch()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* Floating Add Button */}
      {allItems.length > 0 && (
        <Pressable
          style={styles.fab}
          onPress={() => {
            if (Platform.OS === 'ios') {
              ActionSheetIOS.showActionSheetWithOptions(
                {
                  options: ['Cancel', 'Add Single Item', 'Batch Scan', 'Closet Scan'],
                  cancelButtonIndex: 0,
                  title: 'Add to Wardrobe',
                },
                (buttonIndex) => {
                  if (buttonIndex === 1) router.push('/add-item');
                  if (buttonIndex === 2) router.push('/batch-scan');
                  if (buttonIndex === 3) router.push('/hanger-scan');
                }
              );
            } else {
              Alert.alert('Add to Wardrobe', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Add Single Item', onPress: () => router.push('/add-item') },
                { text: 'Batch Scan', onPress: () => router.push('/batch-scan') },
                { text: 'Closet Scan', onPress: () => router.push('/hanger-scan') },
              ]);
            }
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
  },
  header: {
    paddingVertical: 12,
  },
  itemCount: {
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
  addButtonText: {
    fontFamily: fonts.inter.medium,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  batchScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.secondary,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
    gap: 8,
  },
  batchScanButtonText: {
    fontFamily: fonts.inter.medium,
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '500',
  },
  closetScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.secondary,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
    gap: 8,
  },
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
