import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import type { WardrobeItem, PriceSuggestion, ListingPlatform } from '@adore/shared';
import { LISTING_PLATFORMS } from '@adore/shared';
import {
  getItem,
  suggestPrice,
  generateListing,
  createListing,
} from '../../lib/api';
import { colors, fonts, radii, spacing } from '../../lib/theme';

const PLATFORM_LABELS: Record<ListingPlatform, string> = {
  depop: 'Depop',
  poshmark: 'Poshmark',
  ebay: 'eBay',
  mercari: 'Mercari',
  other: 'Other',
};

const PLATFORM_COLORS: Record<ListingPlatform, string> = {
  depop: '#FF2300',
  poshmark: '#7B2D8E',
  ebay: '#0064D2',
  mercari: '#4DC3F7',
  other: colors.secondary,
};

const PLATFORM_DEEPLINKS: Record<string, string> = {
  depop: 'depop://',
  poshmark: 'poshmark://',
  ebay: 'ebay://',
  mercari: 'mercari://',
};

export default function SellItemScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const [selectedPlatform, setSelectedPlatform] = useState<ListingPlatform>('depop');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listedPrice, setListedPrice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Fetch wardrobe item
  const { data: itemResponse, isLoading: itemLoading } = useQuery({
    queryKey: ['wardrobe-item', itemId],
    queryFn: () => getItem(itemId!),
    enabled: !!itemId,
  });
  const item = itemResponse?.data;

  // Fetch price suggestion
  const { data: priceResponse, isLoading: priceLoading } = useQuery({
    queryKey: ['price-suggestion', itemId],
    queryFn: () => suggestPrice(itemId!),
    enabled: !!itemId,
  });
  const priceSuggestion = priceResponse?.data;

  // Seed listed price from suggestion when it arrives
  useEffect(() => {
    if (priceSuggestion && !listedPrice) {
      setListedPrice(String(priceSuggestion.suggested_price));
    }
  }, [priceSuggestion]);

  // Create listing mutation
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createListing(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      Alert.alert('Listed!', 'Your item is now marked as listed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  // Generate listing via AI
  const handleGenerate = useCallback(async () => {
    if (!itemId) return;
    setIsGenerating(true);
    try {
      const result = await generateListing(itemId, selectedPlatform);
      setTitle(result.data.title);
      setDescription(result.data.description);
      setHasGenerated(true);
    } catch (err) {
      Alert.alert('Generation Failed', err instanceof Error ? err.message : 'Could not generate listing');
    } finally {
      setIsGenerating(false);
    }
  }, [itemId, selectedPlatform]);

  // Copy all to clipboard
  const handleCopyAll = useCallback(async () => {
    const text = `${title}\n\n${description}\n\nPrice: $${listedPrice}`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Listing copied to clipboard');
  }, [title, description, listedPrice]);

  // Open platform app
  const handleOpenPlatform = useCallback(async () => {
    const deeplink = PLATFORM_DEEPLINKS[selectedPlatform];
    if (deeplink) {
      const canOpen = await Linking.canOpenURL(deeplink);
      if (canOpen) {
        await Linking.openURL(deeplink);
      } else {
        // Fallback to web
        const webUrls: Record<string, string> = {
          depop: 'https://www.depop.com/sell/',
          poshmark: 'https://poshmark.com/create-listing',
          ebay: 'https://www.ebay.com/sl/sell',
          mercari: 'https://www.mercari.com/sell/',
        };
        const url = webUrls[selectedPlatform];
        if (url) await Linking.openURL(url);
      }
    }
  }, [selectedPlatform]);

  // Mark as listed
  const handleMarkListed = useCallback(() => {
    if (!itemId || !title) {
      Alert.alert('Missing Info', 'Generate or enter a title before listing.');
      return;
    }

    createMutation.mutate({
      wardrobe_item_id: itemId,
      platform: selectedPlatform,
      status: 'active',
      title,
      description,
      suggested_price: priceSuggestion?.suggested_price ?? null,
      listed_price: listedPrice ? parseFloat(listedPrice) : null,
      price_suggestion: priceSuggestion ?? null,
      listed_at: new Date().toISOString(),
    });
  }, [itemId, selectedPlatform, title, description, listedPrice, priceSuggestion, createMutation]);

  if (itemLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Item not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const imageUrl = item.image_url_clean ?? item.image_url;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Item Preview */}
      <View style={styles.itemPreview}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          {item.brand && <Text style={styles.itemBrand}>{item.brand}</Text>}
          <Text style={styles.itemMeta}>
            {item.condition} &middot; {item.category}
          </Text>
        </View>
      </View>

      {/* Price Suggestion */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggested Price</Text>
        {priceLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
        ) : priceSuggestion ? (
          <View style={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>
                ${priceSuggestion.suggested_price}
              </Text>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceText}>
                  {Math.round(priceSuggestion.confidence * 100)}% confidence
                </Text>
              </View>
            </View>
            {priceSuggestion.factors.map((factor, i) => (
              <View key={i} style={styles.factorRow}>
                <Ionicons
                  name={factor.applied ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={factor.applied ? colors.success : colors.textMuted}
                />
                <Text style={styles.factorText}>{factor.description}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>Could not compute price suggestion</Text>
        )}
      </View>

      {/* Listed Price Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Price</Text>
        <View style={styles.priceInput}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.priceInputField}
            value={listedPrice}
            onChangeText={setListedPrice}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {/* Platform Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform</Text>
        <View style={styles.platformRow}>
          {LISTING_PLATFORMS.map((platform) => (
            <Pressable
              key={platform}
              style={[
                styles.platformChip,
                selectedPlatform === platform && {
                  backgroundColor: PLATFORM_COLORS[platform],
                  borderColor: PLATFORM_COLORS[platform],
                },
              ]}
              onPress={() => {
                setSelectedPlatform(platform);
                setHasGenerated(false);
              }}
            >
              <Text
                style={[
                  styles.platformChipText,
                  selectedPlatform === platform && styles.platformChipTextActive,
                ]}
              >
                {PLATFORM_LABELS[platform]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Generate Listing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Listing Content</Text>
        <Pressable
          style={[styles.generateButton, isGenerating && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sparkles" size={18} color="#fff" />
          )}
          <Text style={styles.generateButtonText}>
            {hasGenerated ? 'Regenerate' : 'Generate'} for {PLATFORM_LABELS[selectedPlatform]}
          </Text>
        </Pressable>

        {/* Title */}
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Listing title..."
          placeholderTextColor={colors.textMuted}
          maxLength={200}
        />

        {/* Description */}
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Listing description..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {hasGenerated && (
          <>
            <Pressable style={styles.secondaryButton} onPress={handleCopyAll}>
              <Ionicons name="copy-outline" size={18} color={colors.secondary} />
              <Text style={styles.secondaryButtonText}>Copy All to Clipboard</Text>
            </Pressable>

            {selectedPlatform !== 'other' && (
              <Pressable style={styles.secondaryButton} onPress={handleOpenPlatform}>
                <Ionicons name="open-outline" size={18} color={colors.secondary} />
                <Text style={styles.secondaryButtonText}>
                  Open {PLATFORM_LABELS[selectedPlatform]}
                </Text>
              </Pressable>
            )}
          </>
        )}

        <Pressable
          style={[styles.primaryButton, createMutation.isPending && styles.buttonDisabled]}
          onPress={handleMarkListed}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="pricetag" size={18} color="#fff" />
          )}
          <Text style={styles.primaryButtonText}>Mark as Listed</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 16,
    color: colors.error,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  backButtonText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.secondary,
  },

  // Item preview
  itemPreview: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  itemImage: {
    width: 80,
    height: 100,
    borderRadius: radii.sm,
  },
  imagePlaceholder: {
    width: 80,
    height: 100,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 20,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemBrand: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.accent,
    marginBottom: 4,
  },
  itemMeta: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  // Price card
  priceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  priceAmount: {
    fontFamily: fonts.mono.medium,
    fontSize: 32,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  confidenceBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  confidenceText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.accent,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  factorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  noDataText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Price input
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  currencySymbol: {
    fontFamily: fonts.mono.medium,
    fontSize: 24,
    color: colors.textPrimary,
    marginRight: 4,
  },
  priceInputField: {
    flex: 1,
    fontFamily: fonts.mono.medium,
    fontSize: 24,
    color: colors.textPrimary,
    padding: 0,
  },

  // Platform selector
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  platformChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  platformChipText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  platformChipTextActive: {
    color: '#fff',
  },

  // Generate button
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
    gap: 8,
    marginBottom: spacing.lg,
  },
  generateButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Text inputs
  fieldLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 120,
  },

  // Actions
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.md,
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: '#fff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  secondaryButtonText: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.secondary,
  },
});
