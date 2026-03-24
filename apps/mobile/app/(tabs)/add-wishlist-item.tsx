import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ITEM_CATEGORIES, WISHLIST_PRIORITIES, type ItemCategory, type WishlistPriority } from '@adore/shared';
import {
  uploadImage,
  scanWishlistItem,
  createWishlistItem,
  getHappinessScore,
  searchWishlistProducts,
  type ScannedWishlistItem,
} from '../../lib/api';
import type { ProductSearchResult } from '@adore/shared';
import ProductCard from '../../components/ProductCard';
import WishlistButton from '../../components/WishlistButton';
import { colors, fonts, spacing, radii } from '../../lib/theme';
import type { HappinessScore } from '@adore/shared';

type FlowStep = 'search' | 'pick' | 'processing' | 'review' | 'happiness-result';

const PRIORITY_CONFIG: Record<
  WishlistPriority,
  { label: string; color: string; bg: string }
> = {
  need: { label: 'Need', color: '#4A6B4A', bg: '#D4E6D4' },
  want: { label: 'Want', color: '#8B6914', bg: '#E8D5C4' },
  dream: { label: 'Dream', color: '#8B5A6B', bg: '#E8D0D8' },
};

export default function AddWishlistItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<FlowStep>(
    params.mode === 'manual' ? 'review' : 'search'
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [scannedData, setScannedData] = useState<ScannedWishlistItem | null>(null);
  const [happinessResult, setHappinessResult] = useState<HappinessScore | null>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ItemCategory | ''>('');
  const [priority, setPriority] = useState<WishlistPriority>('want');
  const [sourceUrl, setSourceUrl] = useState('');
  const [externalProductId, setExternalProductId] = useState<string | null>(null);

  // ── Product Search ──────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search: fires 500ms after user stops typing
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const res = await searchWishlistProducts(searchQuery.trim());
        if (!cancelled) setSearchResults(res.data?.results ?? []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const handleSelectProduct = useCallback((product: ProductSearchResult) => {
    setName(product.name);
    setBrand(product.brand ?? '');
    setPrice(product.price ? String(product.price) : '');
    setSourceUrl(product.source_url);
    setUploadedImageUrl(product.image_url || null);
    setExternalProductId(product.external_product_id ?? null);
    setStep('review');
  }, []);

  const handleManualEntry = useCallback(() => {
    setExternalProductId(null);
    setSourceUrl('');
    setUploadedImageUrl(null);
    setStep('review');
  }, []);

  // ── Image Picking ──────────────────────────────────────────

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    let pickerResult: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }
      pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
    }

    if (!pickerResult.canceled && pickerResult.assets[0]) {
      const uri = pickerResult.assets[0].uri;
      setImageUri(uri);
      processScreenshot(uri);
    }
  }, []);

  // ── Processing Pipeline ────────────────────────────────────

  const processScreenshot = useCallback(async (uri: string) => {
    setStep('processing');
    setExternalProductId(null);
    setSourceUrl('');

    try {
      // Step 1: Upload
      setProcessingStatus('Uploading screenshot...');
      const uploaded = await uploadImage(uri);
      setUploadedImageUrl(uploaded.public_url);

      // Step 2: Extract product details via Gemini
      setProcessingStatus('Extracting product details...');
      const result = await scanWishlistItem(uploaded.public_url);
      setScannedData(result.data);

      // Pre-fill fields
      if (result.data) {
        setName(result.data.name || '');
        setBrand(result.data.brand || '');
        if (result.data.price != null) {
          setPrice(String(result.data.price));
        }
        if (
          result.data.category &&
          (ITEM_CATEGORIES as readonly string[]).includes(result.data.category)
        ) {
          setCategory(result.data.category as ItemCategory);
        }
      }

      setStep('review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      Alert.alert('Error', message, [
        { text: 'Retry', onPress: () => processScreenshot(uri) },
        { text: 'Cancel', onPress: () => setStep('pick') },
      ]);
      setStep('pick');
    }
  }, []);

  // ── Save & Calculate Happiness ─────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceNum = price ? parseFloat(price) : null;
      const result = await createWishlistItem({
        name: name.trim() || 'Unnamed item',
        brand: brand.trim() || null,
        price: priceNum,
        category: category || null,
        priority,
        image_url: uploadedImageUrl,
        source_url: sourceUrl.trim() || null,
        external_product_id: externalProductId,
      });
      return result.data;
    },
    onSuccess: async (item) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });

      // Auto-calculate happiness score
      try {
        setStep('happiness-result');
        setProcessingStatus('Calculating happiness score...');
        const scoreResult = await getHappinessScore(item.id);
        setHappinessResult(scoreResult.data);
        queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
      } catch {
        // Non-fatal: item was saved, just couldn't calculate score
        router.back();
      }
    },
    onError: (err) => {
      Alert.alert('Save failed', err.message);
    },
  });

  // ── Render: Search Step (default) ────────────────────────────

  if (step === 'search') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={searchStyles.wrapper}>
          <Text style={styles.title}>Add to Wishlist</Text>

          {/* Search bar */}
          <View style={searchStyles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={searchStyles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search products, e.g. navy cashmere sweater"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Results */}
          {isSearching ? (
            <View style={searchStyles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={searchStyles.loadingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => item.external_product_id ?? `${item.source_url}-${index}`}
              style={searchStyles.resultsList}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => handleSelectProduct(item)}
                  rightAction={
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  }
                />
              )}
              ItemSeparatorComponent={() => <View style={searchStyles.separator} />}
              keyboardShouldPersistTaps="handled"
            />
          ) : hasSearched && searchQuery.trim().length >= 2 ? (
            <View style={searchStyles.emptyContainer}>
              <Ionicons name="search-outline" size={32} color={colors.textMuted} />
              <Text style={searchStyles.emptyText}>No results found</Text>
              <Pressable onPress={handleManualEntry}>
                <Text style={searchStyles.emptyLink}>Add manually instead</Text>
              </Pressable>
            </View>
          ) : (
            <View style={searchStyles.hintContainer}>
              <Text style={searchStyles.hintText}>
                Search for a product to auto-fill details, or use the options below.
              </Text>
            </View>
          )}

          {/* Secondary actions */}
          <View style={searchStyles.secondaryActions}>
            <Pressable style={searchStyles.secondaryChip} onPress={() => pickImage('library')}>
              <Ionicons name="image-outline" size={16} color={colors.secondary} />
              <Text style={searchStyles.secondaryChipText}>Screenshot</Text>
            </Pressable>
            <Pressable style={searchStyles.secondaryChip} onPress={() => pickImage('camera')}>
              <Ionicons name="camera-outline" size={16} color={colors.secondary} />
              <Text style={searchStyles.secondaryChipText}>Camera</Text>
            </Pressable>
            <Pressable style={searchStyles.secondaryChip} onPress={handleManualEntry}>
              <Ionicons name="create-outline" size={16} color={colors.secondary} />
              <Text style={searchStyles.secondaryChipText}>Manual</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: Pick Source ─────────────────────────────────────

  if (step === 'pick') {
    return (
      <View style={styles.container}>
        <View style={styles.pickContainer}>
          <Text style={styles.title}>Add to Wishlist</Text>
          <Text style={styles.subtitle}>
            Screenshot a product you're considering and let Adore analyze if
            it's worth buying.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => pickImage('library')}
          >
            <Ionicons name="image-outline" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Add from Screenshot</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => pickImage('camera')}
          >
            <Ionicons name="camera-outline" size={22} color={colors.secondary} />
            <Text style={styles.secondaryButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleManualEntry}
          >
            <Ionicons name="create-outline" size={22} color={colors.secondary} />
            <Text style={styles.secondaryButtonText}>Add Manually</Text>
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Render: Processing ─────────────────────────────────────

  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.processingContainer}>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.processingImage}
              resizeMode="cover"
            />
          )}
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={styles.processingSpinner}
          />
          <Text style={styles.processingText}>{processingStatus}</Text>
        </View>
      </View>
    );
  }

  // ── Render: Happiness Result ───────────────────────────────

  if (step === 'happiness-result') {
    if (!happinessResult) {
      return (
        <View style={styles.container}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.processingText}>Calculating happiness score...</Text>
          </View>
        </View>
      );
    }

    const score = happinessResult.overall;
    const isLow = score < 5;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.happinessContainer}>
          {/* Score display */}
          <View
            style={[
              styles.happinessCircle,
              score >= 7 && styles.happinessCircleHigh,
              isLow && styles.happinessCircleLow,
            ]}
          >
            <Text style={styles.happinessNumber}>{score.toFixed(1)}</Text>
            <Text style={styles.happinessOutOf}>/10</Text>
          </View>

          <Text style={styles.happinessTitle}>
            {score >= 7
              ? 'Great match!'
              : score >= 5
                ? 'Worth considering'
                : 'Think it over'}
          </Text>

          <Text style={styles.happinessReasoning}>
            {happinessResult.reasoning}
          </Text>

          {/* Flags */}
          {happinessResult.flags.length > 0 && (
            <View style={styles.flagsContainer}>
              {happinessResult.flags.map((flag, i) => (
                <View
                  key={i}
                  style={[
                    styles.flagPill,
                    flag.severity === 'critical' && styles.flagPillCritical,
                    flag.severity === 'warning' && styles.flagPillWarning,
                    flag.severity === 'info' && styles.flagPillInfo,
                  ]}
                >
                  <Ionicons
                    name={
                      flag.severity === 'critical'
                        ? 'alert-circle'
                        : flag.severity === 'warning'
                          ? 'warning'
                          : 'information-circle'
                    }
                    size={14}
                    color={
                      flag.severity === 'critical'
                        ? colors.error
                        : flag.severity === 'warning'
                          ? colors.warning
                          : colors.accent
                    }
                  />
                  <Text style={styles.flagPillText}>{flag.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Anti-impulse card */}
          {isLow && (
            <View style={styles.antiImpulseBox}>
              <Ionicons name="time-outline" size={20} color={colors.error} />
              <Text style={styles.antiImpulseBoxText}>
                Consider waiting 48 hours before purchasing. Items like this
                tend to average fewer wears than expected.
              </Text>
            </View>
          )}

          <Pressable
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Render: Review / Manual Entry ──────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.reviewContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Screenshot preview */}
        {uploadedImageUrl && (
          <View style={styles.imagePreviewWrap}>
            <Image
              source={{ uri: uploadedImageUrl }}
              style={styles.imagePreview}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Scanned description */}
        {scannedData?.description && (
          <View style={styles.descriptionBox}>
            <Ionicons name="sparkles" size={14} color={colors.accent} />
            <Text style={styles.descriptionText}>{scannedData.description}</Text>
          </View>
        )}

        {/* Form fields */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Item Details</Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Wool Blend Blazer"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Brand</Text>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g. Zara"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Price</Text>
          <View style={styles.priceInputWrap}>
            <Text style={styles.priceCurrency}>$</Text>
            <TextInput
              style={styles.priceInput}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            <View style={styles.categoryRow}>
              {ITEM_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {WISHLIST_PRIORITIES.map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.priorityChip,
                  priority === p && {
                    backgroundColor: PRIORITY_CONFIG[p].bg,
                    borderColor: PRIORITY_CONFIG[p].color,
                  },
                ]}
                onPress={() => setPriority(p)}
              >
                <Text
                  style={[
                    styles.priorityChipText,
                    priority === p && { color: PRIORITY_CONFIG[p].color },
                  ]}
                >
                  {PRIORITY_CONFIG[p].label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Source URL (optional)</Text>
          <TextInput
            style={styles.input}
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Actions */}
        <View style={styles.reviewActions}>
          <Pressable
            style={[
              styles.primaryButton,
              (!name.trim() || saveMutation.isPending) && styles.buttonDisabled,
            ]}
            onPress={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="heart" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  Add to Wishlist
                </Text>
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontFamily: fonts.inter.semibold,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.secondary,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontFamily: fonts.inter.medium,
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fonts.inter.regular,
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Processing
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  processingImage: {
    width: 200,
    height: 260,
    borderRadius: 12,
    marginBottom: 24,
  },
  processingSpinner: {
    marginBottom: 16,
  },
  processingText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 4,
  },

  // Review
  reviewContent: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  imagePreviewWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 240,
  },
  descriptionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  descriptionText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    fontFamily: fonts.inter.regular,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
  },
  priceCurrency: {
    fontFamily: fonts.mono.medium,
    fontSize: 18,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  priceInput: {
    flex: 1,
    fontFamily: fonts.mono.medium,
    fontSize: 18,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  categoryScroll: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryChipText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  priorityChipText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  reviewActions: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },

  // Happiness result
  happinessContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['5xl'],
    paddingBottom: 60,
  },
  happinessCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  happinessCircleHigh: {
    borderColor: '#D4A04A',
    shadowColor: '#D4A04A',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  happinessCircleLow: {
    borderColor: colors.textMuted,
  },
  happinessNumber: {
    fontFamily: fonts.mono.medium,
    fontSize: 40,
    color: colors.textPrimary,
  },
  happinessOutOf: {
    fontFamily: fonts.mono.regular,
    fontSize: 18,
    color: colors.textMuted,
    marginTop: 12,
  },
  happinessTitle: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  happinessReasoning: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  flagsContainer: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  flagPillCritical: {
    backgroundColor: '#FFF0F0',
  },
  flagPillWarning: {
    backgroundColor: '#FFF8F0',
  },
  flagPillInfo: {
    backgroundColor: '#F0F5FF',
  },
  flagPillText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  antiImpulseBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: '#FFF5F0',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#F0D0C0',
    marginBottom: spacing.xl,
    width: '100%',
  },
  antiImpulseBoxText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
});

// ── Search Step Styles ──────────────────────────────────────

const searchStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 14,
  },
  resultsList: {
    flex: 1,
    marginHorizontal: -spacing.xl,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
  emptyLink: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.accent,
    marginTop: spacing.xs,
  },
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  hintText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  secondaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryChipText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondary,
  },
});
