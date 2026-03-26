import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import type { ProductSearchResult } from '@adore/shared';
import {
  searchWishlistProducts,
  checkPurchase,
  dismissWishlistItem,
  type CheckPurchaseResponse,
} from '../lib/api';
import ProductCard from '../components/ProductCard';
import { colors, fonts, spacing, radii } from '../lib/theme';

type FlowStep = 'search' | 'loading' | 'result';

export default function CheckPurchaseScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<FlowStep>('search');
  const [result, setResult] = useState<CheckPurchaseResponse | null>(null);
  const [isActing, setIsActing] = useState(false);

  // ── Product Search ──────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Manual entry
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualBrand, setManualBrand] = useState('');

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

  // ── Check Handler ──────────────────────────────────────────

  const handleCheck = useCallback(async (payload: {
    name: string;
    price?: number | null;
    brand?: string | null;
    source_url?: string | null;
    image_url?: string | null;
    external_product_id?: string | null;
  }) => {
    setStep('loading');
    try {
      const res = await checkPurchase(payload);
      setResult(res.data);
      setStep('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Check failed';
      Alert.alert('Error', message);
      setStep('search');
    }
  }, []);

  const handleSelectProduct = useCallback((product: ProductSearchResult) => {
    handleCheck({
      name: product.name,
      price: product.price ?? null,
      brand: product.brand ?? null,
      source_url: product.source_url || null,
      image_url: product.image_url || null,
      external_product_id: product.external_product_id ?? null,
    });
  }, [handleCheck]);

  const handleManualCheck = useCallback(() => {
    if (!manualName.trim()) return;
    const priceNum = manualPrice ? parseFloat(manualPrice) : null;
    handleCheck({
      name: manualName.trim(),
      price: priceNum != null && !isNaN(priceNum) ? priceNum : null,
      brand: manualBrand.trim() || null,
    });
  }, [manualName, manualPrice, manualBrand, handleCheck]);

  // ── Action Handlers ────────────────────────────────────────

  const handleBuyNow = useCallback(() => {
    if (!result) return;
    const url = result.affiliate_url || result.item.source_url;
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Could not open link', 'The product URL may be invalid.');
      });
    }
  }, [result]);

  const handleSaveToWishlist = useCallback(() => {
    if (isActing) return;
    setIsActing(true);
    queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    router.back();
  }, [queryClient, router, isActing]);

  const handleNotInterested = useCallback(async () => {
    if (!result || isActing) return;
    setIsActing(true);
    try {
      await dismissWishlistItem(result.item.id);
    } catch {
      // Non-fatal — item may already be dismissed
    }
    queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    router.back();
  }, [result, queryClient, router, isActing]);

  // ── Render: Search Step ────────────────────────────────────

  if (step === 'search') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.searchWrapper}>
          <Text style={styles.title}>Check a Purchase</Text>
          <Text style={styles.subtitle}>
            Search for something you're thinking of buying
          </Text>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
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
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => item.external_product_id ?? `${item.source_url}-${index}`}
              style={styles.resultsList}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => handleSelectProduct(item)}
                  rightAction={
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  }
                />
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              keyboardShouldPersistTaps="handled"
            />
          ) : hasSearched && searchQuery.trim().length >= 2 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          ) : (
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>
                Search for a product to check if it's worth buying.
              </Text>
            </View>
          )}

          {/* Collapsible manual entry */}
          <Pressable
            style={styles.manualToggle}
            onPress={() => setShowManual((prev) => !prev)}
          >
            <Ionicons
              name={showManual ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.manualToggleText}>Or describe it manually</Text>
          </Pressable>

          {showManual && (
            <View style={styles.manualSection}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={manualName}
                onChangeText={setManualName}
                placeholder="e.g. Wool Blend Blazer"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.label}>Price (optional)</Text>
              <TextInput
                style={styles.input}
                value={manualPrice}
                onChangeText={setManualPrice}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Brand (optional)</Text>
              <TextInput
                style={styles.input}
                value={manualBrand}
                onChangeText={setManualBrand}
                placeholder="e.g. Zara"
                placeholderTextColor={colors.textMuted}
              />

              <Pressable
                style={[
                  styles.checkButton,
                  !manualName.trim() && styles.buttonDisabled,
                ]}
                onPress={handleManualCheck}
                disabled={!manualName.trim()}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                <Text style={styles.checkButtonText}>Check</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: Loading Step ───────────────────────────────────

  if (step === 'loading') {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.processingText}>Analyzing this purchase...</Text>
        </View>
      </View>
    );
  }

  // ── Render: Result Step ────────────────────────────────────

  if (!result) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Pressable style={styles.cancelLink} onPress={() => setStep('search')}>
            <Text style={styles.cancelText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const score = result.score.overall;
  const isLow = score < 5;
  const buyUrl = result.affiliate_url || result.item.source_url;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.resultContainer}>
        {/* Score circle */}
        <View
          style={[
            styles.scoreCircle,
            score >= 8 && styles.scoreCircleHigh,
            isLow && styles.scoreCircleLow,
          ]}
        >
          <Text style={styles.scoreNumber}>{score.toFixed(1)}</Text>
          <Text style={styles.scoreOutOf}>/10</Text>
        </View>

        {/* Verdict */}
        <Text style={styles.verdictTitle}>
          {score >= 8
            ? 'Buy with confidence'
            : score >= 5
              ? 'Worth considering'
              : 'Skip it'}
        </Text>

        {/* Reasoning */}
        <Text style={styles.reasoningText}>
          {result.score.reasoning}
        </Text>

        {/* Flags */}
        {result.score.flags.length > 0 && (
          <View style={styles.flagsContainer}>
            {result.score.flags.map((flag, i) => (
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

        {/* Similar owned warning */}
        {result.item.similar_owned_count > 0 && (
          <View style={styles.similarWarning}>
            <Ionicons name="copy-outline" size={16} color={colors.textMuted} />
            <Text style={styles.similarWarningText}>
              You already own {result.item.similar_owned_count} similar item
              {result.item.similar_owned_count !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Cross-Signal Context */}
        {result.context && (
          <View style={styles.contextSection}>
            {/* Recent similar checks */}
            {result.context.recent_similar_checks.length > 0 && (
              <View style={styles.contextCard}>
                <Ionicons name="repeat-outline" size={16} color={colors.warning} />
                <Text style={styles.contextText}>
                  You've checked {result.context.recent_similar_checks.length} similar{' '}
                  {result.item.category ?? 'item'}
                  {result.context.recent_similar_checks.length !== 1 ? 's' : ''} this week
                  {result.context.recent_similar_checks.length <= 3
                    ? ': ' + result.context.recent_similar_checks.map((c) => c.name).join(', ')
                    : ''}
                </Text>
              </View>
            )}

            {/* Dormant similar items */}
            {result.context.dormant_similar_items.length > 0 && (
              <View style={styles.contextCard}>
                <Ionicons name="moon-outline" size={16} color={colors.textMuted} />
                <Text style={styles.contextText}>
                  You own {result.context.dormant_similar_items.length} similar{' '}
                  {result.context.dormant_similar_items.length !== 1 ? 'items' : 'item'} you
                  haven't worn in 45+ days
                  {result.context.dormant_similar_items.length <= 2
                    ? ': ' + result.context.dormant_similar_items.map((d) => d.name).join(', ')
                    : ''}
                </Text>
              </View>
            )}

            {/* Budget impact */}
            {result.context.budget && (
              <View style={styles.contextCard}>
                <Ionicons
                  name="wallet-outline"
                  size={16}
                  color={result.context.budget.this_purchase_pushes_to > 90 ? colors.error : colors.accent}
                />
                <Text style={styles.contextText}>
                  Budget: {result.context.budget.percent_spent}% spent
                  {result.context.budget.this_purchase_pushes_to > result.context.budget.percent_spent
                    ? ` → ${result.context.budget.this_purchase_pushes_to}% after this purchase`
                    : ''}
                  {' '}({result.context.budget.days_remaining} days left)
                </Text>
              </View>
            )}

            {/* Style shift alignment */}
            {result.context.style_shift && (
              <View style={styles.contextCard}>
                <Ionicons
                  name={result.context.style_shift.fills_gap ? 'checkmark-circle' : 'compass-outline'}
                  size={16}
                  color={result.context.style_shift.fills_gap ? colors.success : colors.accent}
                />
                <Text style={styles.contextText}>
                  {result.context.style_shift.fills_gap
                    ? `Fills a gap in your "${result.context.style_shift.goal_name}" style shift`
                    : `You're shifting toward "${result.context.style_shift.goal_name}"`}
                </Text>
              </View>
            )}
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

        {/* Action buttons */}
        <View style={[styles.actionButtons, isActing && { opacity: 0.5, pointerEvents: 'none' }]}>
          {score >= 5 && buyUrl && (
            <Pressable style={styles.buyButton} onPress={handleBuyNow} disabled={isActing}>
              <Ionicons name="bag-check-outline" size={20} color="#fff" />
              <Text style={styles.buyButtonText}>Buy Now</Text>
            </Pressable>
          )}

          <Pressable style={styles.saveButton} onPress={handleSaveToWishlist} disabled={isActing}>
            <Ionicons name="heart-outline" size={20} color={colors.accent} />
            <Text style={styles.saveButtonText}>Keep in Wishlist</Text>
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={handleNotInterested} disabled={isActing}>
            <Text style={styles.cancelText}>Not interested</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Search step
  searchWrapper: {
    flex: 1,
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.xl,
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
    marginBottom: spacing.xl,
    lineHeight: 20,
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

  // Manual entry
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  manualToggleText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  manualSection: {
    paddingBottom: spacing.md,
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
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    marginTop: spacing.xl,
  },
  checkButtonText: {
    fontFamily: fonts.inter.semibold,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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

  // Loading step
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  processingText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },

  // Result step
  resultContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['5xl'],
    paddingBottom: 60,
  },
  scoreCircle: {
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
  scoreCircleHigh: {
    borderColor: '#D4A04A',
    shadowColor: '#D4A04A',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  scoreCircleLow: {
    borderColor: colors.textMuted,
  },
  scoreNumber: {
    fontFamily: fonts.mono.medium,
    fontSize: 40,
    color: colors.textPrimary,
  },
  scoreOutOf: {
    fontFamily: fonts.mono.regular,
    fontSize: 18,
    color: colors.textMuted,
    marginTop: 12,
  },
  verdictTitle: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  reasoningText: {
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
  similarWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  similarWarningText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  contextSection: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contextText: {
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

  // Action buttons
  actionButtons: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buyButton: {
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
  buyButtonText: {
    fontFamily: fonts.inter.semibold,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  saveButtonText: {
    fontFamily: fonts.inter.medium,
    color: colors.accent,
    fontSize: 16,
    fontWeight: '500',
  },
});
