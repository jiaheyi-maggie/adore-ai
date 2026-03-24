import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import {
  suggestOutfits,
  getTodayContext,
  createOutfit,
  type SuggestedOutfit,
  type TodayContext,
} from '../../lib/api';
import { colors, fonts, spacing, radii, typography } from '../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_MARGIN = 8;

// ── Greeting Helper ───────────────────────────────────────────

function getGreeting(timeOfDay: 'morning' | 'afternoon' | 'evening'): string {
  switch (timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
  }
}

function getWeatherIcon(condition: string): string {
  const map: Record<string, string> = {
    sunny: 'sunny-outline',
    cloudy: 'cloud-outline',
    rain: 'rainy-outline',
    thunderstorm: 'thunderstorm-outline',
    snow: 'snow-outline',
    foggy: 'water-outline',
    hazy: 'water-outline',
  };
  return map[condition.toLowerCase()] ?? 'partly-sunny-outline';
}

// ── Outfit Card Component ─────────────────────────────────────

function OutfitCard({
  outfit,
  onWearIt,
  isLogging,
}: {
  outfit: SuggestedOutfit;
  onWearIt: () => void;
  isLogging: boolean;
}) {
  const itemImages = outfit.items.filter(
    (i) => i.image_url_clean || i.image_url
  );

  return (
    <View style={cardStyles.card}>
      {/* Item thumbnails grid */}
      <View style={cardStyles.thumbnailGrid}>
        {itemImages.length > 0 ? (
          itemImages.slice(0, 4).map((item, idx) => (
            <View
              key={item.id}
              style={[
                cardStyles.thumbnailContainer,
                itemImages.length === 1 && cardStyles.thumbnailFull,
                itemImages.length === 2 && cardStyles.thumbnailHalf,
                itemImages.length >= 3 && cardStyles.thumbnailQuarter,
              ]}
            >
              <Image
                source={{ uri: item.image_url_clean ?? item.image_url ?? '' }}
                style={cardStyles.thumbnailImage}
                resizeMode="cover"
              />
              {idx === 3 && itemImages.length > 4 && (
                <View style={cardStyles.moreOverlay}>
                  <Text style={cardStyles.moreText}>
                    +{itemImages.length - 4}
                  </Text>
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={cardStyles.noImageContainer}>
            <Ionicons
              name="shirt-outline"
              size={48}
              color={colors.textMuted}
            />
          </View>
        )}
      </View>

      {/* Outfit info */}
      <View style={cardStyles.infoSection}>
        <Text style={cardStyles.outfitName} numberOfLines={1}>
          {outfit.name}
        </Text>

        {/* Items list */}
        <Text style={cardStyles.itemsList} numberOfLines={2}>
          {outfit.items.map((i) => i.name).join(' + ')}
        </Text>

        {/* Score + styling note */}
        <View style={cardStyles.scoreRow}>
          <View style={cardStyles.happinessBadge}>
            <Ionicons name="heart" size={12} color={colors.accent} />
            <Text style={cardStyles.happinessText}>
              {outfit.happiness_estimate.toFixed(1)}
            </Text>
          </View>
        </View>

        <Text style={cardStyles.stylingNote} numberOfLines={2}>
          {outfit.styling_note}
        </Text>

        {/* Wear It button */}
        <Pressable
          style={[
            cardStyles.wearButton,
            isLogging && cardStyles.wearButtonDisabled,
          ]}
          onPress={onWearIt}
          disabled={isLogging}
        >
          {isLogging ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={cardStyles.wearButtonText}>Wear it</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Main Today Screen ─────────────────────────────────────────

export default function TodayScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Request location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          setLocation({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
          });
        }
      } catch {
        // Location is optional
      }
    })();
  }, []);

  // Fetch today context
  const {
    data: contextData,
    isLoading: contextLoading,
  } = useQuery({
    queryKey: ['today-context', location?.lat, location?.lon],
    queryFn: () => getTodayContext(location?.lat, location?.lon),
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const todayContext = contextData?.data;

  // Fetch outfit suggestions
  const {
    data: suggestionsData,
    isLoading: suggestionsLoading,
    isError: suggestionsError,
    error: suggestionsErrorObj,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['outfit-suggestions', location?.lat, location?.lon, todayContext?.inferred_occasion],
    queryFn: () =>
      suggestOutfits({
        occasion: todayContext?.inferred_occasion ?? null,
        lat: location?.lat,
        lon: location?.lon,
        count: 3,
      }),
    enabled: todayContext != null || !contextLoading,
    staleTime: 10 * 60 * 1000, // 10 min
  });

  const suggestions = suggestionsData?.data ?? [];

  // Wear It mutation
  const wearMutation = useMutation({
    mutationFn: async (outfit: SuggestedOutfit) => {
      return createOutfit({
        occasion: outfit.occasion,
        weather_context: outfit.weather,
        worn_date: new Date().toISOString().split('T')[0],
        item_ids: outfit.items.map((i) => i.id),
        notes: `Suggested outfit: ${outfit.name}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['today-context'] }),
      refetchSuggestions(),
    ]);
    setRefreshing(false);
  }, [queryClient, refetchSuggestions]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CARD_WIDTH + CARD_MARGIN * 2));
      setCurrentIndex(Math.max(0, Math.min(index, suggestions.length - 1)));
    },
    [suggestions.length]
  );

  const handleWearIt = useCallback(
    (outfit: SuggestedOutfit) => {
      wearMutation.mutate(outfit);
    },
    [wearMutation]
  );

  const isLoading = contextLoading || suggestionsLoading;

  // ── Empty Wardrobe State ──────────────────────────────────────

  if (!isLoading && todayContext && todayContext.wardrobe_item_count === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="sparkles" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Welcome to Adore</Text>
          <Text style={styles.emptySubtitle}>
            Add some items to your wardrobe to get personalized outfit
            suggestions every day.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push('/add-item')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Add Your First Item</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push('/batch-scan')}
          >
            <Ionicons
              name="scan-outline"
              size={20}
              color={colors.secondary}
            />
            <Text style={styles.secondaryButtonText}>Batch Scan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[1]} // single-item list to enable pull-to-refresh on the whole page
        keyExtractor={() => 'today'}
        renderItem={() => (
          <View>
            {/* ── Context Bar ──────────────────────────── */}
            <View style={styles.contextBar}>
              <Text style={styles.greeting}>
                {todayContext
                  ? `${getGreeting(todayContext.time_of_day)}${todayContext.user_name ? `, ${todayContext.user_name}` : ''}`
                  : 'Good day'}
              </Text>

              {todayContext?.weather && (
                <View style={styles.weatherRow}>
                  <Ionicons
                    name={
                      getWeatherIcon(todayContext.weather.condition) as keyof typeof Ionicons.glyphMap
                    }
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.weatherText}>
                    {todayContext.weather.temperature_f}°F,{' '}
                    {todayContext.weather.condition}
                  </Text>
                </View>
              )}

              {todayContext?.inferred_occasion && (
                <Text style={styles.occasionText}>
                  {todayContext.is_weekend ? 'Weekend' : 'Weekday'} ·{' '}
                  {todayContext.inferred_occasion.replace(/-/g, ' ')}
                </Text>
              )}
            </View>

            {/* ── Loading State ─────────────────────────── */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.loadingText}>
                  Styling your outfits...
                </Text>
              </View>
            )}

            {/* ── Error State ──────────────────────────── */}
            {suggestionsError && !isLoading && (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={32}
                  color={colors.error}
                />
                <Text style={styles.errorText}>
                  {suggestionsErrorObj?.message ?? 'Failed to load suggestions'}
                </Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={() => refetchSuggestions()}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {/* ── No Suggestions State ─────────────────── */}
            {!isLoading &&
              !suggestionsError &&
              suggestions.length === 0 &&
              (todayContext?.wardrobe_item_count ?? 0) > 0 && (
                <View style={styles.noSuggestionsContainer}>
                  <Ionicons
                    name="shirt-outline"
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text style={styles.noSuggestionsTitle}>
                    Need more variety
                  </Text>
                  <Text style={styles.noSuggestionsText}>
                    Add tops and bottoms to unlock outfit suggestions.
                  </Text>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={() => router.push('/add-item')}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.primaryButtonText}>Add Item</Text>
                  </Pressable>
                </View>
              )}

            {/* ── Outfit Cards (Horizontal Swipe) ─────── */}
            {!isLoading && suggestions.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    TODAY'S OUTFITS
                  </Text>
                </View>

                <FlatList
                  ref={flatListRef}
                  data={suggestions}
                  keyExtractor={(item) => item.id}
                  horizontal
                  pagingEnabled={false}
                  snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContainer}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  renderItem={({ item }) => (
                    <View
                      style={{
                        width: CARD_WIDTH,
                        marginHorizontal: CARD_MARGIN,
                      }}
                    >
                      <OutfitCard
                        outfit={item}
                        onWearIt={() => handleWearIt(item)}
                        isLogging={
                          wearMutation.isPending &&
                          wearMutation.variables?.id === item.id
                        }
                      />
                    </View>
                  )}
                />

                {/* Pagination dots */}
                {suggestions.length > 1 && (
                  <View style={styles.paginationContainer}>
                    {suggestions.map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.paginationDot,
                          idx === currentIndex && styles.paginationDotActive,
                        ]}
                      />
                    ))}
                    <Text style={styles.paginationText}>
                      {currentIndex + 1} of {suggestions.length}
                    </Text>
                  </View>
                )}

                {/* Wear success message */}
                {wearMutation.isSuccess && (
                  <View style={styles.successBanner}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={colors.success}
                    />
                    <Text style={styles.successText}>
                      Outfit logged to your journal
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Quick Actions ─────────────────────────── */}
            <View style={styles.quickActions}>
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push('/log-outfit')}
                >
                  <View style={styles.actionIconCircle}>
                    <Ionicons
                      name="camera-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.actionLabel}>Log Outfit</Text>
                </Pressable>

                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push('/add-item')}
                >
                  <View style={styles.actionIconCircle}>
                    <Ionicons
                      name="add-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.actionLabel}>Add Item</Text>
                </Pressable>

                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push('/stylist')}
                >
                  <View style={styles.actionIconCircle}>
                    <Ionicons
                      name="sparkles-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.actionLabel}>Ask Stylist</Text>
                </Pressable>

                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push('/wardrobe')}
                >
                  <View style={styles.actionIconCircle}>
                    <Ionicons
                      name="shirt-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.actionLabel}>Wardrobe</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      />
    </View>
  );
}

// ── Outfit Card Styles ────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#2D2926',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 200,
  },
  thumbnailContainer: {
    overflow: 'hidden',
  },
  thumbnailFull: {
    width: '100%',
    height: '100%',
  },
  thumbnailHalf: {
    width: '50%',
    height: '100%',
  },
  thumbnailQuarter: {
    width: '50%',
    height: '50%',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoSection: {
    padding: spacing.lg,
  },
  outfitName: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemsList: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  happinessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  happinessText: {
    fontFamily: fonts.mono.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  stylingNote: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  wearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.lg,
    gap: 8,
  },
  wearButtonDisabled: {
    opacity: 0.6,
  },
  wearButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

// ── Screen Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // Context bar
  contextBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  weatherText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  occasionText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  // Section header
  sectionHeader: {
    paddingHorizontal: 24,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  // Carousel
  carouselContainer: {
    paddingHorizontal: 16,
  },
  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  paginationDotActive: {
    backgroundColor: colors.accent,
    width: 18,
    borderRadius: 3,
  },
  paginationText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 8,
  },
  // Success banner
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: 8,
    marginHorizontal: 24,
    backgroundColor: '#f0f7f1',
    borderRadius: radii.md,
  },
  successText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.success,
  },
  // Quick actions
  quickActions: {
    paddingHorizontal: 24,
    paddingTop: spacing['3xl'],
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  // Error
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  retryText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondary,
  },
  // No suggestions
  noSuggestionsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  noSuggestionsTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 12,
  },
  noSuggestionsText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
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
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.full,
    marginTop: 24,
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: fonts.inter.medium,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.secondary,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.full,
    marginTop: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontFamily: fonts.inter.medium,
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
