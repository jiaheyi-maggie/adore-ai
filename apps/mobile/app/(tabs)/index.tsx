import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import {
  suggestOutfits,
  getTodayContext,
  createOutfit,
  swapOutfitItem,
  emitPreferenceSignal,
  DISMISS_REASONS,
  STYLING_INTENTS,
  INTENT_DISPLAY,
  type SuggestedOutfit,
  type SuggestedOutfitItem,
  type SwapAlternative,
  type TodayContext,
  type StylingIntent,
  type DismissReason,
} from '../../lib/api';
import { colors, fonts, spacing, radii, typography } from '../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_MARGIN = 8;

// ── Helpers ─────────────────────────────────────────────────────

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

function inferDefaultIntent(todayContext: TodayContext | undefined): StylingIntent {
  if (!todayContext) return 'default';
  if (todayContext.active_style_goal) return 'push-style';
  if (todayContext.is_weekend) return 'comfort-first';
  if (todayContext.time_of_day === 'evening') return 'make-statement';
  return 'default'; // weekday morning/afternoon = polished
}

const CATEGORY_ICONS: Record<string, string> = {
  tops: 'shirt-outline',
  bottoms: 'resize-outline',
  dresses: 'flower-outline',
  outerwear: 'snow-outline',
  shoes: 'footsteps-outline',
  accessories: 'watch-outline',
  bags: 'bag-outline',
  jewelry: 'diamond-outline',
  activewear: 'barbell-outline',
};

function colorToCss(name: string): string {
  const map: Record<string, string> = {
    white: '#f0f0f0', black: '#2D2926', navy: '#1a3a5c', cream: '#f5f0e8',
    khaki: '#c3b091', camel: '#c19a6b', indigo: '#3f51b5', nude: '#e3bc9a',
    tan: '#d2b48c', gold: '#d4a04a', 'dusty-rose': '#c9a0a0', grey: '#9e9e9e',
    gray: '#9e9e9e', beige: '#d4c5a9', brown: '#795548', red: '#c62828',
    blue: '#1565c0', green: '#2e7d32', pink: '#e91e63', purple: '#7b1fa2',
    orange: '#e65100', yellow: '#f9a825', teal: '#00897b', burgundy: '#6d1b2a',
    olive: '#556b2f', coral: '#ff6f61', sage: '#9caf88',
  };
  return map[name.toLowerCase()] ?? colors.textMuted;
}

// ── Swap Bottom Sheet ───────────────────────────────────────────

function SwapSheet({
  visible,
  onClose,
  item,
  alternatives,
  isLoading,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  item: SuggestedOutfitItem | null;
  alternatives: SwapAlternative[];
  isLoading: boolean;
  onSelect: (alt: SwapAlternative) => void;
}) {
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={sheetStyles.sheet}>
        <View style={sheetStyles.handle} />
        <Text style={sheetStyles.title}>
          Swap {item.category}
        </Text>

        {/* Current item */}
        <View style={sheetStyles.currentItem}>
          {(item.image_url_clean || item.image_url) ? (
            <Image
              source={{ uri: item.image_url_clean ?? item.image_url ?? '' }}
              style={sheetStyles.currentImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[sheetStyles.currentImage, sheetStyles.currentImagePlaceholder]}>
              <Ionicons
                name={(CATEGORY_ICONS[item.category] ?? 'ellipse-outline') as any}
                size={20}
                color={colors.textMuted}
              />
            </View>
          )}
          <View style={sheetStyles.currentInfo}>
            <Text style={sheetStyles.currentName} numberOfLines={1}>{item.name}</Text>
            <Text style={sheetStyles.currentLabel}>Current</Text>
          </View>
        </View>

        <View style={sheetStyles.divider} />

        {isLoading ? (
          <View style={sheetStyles.loadingBox}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={sheetStyles.loadingLabel}>Finding alternatives...</Text>
          </View>
        ) : alternatives.length === 0 ? (
          <Text style={sheetStyles.emptyLabel}>
            No alternatives in this category.
          </Text>
        ) : (
          <ScrollView
            style={sheetStyles.altScroll}
            contentContainerStyle={sheetStyles.altGrid}
            showsVerticalScrollIndicator={false}
          >
            {alternatives.map((alt) => (
              <Pressable
                key={alt.id}
                style={sheetStyles.altCard}
                onPress={() => onSelect(alt)}
              >
                {(alt.image_url_clean || alt.image_url) ? (
                  <Image
                    source={{ uri: alt.image_url_clean ?? alt.image_url ?? '' }}
                    style={sheetStyles.altImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[sheetStyles.altImage, sheetStyles.altImagePlaceholder]}>
                    <Ionicons
                      name={(CATEGORY_ICONS[alt.category] ?? 'ellipse-outline') as any}
                      size={18}
                      color={colors.textMuted}
                    />
                  </View>
                )}
                <Text style={sheetStyles.altName} numberOfLines={1}>{alt.name}</Text>
                <View style={sheetStyles.altScoreBadge}>
                  <Text style={sheetStyles.altScoreText}>
                    {Math.round(alt.compatibility_score * 100)}%
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ── Dismiss Reason Overlay ──────────────────────────────────────

function DismissOverlay({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (reason: DismissReason) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={dismissStyles.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={dismissStyles.container}>
        <Text style={dismissStyles.title}>Why skip this outfit?</Text>
        <View style={dismissStyles.reasonRow}>
          {DISMISS_REASONS.map((r) => (
            <Pressable
              key={r.key}
              style={dismissStyles.reasonChip}
              onPress={() => onSelect(r.key)}
            >
              <Text style={dismissStyles.reasonText}>{r.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ── Intent Picker Modal ─────────────────────────────────────────

function IntentPicker({
  visible,
  onSelect,
  onClose,
  current,
}: {
  visible: boolean;
  onSelect: (intent: StylingIntent) => void;
  onClose: () => void;
  current: StylingIntent;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={intentStyles.sheet}>
        <View style={sheetStyles.handle} />
        <Text style={intentStyles.title}>Choose your vibe</Text>
        {STYLING_INTENTS.map((intent) => {
          const info = INTENT_DISPLAY[intent];
          const isActive = intent === current;
          return (
            <Pressable
              key={intent}
              style={[intentStyles.option, isActive && intentStyles.optionActive]}
              onPress={() => onSelect(intent)}
            >
              <View style={[intentStyles.iconCircle, isActive && intentStyles.iconCircleActive]}>
                <Ionicons
                  name={info.icon as any}
                  size={20}
                  color={isActive ? '#fff' : colors.accent}
                />
              </View>
              <View style={intentStyles.optionTextWrap}>
                <Text style={[intentStyles.optionLabel, isActive && intentStyles.optionLabelActive]}>
                  {info.label}
                </Text>
                <Text style={intentStyles.optionDesc}>{info.description}</Text>
              </View>
              {isActive && (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

// ── Outfit Card Component ─────────────────────────────────────

function OutfitCard({
  outfit,
  onWearIt,
  isLogging,
  onItemTap,
  onDismiss,
}: {
  outfit: SuggestedOutfit;
  onWearIt: () => void;
  isLogging: boolean;
  onItemTap: (item: SuggestedOutfitItem) => void;
  onDismiss: () => void;
}) {
  const itemImages = outfit.items.filter(
    (i) => i.image_url_clean || i.image_url
  );

  return (
    <View style={cardStyles.card}>
      {/* Dismiss X button */}
      <Pressable
        style={cardStyles.dismissButton}
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss outfit"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>

      {/* Item thumbnails grid — each item is tappable */}
      <View style={cardStyles.thumbnailGrid}>
        {itemImages.length > 0 ? (
          itemImages.slice(0, 4).map((item, idx) => (
            <Pressable
              key={item.id}
              style={[
                cardStyles.thumbnailContainer,
                itemImages.length === 1 && cardStyles.thumbnailFull,
                itemImages.length === 2 && cardStyles.thumbnailHalf,
                itemImages.length >= 3 && cardStyles.thumbnailQuarter,
              ]}
              onPress={() => onItemTap(item)}
            >
              <Image
                source={{ uri: item.image_url_clean ?? item.image_url ?? '' }}
                style={cardStyles.thumbnailImage}
                resizeMode="cover"
              />
              {/* Swap hint badge */}
              <View style={cardStyles.swapHint}>
                <Ionicons name="swap-horizontal" size={10} color="#fff" />
              </View>
              {idx === 3 && itemImages.length > 4 && (
                <View style={cardStyles.moreOverlay}>
                  <Text style={cardStyles.moreText}>
                    +{itemImages.length - 4}
                  </Text>
                </View>
              )}
            </Pressable>
          ))
        ) : (
          <View style={cardStyles.itemChipsGrid}>
            {outfit.items.slice(0, 6).map((item) => {
              const iconName = CATEGORY_ICONS[item.category] ?? 'ellipse-outline';
              const dominantColor = item.colors?.[0] ?? 'gray';
              return (
                <Pressable
                  key={item.id}
                  style={cardStyles.itemChip}
                  onPress={() => onItemTap(item)}
                >
                  <Ionicons name={iconName as any} size={18} color={colors.secondary} />
                  <Text style={cardStyles.itemChipName} numberOfLines={1}>
                    {item.name.split(' ').slice(0, 3).join(' ')}
                  </Text>
                  <View
                    style={[
                      cardStyles.colorDot,
                      { backgroundColor: colorToCss(dominantColor) },
                    ]}
                  />
                </Pressable>
              );
            })}
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
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

  // Feature 1: Swap state
  const [swapItem, setSwapItem] = useState<SuggestedOutfitItem | null>(null);
  const [swapOutfitId, setSwapOutfitId] = useState<string | null>(null);
  const [swapSheetVisible, setSwapSheetVisible] = useState(false);

  // Feature 2: Dismiss state
  const [dismissOutfitId, setDismissOutfitId] = useState<string | null>(null);
  const [dismissVisible, setDismissVisible] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Feature 3: Intent state
  const [activeIntent, setActiveIntent] = useState<StylingIntent>('default');
  const [intentPickerVisible, setIntentPickerVisible] = useState(false);
  const [intentInitialized, setIntentInitialized] = useState(false);

  // Local outfit state for swaps (copy of suggestions that we can mutate)
  const [localOutfits, setLocalOutfits] = useState<SuggestedOutfit[]>([]);

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
    queryFn: () =>
      getTodayContext(location?.lat, location?.lon, new Date().getTimezoneOffset()),
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const todayContext = contextData?.data;

  // Initialize intent from context once
  useEffect(() => {
    if (todayContext && !intentInitialized) {
      setActiveIntent(inferDefaultIntent(todayContext));
      setIntentInitialized(true);
    }
  }, [todayContext, intentInitialized]);

  // Fetch outfit suggestions (includes intent)
  const {
    data: suggestionsData,
    isLoading: suggestionsLoading,
    isError: suggestionsError,
    error: suggestionsErrorObj,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['outfit-suggestions', location?.lat, location?.lon, todayContext?.inferred_occasion, activeIntent],
    queryFn: () =>
      suggestOutfits({
        occasion: todayContext?.inferred_occasion ?? null,
        lat: location?.lat,
        lon: location?.lon,
        count: 5,
        intent: activeIntent,
      }),
    enabled: todayContext != null || !contextLoading,
    staleTime: 10 * 60 * 1000,
  });

  // Sync server suggestions into local state
  useEffect(() => {
    if (suggestionsData?.data) {
      setLocalOutfits(suggestionsData.data);
      setCurrentIndex(0);
    }
  }, [suggestionsData]);

  // Only clear dismissals when intent changes
  useEffect(() => {
    setDismissedIds(new Set());
  }, [activeIntent]);

  const visibleOutfits = useMemo(
    () => localOutfits.filter((o) => !dismissedIds.has(o.id)),
    [localOutfits, dismissedIds]
  );

  // ── Swap mutation ──────────────────────────────────────────
  const swapMutation = useMutation({
    mutationFn: async (params: { keepIds: string[]; replaceSlot: string; outfitId: string }) => {
      const outfit = localOutfits.find((o) => o.id === params.outfitId);
      return swapOutfitItem({
        keep_item_ids: params.keepIds,
        replace_slot: params.replaceSlot,
        occasion: outfit?.occasion,
        weather: outfit?.weather,
      });
    },
  });

  const handleItemTap = useCallback(
    (outfitId: string, item: SuggestedOutfitItem) => {
      setSwapItem(item);
      setSwapOutfitId(outfitId);
      setSwapSheetVisible(true);

      const outfit = localOutfits.find((o) => o.id === outfitId);
      if (!outfit) return;

      const keepIds = outfit.items.filter((i) => i.id !== item.id).map((i) => i.id);
      swapMutation.reset();
      swapMutation.mutate({
        keepIds,
        replaceSlot: item.category,
        outfitId,
      });
    },
    [localOutfits, swapMutation]
  );

  const handleSwapSelect = useCallback(
    (alt: SwapAlternative) => {
      if (!swapOutfitId || !swapItem) return;

      setLocalOutfits((prev) =>
        prev.map((outfit) => {
          if (outfit.id !== swapOutfitId) return outfit;

          const newItems = outfit.items.map((i) =>
            i.id === swapItem.id
              ? {
                  id: alt.id,
                  name: alt.name,
                  category: alt.category,
                  colors: alt.colors,
                  image_url: alt.image_url,
                  image_url_clean: alt.image_url_clean,
                  formality_level: alt.formality_level,
                  brand: alt.brand,
                }
              : i
          );

          // Recompute name + score estimate
          const heroItem = newItems[0];
          const primaryColor = heroItem.colors[0] ?? '';
          const colorPrefix = primaryColor
            ? primaryColor.charAt(0).toUpperCase() + primaryColor.slice(1) + ' '
            : '';
          const heroName = heroItem.name.split(' ').slice(0, 2).join(' ');
          const newName = outfit.occasion
            ? `${outfit.occasion.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}: ${colorPrefix}${heroName}`
            : `${colorPrefix}${heroName} Look`;

          // Recalculate happiness from compatibility score
          const newHappiness = Math.min(
            10,
            Math.max(0, outfit.happiness_estimate * 0.7 + alt.compatibility_score * 3)
          );

          return {
            ...outfit,
            items: newItems,
            name: newName,
            happiness_estimate: Math.round(newHappiness * 10) / 10,
            hero_item_id: swapItem.id === outfit.hero_item_id ? alt.id : outfit.hero_item_id,
          };
        })
      );

      setSwapSheetVisible(false);
      setSwapItem(null);
      setSwapOutfitId(null);
    },
    [swapOutfitId, swapItem]
  );

  // ── Dismiss mutation ───────────────────────────────────────
  const dismissMutation = useMutation({
    mutationFn: async (params: { outfitId: string; reason: DismissReason }) => {
      return emitPreferenceSignal({
        signal_type: 'skipped',
        outfit_id: null,
        value: { reason: params.reason, suggested_outfit_id: params.outfitId, source: 'today_dismiss' },
        context: todayContext
          ? { occasion: todayContext.inferred_occasion, is_weekend: todayContext.is_weekend }
          : null,
      });
    },
  });

  const handleDismissPress = useCallback((outfitId: string) => {
    setDismissOutfitId(outfitId);
    setDismissVisible(true);
  }, []);

  const handleDismissReason = useCallback(
    (reason: DismissReason) => {
      if (!dismissOutfitId) return;
      dismissMutation.mutate({ outfitId: dismissOutfitId, reason });
      setDismissedIds((prev) => new Set(prev).add(dismissOutfitId));
      setDismissVisible(false);
      setDismissOutfitId(null);
    },
    [dismissOutfitId, dismissMutation]
  );

  // ── Intent change ──────────────────────────────────────────
  const handleIntentChange = useCallback(
    (intent: StylingIntent) => {
      setActiveIntent(intent);
      setIntentPickerVisible(false);
      // Query will auto-refetch due to queryKey including activeIntent
    },
    []
  );

  // ── Wear It mutation ───────────────────────────────────────
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
    onSuccess: (_data, outfit) => {
      setLoggedIds((prev) => new Set(prev).add(outfit.id));
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
      setTimeout(() => wearMutation.reset(), 3000);
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
      setCurrentIndex(Math.max(0, Math.min(index, visibleOutfits.length - 1)));
    },
    [visibleOutfits.length]
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

  const intentInfo = INTENT_DISPLAY[activeIntent];

  return (
    <View style={styles.container}>
      <FlatList
        data={[1]}
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

            {/* ── Intent Bar (Feature 3) ─────────────── */}
            {!isLoading && (todayContext?.wardrobe_item_count ?? 0) > 0 && (
              <View style={styles.intentBar}>
                <View style={styles.intentLabelRow}>
                  <Text style={styles.intentCaption}>TODAY'S VIBE:</Text>
                  <Text style={styles.intentValue}>
                    {intentInfo.label.toUpperCase()}
                  </Text>
                </View>
                <Pressable
                  style={styles.intentChangeButton}
                  onPress={() => setIntentPickerVisible(true)}
                >
                  <Text style={styles.intentChangeText}>change</Text>
                </Pressable>
              </View>
            )}

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
              visibleOutfits.length === 0 &&
              (todayContext?.wardrobe_item_count ?? 0) > 0 && (
                <View style={styles.noSuggestionsContainer}>
                  <Ionicons
                    name="shirt-outline"
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text style={styles.noSuggestionsTitle}>
                    {dismissedIds.size > 0 ? 'All outfits dismissed' : 'Need more variety'}
                  </Text>
                  <Text style={styles.noSuggestionsText}>
                    {dismissedIds.size > 0
                      ? 'Pull down to refresh for new suggestions.'
                      : 'Add tops and bottoms to unlock outfit suggestions.'}
                  </Text>
                  {dismissedIds.size === 0 && (
                    <Pressable
                      style={styles.primaryButton}
                      onPress={() => router.push('/add-item')}
                    >
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>Add Item</Text>
                    </Pressable>
                  )}
                </View>
              )}

            {/* ── Outfit Cards (Horizontal Swipe) ─────── */}
            {!isLoading && visibleOutfits.length > 0 && (
              <View>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    TODAY'S OUTFITS
                  </Text>
                </View>

                <FlatList
                  ref={flatListRef}
                  data={visibleOutfits}
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
                          loggedIds.has(item.id) ||
                          wearMutation.isPending
                        }
                        onItemTap={(tapItem) => handleItemTap(item.id, tapItem)}
                        onDismiss={() => handleDismissPress(item.id)}
                      />
                    </View>
                  )}
                />

                {/* Pagination dots */}
                {visibleOutfits.length > 1 && (
                  <View style={styles.paginationContainer}>
                    {visibleOutfits.map((_, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.paginationDot,
                          idx === currentIndex && styles.paginationDotActive,
                        ]}
                      />
                    ))}
                    <Text style={styles.paginationText}>
                      {currentIndex + 1} of {visibleOutfits.length}
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

      {/* ── Modals ──────────────────────────────────── */}
      <SwapSheet
        visible={swapSheetVisible}
        onClose={() => {
          setSwapSheetVisible(false);
          setSwapItem(null);
          setSwapOutfitId(null);
        }}
        item={swapItem}
        alternatives={swapMutation.data?.data ?? []}
        isLoading={swapMutation.isPending}
        onSelect={handleSwapSelect}
      />

      <DismissOverlay
        visible={dismissVisible}
        onSelect={handleDismissReason}
        onClose={() => {
          setDismissVisible(false);
          setDismissOutfitId(null);
        }}
      />

      <IntentPicker
        visible={intentPickerVisible}
        onSelect={handleIntentChange}
        onClose={() => setIntentPickerVisible(false)}
        current={activeIntent}
      />
    </View>
  );
}

// ── Swap Sheet Styles ───────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  currentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  currentImage: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
  },
  currentImagePlaceholder: {
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentInfo: {
    flex: 1,
  },
  currentName: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  currentLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  loadingLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  altScroll: {
    flexGrow: 0,
  },
  altGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  altCard: {
    width: (SCREEN_WIDTH - 60) / 4 - 10,
    alignItems: 'center',
  },
  altImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.sm,
    marginBottom: 4,
  },
  altImagePlaceholder: {
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  altName: {
    fontFamily: fonts.inter.regular,
    fontSize: 10,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  altScoreBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  altScoreText: {
    fontFamily: fonts.mono.medium,
    fontSize: 10,
    fontWeight: '500',
    color: colors.accent,
  },
});

// ── Dismiss Overlay Styles ──────────────────────────────────────

const dismissStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.accentSoft,
  },
  reasonText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.secondary,
  },
});

// ── Intent Picker Styles ────────────────────────────────────────

const intentStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    marginBottom: 4,
  },
  optionActive: {
    backgroundColor: colors.accentSoft,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: colors.accent,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionLabelActive: {
    color: colors.accent,
  },
  optionDesc: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

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
  dismissButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
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
  swapHint: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
  },
  itemChipsGrid: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.accentSoft,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  itemChipName: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
    maxWidth: 160,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingBottom: 8,
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
  // Intent bar
  intentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
  },
  intentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intentCaption: {
    fontFamily: fonts.inter.medium,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  intentValue: {
    fontFamily: fonts.inter.semibold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.accent,
  },
  intentChangeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  intentChangeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.accent,
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
