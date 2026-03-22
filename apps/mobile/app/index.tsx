import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { WardrobeItem, PaginatedResponse } from '@adore/shared';
import { listItems } from '../lib/api';
import ItemCard from '../components/ItemCard';

export default function WardrobeScreen() {
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
          <Ionicons name="shirt-outline" size={64} color="#ccc" />
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
        renderItem={({ item }) => <ItemCard item={item} />}
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
            <ActivityIndicator style={styles.footer} color="#1a1a1a" />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              size="large"
              color="#1a1a1a"
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
          onPress={() => router.push('/add-item')}
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
    backgroundColor: '#fafafa',
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
    fontSize: 13,
    color: '#888',
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
    fontSize: 20,
    fontWeight: '500',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  errorState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  errorText: {
    fontSize: 14,
    color: '#e53e3e',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  retryText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
