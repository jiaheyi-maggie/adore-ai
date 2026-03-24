import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  FlatList,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { colors, fonts, spacing, radii } from '../../lib/theme';
import {
  getStylePresets,
  createStyleShift,
  getBridgeOutfits,
  getShiftShoppingList,
  getUserProfile,
  type ArchetypePresetResponse,
  type CreateShiftResponse,
  type BridgeOutfit,
  type ShoppingListItem,
  type ClassifiedItem,
  type PhaseScheduleItem,
} from '../../lib/api';

// ── Types ───────────────────────────────────────────────────

type Intensity = 'taste' | 'explore' | 'transform';

type Step =
  | 'choose-direction'
  | 'choose-intensity'
  | 'closet-reseen'
  | 'bridge-outfits'
  | 'shopping-list'
  | 'goal-created';

// ── Preset Icons ────────────────────────────────────────────

const PRESET_ICONS: Record<string, string> = {
  bohemian: 'leaf-outline',
  'clean-minimalist': 'remove-outline',
  'dark-academia': 'book-outline',
  'coastal-grandmother': 'boat-outline',
  streetwear: 'walk-outline',
  'classic-preppy': 'school-outline',
  'romantic-feminine': 'heart-outline',
  'edgy-rock': 'flash-outline',
  'athleisure-chic': 'fitness-outline',
  'old-money-quiet-luxury': 'diamond-outline',
  'scandinavian-minimal': 'snow-outline',
  'maximalist-eclectic': 'color-palette-outline',
};

// ── Main Component ──────────────────────────────────────────

export default function StyleShiftScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('choose-direction');
  const [selectedPreset, setSelectedPreset] = useState<ArchetypePresetResponse | null>(null);
  const [freeText, setFreeText] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('explore');
  const [shiftResult, setShiftResult] = useState<CreateShiftResponse | null>(null);
  const [bridgeOutfits, setBridgeOutfits] = useState<BridgeOutfit[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [totalInvestment, setTotalInvestment] = useState(0);

  // Fetch presets
  const { data: presetsData, isLoading: presetsLoading } = useQuery({
    queryKey: ['style-presets'],
    queryFn: getStylePresets,
  });
  const presets = presetsData?.data ?? [];

  // Fetch user profile for "Surprise Me" aspiration gap logic
  const { data: profileData } = useQuery({
    queryKey: ['user-profile'],
    queryFn: getUserProfile,
  });
  const currentArchetypes = profileData?.data.style_profile?.style_archetypes ?? {};

  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: async () => {
      const payload: {
        target_preset_id?: string;
        target_description?: string;
        intensity: Intensity;
      } = { intensity };

      if (selectedPreset) {
        payload.target_preset_id = selectedPreset.id;
      } else if (freeText.trim()) {
        payload.target_description = freeText.trim();
      }

      const res = await createStyleShift(payload);
      return res.data;
    },
    onSuccess: (data) => {
      setShiftResult(data);
      setStep('closet-reseen');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    },
  });

  // Bridge outfits mutation
  const bridgeOutfitsMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const res = await getBridgeOutfits(goalId, 5);
      return res.data;
    },
    onSuccess: (data) => {
      setBridgeOutfits(data.outfits ?? []);
      setStep('bridge-outfits');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    },
  });

  // Shopping list mutation
  const shoppingListMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const res = await getShiftShoppingList(goalId, 5);
      return res.data;
    },
    onSuccess: (data) => {
      setShoppingList(data.shopping_list ?? []);
      setTotalInvestment(data.total_investment ?? 0);
      setStep('shopping-list');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    },
  });

  const handleSurpriseMe = useCallback(() => {
    if (presets.length === 0) return;

    // Find the preset with the LEAST overlap with current archetypes (biggest aspiration gap)
    let bestPreset = presets[0];
    let lowestOverlap = Infinity;

    for (const preset of presets) {
      let overlap = 0;
      for (const [arch, weight] of Object.entries(preset.archetypes)) {
        const currentWeight = (currentArchetypes as Record<string, number>)[arch] ?? 0;
        overlap += Math.min(weight, currentWeight);
      }
      if (overlap < lowestOverlap) {
        lowestOverlap = overlap;
        bestPreset = preset;
      }
    }

    setSelectedPreset(bestPreset);
    setFreeText('');
    setStep('choose-intensity');
  }, [presets, currentArchetypes]);

  const handlePresetSelect = useCallback((preset: ArchetypePresetResponse) => {
    setSelectedPreset(preset);
    setFreeText('');
    setStep('choose-intensity');
  }, []);

  const handleFreeTextSubmit = useCallback(() => {
    if (freeText.trim().length > 0) {
      setSelectedPreset(null);
      setStep('choose-intensity');
    }
  }, [freeText]);

  const handleIntensityConfirm = useCallback(() => {
    createShiftMutation.mutate();
  }, [createShiftMutation]);

  const handleNextToOutfits = useCallback(() => {
    if (shiftResult?.goal.id) {
      bridgeOutfitsMutation.mutate(shiftResult.goal.id);
    }
  }, [bridgeOutfitsMutation, shiftResult]);

  const handleNextToShopping = useCallback(() => {
    if (shiftResult?.goal.id) {
      shoppingListMutation.mutate(shiftResult.goal.id);
    }
  }, [shoppingListMutation, shiftResult]);

  const handleGoalComplete = useCallback(() => {
    setStep('goal-created');
  }, []);

  const handleTrackProgress = useCallback(() => {
    router.navigate('/profile');
  }, [router]);

  // ── Render Steps ────────────────────────────────────────────

  if (presetsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading aesthetics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (step === 'choose-direction') {
              router.navigate('/profile');
            } else if (step === 'choose-intensity') {
              setStep('choose-direction');
            } else if (step === 'closet-reseen') {
              setStep('choose-intensity');
            } else if (step === 'bridge-outfits') {
              setStep('closet-reseen');
            } else if (step === 'shopping-list') {
              setStep('bridge-outfits');
            } else {
              router.navigate('/profile');
            }
          }}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Style Shifting</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {(['choose-direction', 'choose-intensity', 'closet-reseen', 'bridge-outfits', 'shopping-list', 'goal-created'] as Step[]).map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              (['choose-direction', 'choose-intensity', 'closet-reseen', 'bridge-outfits', 'shopping-list', 'goal-created'] as Step[]).indexOf(step) > i && styles.stepDotCompleted,
            ]}
          />
        ))}
      </View>

      {step === 'choose-direction' && (
        <ChooseDirectionStep
          presets={presets}
          freeText={freeText}
          onFreeTextChange={setFreeText}
          onFreeTextSubmit={handleFreeTextSubmit}
          onPresetSelect={handlePresetSelect}
          onSurpriseMe={handleSurpriseMe}
        />
      )}

      {step === 'choose-intensity' && (
        <ChooseIntensityStep
          intensity={intensity}
          onIntensityChange={setIntensity}
          onConfirm={handleIntensityConfirm}
          isLoading={createShiftMutation.isPending}
          targetName={selectedPreset?.name ?? 'Custom Style'}
        />
      )}

      {step === 'closet-reseen' && shiftResult && (
        <ClosetReseenStep
          classification={shiftResult.classification}
          wardrobeCount={shiftResult.wardrobe_item_count}
          targetName={selectedPreset?.name ?? (shiftResult.goal.target_state as Record<string, unknown>).target_name as string ?? 'Target'}
          onNext={handleNextToOutfits}
          isLoading={bridgeOutfitsMutation.isPending}
          message={shiftResult.message}
        />
      )}

      {step === 'bridge-outfits' && (
        <BridgeOutfitsStep
          outfits={bridgeOutfits}
          onNext={handleNextToShopping}
          isLoading={shoppingListMutation.isPending}
        />
      )}

      {step === 'shopping-list' && (
        <ShoppingListStep
          items={shoppingList}
          totalInvestment={totalInvestment}
          onNext={handleGoalComplete}
        />
      )}

      {step === 'goal-created' && shiftResult && (
        <GoalCreatedStep
          goalTitle={shiftResult.goal.title}
          phaseSchedule={shiftResult.phase_schedule}
          onTrackProgress={handleTrackProgress}
        />
      )}
    </View>
  );
}

// ── Step 1: Choose Direction ────────────────────────────────

function ChooseDirectionStep({
  presets,
  freeText,
  onFreeTextChange,
  onFreeTextSubmit,
  onPresetSelect,
  onSurpriseMe,
}: {
  presets: ArchetypePresetResponse[];
  freeText: string;
  onFreeTextChange: (text: string) => void;
  onFreeTextSubmit: () => void;
  onPresetSelect: (preset: ArchetypePresetResponse) => void;
  onSurpriseMe: () => void;
}) {
  return (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Choose Your Direction</Text>
      <Text style={styles.stepSubtitle}>
        Pick an aesthetic to explore, or describe your own
      </Text>

      {/* Surprise Me button */}
      <Pressable style={styles.surpriseMeButton} onPress={onSurpriseMe}>
        <Ionicons name="shuffle-outline" size={20} color={colors.accent} />
        <Text style={styles.surpriseMeText}>Surprise Me</Text>
        <Text style={styles.surpriseMeHint}>Based on your aspiration gap</Text>
      </Pressable>

      {/* Free-text input */}
      <View style={styles.freeTextContainer}>
        <TextInput
          style={styles.freeTextInput}
          placeholder="Describe the style you want to explore..."
          placeholderTextColor={colors.textMuted}
          value={freeText}
          onChangeText={onFreeTextChange}
          multiline={false}
          returnKeyType="go"
          onSubmitEditing={onFreeTextSubmit}
        />
        {freeText.trim().length > 0 && (
          <Pressable style={styles.freeTextButton} onPress={onFreeTextSubmit}>
            <Ionicons name="arrow-forward" size={20} color={colors.surface} />
          </Pressable>
        )}
      </View>

      {/* Preset grid */}
      <View style={styles.presetGrid}>
        {presets.map((preset) => (
          <Pressable
            key={preset.id}
            style={styles.presetCard}
            onPress={() => onPresetSelect(preset)}
          >
            <Ionicons
              name={(PRESET_ICONS[preset.id] ?? 'sparkles-outline') as keyof typeof Ionicons.glyphMap}
              size={28}
              color={colors.accent}
            />
            <Text style={styles.presetName} numberOfLines={1}>
              {preset.name}
            </Text>
            <Text style={styles.presetDesc} numberOfLines={2}>
              {preset.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Step 2: Intensity Selector ──────────────────────────────

const INTENSITY_OPTIONS: Array<{
  value: Intensity;
  label: string;
  blend: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'taste',
    label: 'Taste',
    blend: '80/20',
    description: 'Subtle hints of the new aesthetic mixed into your current style',
    icon: 'water-outline',
  },
  {
    value: 'explore',
    label: 'Explore',
    blend: '60/40',
    description: 'A balanced blend that noticeably evolves your look',
    icon: 'compass-outline',
  },
  {
    value: 'transform',
    label: 'Transform',
    blend: '30/70',
    description: 'A bold shift that makes the new aesthetic dominant',
    icon: 'rocket-outline',
  },
];

function ChooseIntensityStep({
  intensity,
  onIntensityChange,
  onConfirm,
  isLoading,
  targetName,
}: {
  intensity: Intensity;
  onIntensityChange: (i: Intensity) => void;
  onConfirm: () => void;
  isLoading: boolean;
  targetName: string;
}) {
  return (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>How Far Do You Want to Go?</Text>
      <Text style={styles.stepSubtitle}>
        Choose the intensity of your {targetName} shift
      </Text>

      <View style={styles.intensityList}>
        {INTENSITY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.intensityCard,
              intensity === option.value && styles.intensityCardActive,
            ]}
            onPress={() => onIntensityChange(option.value)}
          >
            <View style={styles.intensityHeader}>
              <Ionicons
                name={option.icon as keyof typeof Ionicons.glyphMap}
                size={24}
                color={intensity === option.value ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.intensityLabel,
                  intensity === option.value && styles.intensityLabelActive,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.intensityBlend}>{option.blend}</Text>
            </View>
            <Text style={styles.intensityDesc}>{option.description}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={onConfirm}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>Analyze My Wardrobe</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ── Step 3: Closet Re-Seen ──────────────────────────────────

function ClosetReseenStep({
  classification,
  wardrobeCount,
  targetName,
  onNext,
  isLoading,
  message,
}: {
  classification: CreateShiftResponse['classification'];
  wardrobeCount: number;
  targetName: string;
  onNext: () => void;
  isLoading: boolean;
  message?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    target_aligned: true,
    bridge: true,
    neutral: false,
    phase_out: false,
  });

  if (wardrobeCount === 0 && message) {
    return (
      <View style={[styles.stepContent, styles.center]}>
        <Ionicons name="shirt-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Add Items First</Text>
        <Text style={styles.emptySubtitle}>{message}</Text>
        <Pressable style={styles.primaryButton} onPress={onNext}>
          <Text style={styles.primaryButtonText}>Continue Anyway</Text>
        </Pressable>
      </View>
    );
  }

  const sections: Array<{
    key: string;
    title: string;
    subtitle: string;
    items: ClassifiedItem[];
    color: string;
  }> = [
    {
      key: 'target_aligned',
      title: `Hidden ${targetName}`,
      subtitle: 'Items that already work for this aesthetic',
      items: classification.target_aligned,
      color: colors.success,
    },
    {
      key: 'bridge',
      title: 'Bridge Items',
      subtitle: 'Versatile pieces that span both styles',
      items: classification.bridge,
      color: colors.accent,
    },
    {
      key: 'neutral',
      title: 'Neutral Zone',
      subtitle: 'Basics that work anywhere',
      items: classification.neutral,
      color: colors.textSecondary,
    },
    {
      key: 'phase_out',
      title: 'Consider Phasing Out',
      subtitle: 'Items that conflict with the direction',
      items: classification.phase_out,
      color: colors.error,
    },
  ];

  return (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Your Closet, Re-Seen</Text>
      <Text style={styles.stepSubtitle}>
        {wardrobeCount} items analyzed for {targetName} potential
      </Text>

      {sections.map((section) => (
        <View key={section.key} style={styles.classSection}>
          <Pressable
            style={styles.classSectionHeader}
            onPress={() =>
              setExpanded((prev) => ({ ...prev, [section.key]: !prev[section.key] }))
            }
          >
            <View style={[styles.classDot, { backgroundColor: section.color }]} />
            <Text style={styles.classSectionTitle}>{section.title}</Text>
            <Text style={styles.classSectionCount}>{section.items.length}</Text>
            <Ionicons
              name={expanded[section.key] ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
          {section.items.length > 0 && (
            <Text style={styles.classSectionSubtitle}>{section.subtitle}</Text>
          )}
          {expanded[section.key] && (
            <View style={styles.classItemsList}>
              {section.items.slice(0, 10).map((ci) => (
                <View key={ci.item.id} style={styles.classItem}>
                  {ci.item.image_url_clean || ci.item.image_url ? (
                    <Image
                      source={{ uri: ci.item.image_url_clean ?? ci.item.image_url ?? '' }}
                      style={styles.classItemImage}
                    />
                  ) : (
                    <View style={[styles.classItemImage, styles.classItemPlaceholder]}>
                      <Ionicons name="shirt-outline" size={18} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.classItemInfo}>
                    <Text style={styles.classItemName} numberOfLines={1}>
                      {ci.item.name}
                    </Text>
                    <Text style={styles.classItemReason} numberOfLines={1}>
                      {ci.reason}
                    </Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreBadgeText}>
                      {Math.round(ci.score * 100)}%
                    </Text>
                  </View>
                </View>
              ))}
              {section.items.length > 10 && (
                <Text style={styles.moreItemsText}>
                  +{section.items.length - 10} more items
                </Text>
              )}
            </View>
          )}
        </View>
      ))}

      <Pressable
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>Generate Bridge Outfits</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ── Step 4: Bridge Outfits ──────────────────────────────────

function BridgeOutfitsStep({
  outfits,
  onNext,
  isLoading,
}: {
  outfits: BridgeOutfit[];
  onNext: () => void;
  isLoading: boolean;
}) {
  if (outfits.length === 0) {
    return (
      <View style={[styles.stepContent, styles.center]}>
        <Ionicons name="layers-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Bridge Outfits Yet</Text>
        <Text style={styles.emptySubtitle}>
          Add more items to your wardrobe to unlock outfit suggestions.
        </Text>
        <Pressable
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={onNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>See Shopping Suggestions</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Bridge Outfits</Text>
      <Text style={styles.stepSubtitle}>
        {outfits.length} outfits that blend your current and target style
      </Text>

      <FlatList
        data={outfits}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `outfit-${index}`}
        contentContainerStyle={styles.outfitCarousel}
        scrollEnabled={false}
        renderItem={({ item: outfit }) => (
          <View style={styles.outfitCard}>
            <Text style={styles.outfitName}>{outfit.name}</Text>

            <View style={styles.outfitItems}>
              {outfit.items.map((oi) => (
                <Pressable
                  key={oi.id}
                  style={styles.outfitItemThumb}
                  onPress={() => Alert.alert(
                    oi.name,
                    `Category: ${oi.category}\nColors: ${oi.colors?.join(', ') ?? 'N/A'}\nMaterial: ${oi.material ?? 'N/A'}\nBrand: ${oi.brand ?? 'N/A'}\nFormality: ${oi.formality_level}/5`,
                  )}
                >
                  {oi.image_url_clean || oi.image_url ? (
                    <Image
                      source={{ uri: oi.image_url_clean ?? oi.image_url ?? '' }}
                      style={styles.outfitItemImage}
                    />
                  ) : (
                    <View style={[styles.outfitItemImage, styles.outfitItemPlaceholder]}>
                      <Ionicons name="shirt-outline" size={16} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.outfitItemName} numberOfLines={1}>
                    {oi.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.outfitScores}>
              <View style={styles.outfitScoreItem}>
                <Text style={styles.outfitScoreLabel}>Target</Text>
                <Text style={styles.outfitScoreValue}>
                  {Math.round(outfit.target_score * 100)}%
                </Text>
              </View>
              <View style={styles.outfitScoreItem}>
                <Text style={styles.outfitScoreLabel}>Comfort</Text>
                <Text style={styles.outfitScoreValue}>
                  {Math.round(outfit.comfort_score * 100)}%
                </Text>
              </View>
            </View>

            <Text style={styles.outfitStylingNote}>{outfit.styling_note}</Text>
          </View>
        )}
      />

      <Pressable
        style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
        onPress={onNext}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Text style={styles.primaryButtonText}>See Shopping Suggestions</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ── Step 5: Shopping List ───────────────────────────────────

function ShoppingListStep({
  items,
  totalInvestment,
  onNext,
}: {
  items: ShoppingListItem[];
  totalInvestment: number;
  onNext: () => void;
}) {
  if (items.length === 0) {
    return (
      <View style={[styles.stepContent, styles.center]}>
        <Ionicons name="bag-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Your Wardrobe Has It Covered</Text>
        <Text style={styles.emptySubtitle}>
          No shopping needed -- your closet already supports this shift.
        </Text>
        <Pressable style={styles.primaryButton} onPress={onNext}>
          <Text style={styles.primaryButtonText}>Complete Setup</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={styles.stepContentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Shift Shopping List</Text>
      <Text style={styles.stepSubtitle}>
        {items.length} items ranked by outfit-unlock potential
      </Text>

      {items.map((product, index) => (
        <Pressable
          key={`${product.source_url}-${index}`}
          style={styles.shoppingItem}
          onPress={() => {
            if (product.source_url) {
              Linking.openURL(product.source_url);
            }
          }}
        >
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.shoppingImage}
            />
          ) : (
            <View style={[styles.shoppingImage, styles.shoppingImagePlaceholder]}>
              <Ionicons name="bag-outline" size={20} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.shoppingInfo}>
            <Text style={styles.shoppingName} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={styles.shoppingRetailer}>{product.retailer}</Text>
            <View style={styles.shoppingMeta}>
              <Text style={styles.shoppingUnlocks}>
                Unlocks ~{product.outfit_unlock_estimate} outfits
              </Text>
              <Text style={styles.shoppingHappiness}>
                Happiness: {product.happiness_prediction.toFixed(1)}/10
              </Text>
            </View>
          </View>
          <Text style={styles.shoppingPrice}>
            ${product.price.toFixed(0)}
          </Text>
        </Pressable>
      ))}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Investment</Text>
        <Text style={styles.totalAmount}>${totalInvestment.toFixed(0)}</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={onNext}>
        <Text style={styles.primaryButtonText}>Complete Setup</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Step 6: Goal Created ────────────────────────────────────

function GoalCreatedStep({
  goalTitle,
  phaseSchedule,
  onTrackProgress,
}: {
  goalTitle: string;
  phaseSchedule: PhaseScheduleItem[];
  onTrackProgress: () => void;
}) {
  return (
    <ScrollView
      style={styles.stepContent}
      contentContainerStyle={[styles.stepContentInner, styles.center]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
      </View>

      <Text style={styles.successTitle}>Your {goalTitle} Has Begun</Text>
      <Text style={styles.successSubtitle}>
        We will track your progress as you log outfits
      </Text>

      <View style={styles.phaseSchedule}>
        <Text style={styles.phaseScheduleTitle}>PHASE SCHEDULE</Text>
        {phaseSchedule.map((phase) => (
          <View key={phase.phase} style={styles.phaseRow}>
            <View style={styles.phaseNumber}>
              <Text style={styles.phaseNumberText}>{phase.phase}</Text>
            </View>
            <View style={styles.phaseInfo}>
              <Text style={styles.phaseLabel}>{phase.label}</Text>
              <Text style={styles.phaseWeeks}>{phase.weeks}</Text>
            </View>
            <Text style={styles.phaseRatio}>
              {Math.round(phase.blend_ratio.current * 100)}/
              {Math.round(phase.blend_ratio.target * 100)}
            </Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={onTrackProgress}>
        <Text style={styles.primaryButtonText}>Track Progress</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  stepDotCompleted: {
    backgroundColor: colors.accentSoft,
  },
  stepContent: {
    flex: 1,
  },
  stepContentInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  stepTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },

  // Surprise Me
  surpriseMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  surpriseMeText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
    flex: 1,
  },
  surpriseMeHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.secondary,
  },

  // Free text
  freeTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  freeTextInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  freeTextButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Preset grid
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  presetCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  presetName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  presetDesc: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // Intensity
  intensityList: {
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  intensityCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  intensityCardActive: {
    borderColor: colors.accent,
    backgroundColor: '#FFF9F5',
  },
  intensityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  intensityLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  intensityLabelActive: {
    color: colors.accent,
  },
  intensityBlend: {
    fontFamily: fonts.mono.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  intensityDesc: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Classification sections
  classSection: {
    marginBottom: spacing.lg,
  },
  classSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  classDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  classSectionTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  classSectionCount: {
    fontFamily: fonts.mono.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  classSectionSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    paddingLeft: 22,
  },
  classItemsList: {
    gap: spacing.sm,
    paddingLeft: 22,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  classItemImage: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  classItemPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  classItemInfo: {
    flex: 1,
  },
  classItemName: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  classItemReason: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  scoreBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  scoreBadgeText: {
    fontFamily: fonts.mono.medium,
    fontSize: 11,
    fontWeight: '500',
    color: colors.accent,
  },
  moreItemsText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  // Outfit carousel
  outfitCarousel: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  outfitCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  outfitName: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  outfitItems: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  outfitItemThumb: {
    alignItems: 'center',
    width: 56,
  },
  outfitItemImage: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  outfitItemPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  outfitItemName: {
    fontFamily: fonts.inter.regular,
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  outfitScores: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  outfitScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  outfitScoreLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  outfitScoreValue: {
    fontFamily: fonts.mono.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  outfitStylingNote: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  // Shopping list
  shoppingItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    alignItems: 'center',
  },
  shoppingImage: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  shoppingImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shoppingInfo: {
    flex: 1,
  },
  shoppingName: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  shoppingRetailer: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 4,
  },
  shoppingMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  shoppingUnlocks: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.success,
  },
  shoppingHappiness: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.accent,
  },
  shoppingPrice: {
    fontFamily: fonts.mono.medium,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  totalLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  totalAmount: {
    fontFamily: fonts.mono.medium,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  // Goal created
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 26,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  phaseSchedule: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  phaseScheduleTitle: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  phaseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseNumberText: {
    fontFamily: fonts.mono.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
  phaseInfo: {
    flex: 1,
  },
  phaseLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  phaseWeeks: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  phaseRatio: {
    fontFamily: fonts.mono.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.surface,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Empty states
  emptyTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
});
