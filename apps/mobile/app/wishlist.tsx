import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, fonts, typography, spacing, radii } from '../lib/theme';
import {
  listWishlistItems,
  getCurrentBudget,
  setBudget,
  updateBudget,
  dismissWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  getHappinessScore,
  type ListWishlistItemsParams,
  type BudgetCurrentResponse,
} from '../lib/api';
import type { WishlistItem, WishlistPriority, HappinessScore } from '@adore/shared';

// ── Priority config ──────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  WishlistPriority,
  { label: string; color: string; bg: string }
> = {
  need: { label: 'Need', color: '#4A6B4A', bg: '#D4E6D4' },
  want: { label: 'Want', color: '#8B6914', bg: '#E8D5C4' },
  dream: { label: 'Dream', color: '#8B5A6B', bg: '#E8D0D8' },
};

const FILTER_TABS = [
  { key: 'all' as const, label: 'All' },
  { key: 'need' as const, label: 'Need' },
  { key: 'want' as const, label: 'Want' },
  { key: 'dream' as const, label: 'Dream' },
];

// ── Budget Bar ───────────────────────────────────────────────

function BudgetBar({
  budget,
  onSetBudget,
}: {
  budget: BudgetCurrentResponse | null;
  onSetBudget: () => void;
}) {
  if (!budget) {
    return (
      <Pressable style={styles.budgetPrompt} onPress={onSetBudget}>
        <Ionicons name="wallet-outline" size={18} color={colors.accent} />
        <Text style={styles.budgetPromptText}>Set your monthly budget</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
    );
  }

  const remaining = budget.remaining_amount;
  const total = budget.budget_amount;
  const pct = total > 0 ? Math.min(100, Math.max(0, budget.utilization_pct)) : 0;
  const overBudget = remaining < 0;

  return (
    <View style={styles.budgetBar}>
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetLabel}>Monthly Budget</Text>
        <Pressable onPress={onSetBudget} hitSlop={8}>
          <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.budgetTrack}>
        <View
          style={[
            styles.budgetFill,
            {
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: overBudget
                ? colors.error
                : pct > 80
                  ? colors.warning
                  : colors.accent,
            },
          ]}
        />
      </View>
      <View style={styles.budgetFooter}>
        <Text
          style={[
            styles.budgetAmount,
            overBudget && { color: colors.error },
          ]}
        >
          ${Math.abs(remaining).toFixed(0)}{' '}
          {overBudget ? 'over' : 'remaining'}
        </Text>
        <Text style={styles.budgetTotal}>of ${total.toFixed(0)}</Text>
      </View>
    </View>
  );
}

// ── Happiness Glow Card ──────────────────────────────────────

function WishlistCard({
  item,
  onDismiss,
  onChangePriority,
  onMarkPurchased,
  onCalculateHappiness,
  onPress,
}: {
  item: WishlistItem;
  onDismiss: (id: string) => void;
  onChangePriority: (id: string, priority: WishlistPriority) => void;
  onMarkPurchased: (id: string) => void;
  onCalculateHappiness: (id: string) => void;
  onPress: (item: WishlistItem) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const score = item.happiness_score_prediction
    ? Number(item.happiness_score_prediction)
    : null;
  const priorityCfg = PRIORITY_CONFIG[item.priority];

  // Glow logic: gold for 7+, neutral 4-6, none <4
  const glowStyle =
    score != null && score >= 7
      ? styles.cardGlowHigh
      : score != null && score >= 4
        ? styles.cardGlowMedium
        : null;

  return (
    <Pressable
      style={[styles.card, glowStyle]}
      onPress={() => onPress(item)}
      onLongPress={() => setShowActions(true)}
    >
      {/* Image */}
      <View style={styles.cardImageWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        {/* Priority badge */}
        <View
          style={[styles.priorityBadge, { backgroundColor: priorityCfg.bg }]}
        >
          <Text style={[styles.priorityBadgeText, { color: priorityCfg.color }]}>
            {priorityCfg.label}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.name}
        </Text>
        {item.brand && (
          <Text style={styles.cardBrand} numberOfLines={1}>
            {item.brand}
          </Text>
        )}

        <View style={styles.cardRow}>
          {item.price != null && (
            <Text style={styles.cardPrice}>
              ${Number(item.price).toFixed(0)}
            </Text>
          )}
          {score != null && (
            <Pressable
              style={styles.scoreChip}
              onPress={() => onCalculateHappiness(item.id)}
              hitSlop={6}
            >
              <Ionicons
                name="heart"
                size={12}
                color={score >= 7 ? '#D4A04A' : score >= 4 ? colors.textSecondary : colors.textMuted}
              />
              <Text
                style={[
                  styles.scoreText,
                  score >= 7 && { color: '#D4A04A' },
                ]}
              >
                {score.toFixed(1)}
              </Text>
            </Pressable>
          )}
          {score == null && (
            <Pressable
              style={styles.calcButton}
              onPress={() => onCalculateHappiness(item.id)}
              hitSlop={6}
            >
              <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
              <Text style={styles.calcButtonText}>Score</Text>
            </Pressable>
          )}
        </View>

        {/* Similar owned warning */}
        {item.similar_owned_count >= 2 && (
          <View style={styles.warningRow}>
            <Ionicons name="copy-outline" size={12} color={colors.warning} />
            <Text style={styles.warningText}>
              {item.similar_owned_count} similar owned
            </Text>
          </View>
        )}

        {/* Anti-impulse card for low scores */}
        {score != null && score < 5 && (
          <View style={styles.antiImpulseCard}>
            <Text style={styles.antiImpulseText}>
              Based on your history, similar items average few wears.
            </Text>
          </View>
        )}

        {/* Encouragement for high scores */}
        {score != null && score >= 7 && (
          <View style={styles.encourageCard}>
            <Text style={styles.encourageText}>
              This fills a gap in your wardrobe
            </Text>
          </View>
        )}
      </View>

      {/* Quick actions */}
      {showActions && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
          <Pressable
            style={styles.actionsOverlay}
            onPress={() => setShowActions(false)}
          >
            <View style={styles.actionsSheet}>
              <Text style={styles.actionsTitle}>{item.name}</Text>

              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  onMarkPurchased(item.id);
                  setShowActions(false);
                }}
              >
                <Ionicons name="bag-check-outline" size={20} color={colors.success} />
                <Text style={styles.actionText}>Mark as Purchased</Text>
              </Pressable>

              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  onDismiss(item.id);
                  setShowActions(false);
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={styles.actionText}>Dismiss</Text>
              </Pressable>

              <View style={styles.actionDivider} />
              <Text style={styles.actionSectionLabel}>CHANGE PRIORITY</Text>

              {(['need', 'want', 'dream'] as WishlistPriority[]).map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.actionRow,
                    item.priority === p && styles.actionRowActive,
                  ]}
                  onPress={() => {
                    onChangePriority(item.id, p);
                    setShowActions(false);
                  }}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: PRIORITY_CONFIG[p].color },
                    ]}
                  />
                  <Text style={styles.actionText}>{PRIORITY_CONFIG[p].label}</Text>
                  {item.priority === p && (
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                  )}
                </Pressable>
              ))}

              <View style={styles.actionDivider} />

              <Pressable
                style={styles.actionRow}
                onPress={() => setShowActions(false)}
              >
                <Ionicons name="arrow-back" size={20} color={colors.textMuted} />
                <Text style={[styles.actionText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </Pressable>
  );
}

// ── Budget Modal ─────────────────────────────────────────────

function BudgetModal({
  visible,
  currentBudget,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  currentBudget: BudgetCurrentResponse | null;
  onClose: () => void;
  onSave: (amount: number) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState(
    currentBudget ? String(currentBudget.budget_amount) : ''
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Monthly Budget</Text>
          <Text style={styles.modalSubtitle}>
            How much do you want to spend on clothes this month?
          </Text>

          <View style={styles.budgetInputWrap}>
            <Text style={styles.budgetCurrency}>$</Text>
            <TextInput
              style={styles.budgetInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="300"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalSave,
                (!amount || saving) && styles.modalSaveDisabled,
              ]}
              onPress={() => {
                const num = parseFloat(amount);
                if (!isNaN(num) && num >= 0) onSave(num);
              }}
              disabled={!amount || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Happiness Detail Modal ───────────────────────────────────

function HappinessDetailModal({
  visible,
  score,
  loading,
  onClose,
}: {
  visible: boolean;
  score: HappinessScore | null;
  loading: boolean;
  onClose: () => void;
}) {
  if (!visible) return null;

  const breakdownLabels: Record<string, string> = {
    wear_frequency_prediction: 'Wear Frequency',
    versatility_score: 'Versatility',
    aspiration_alignment: 'Goal Alignment',
    budget_impact: 'Budget Impact',
    uniqueness_in_wardrobe: 'Uniqueness',
    emotional_prediction: 'Emotional Fit',
    cost_per_wear_projection: 'Cost per Wear',
    seasonal_relevance: 'Seasonal',
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Calculating happiness...</Text>
            </View>
          ) : score ? (
            <>
              <View style={styles.scoreHeader}>
                <Text style={styles.scoreBig}>
                  {score.overall.toFixed(1)}
                </Text>
                <Text style={styles.scoreOutOf}>/10</Text>
              </View>

              <Text style={styles.reasoningText}>{score.reasoning}</Text>

              {/* Breakdown */}
              <View style={styles.breakdownList}>
                {Object.entries(score.breakdown).map(([key, value]) => (
                  <View key={key} style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      {breakdownLabels[key] ?? key}
                    </Text>
                    <View style={styles.breakdownBarTrack}>
                      <View
                        style={[
                          styles.breakdownBarFill,
                          {
                            width: `${(value / 10) * 100}%`,
                            backgroundColor:
                              value >= 7
                                ? colors.success
                                : value >= 4
                                  ? colors.warning
                                  : colors.error,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.breakdownValue}>
                      {value.toFixed(1)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Flags */}
              {score.flags.length > 0 && (
                <View style={styles.flagsList}>
                  {score.flags.map((flag, i) => (
                    <View
                      key={i}
                      style={[
                        styles.flagRow,
                        flag.severity === 'critical' && styles.flagCritical,
                        flag.severity === 'warning' && styles.flagWarning,
                        flag.severity === 'info' && styles.flagInfo,
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
                        size={16}
                        color={
                          flag.severity === 'critical'
                            ? colors.error
                            : flag.severity === 'warning'
                              ? colors.warning
                              : colors.accent
                        }
                      />
                      <Text style={styles.flagText}>{flag.message}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.confidenceText}>
                Confidence: {Math.round(score.confidence * 100)}%
              </Text>
            </>
          ) : (
            <Text style={styles.errorText}>Failed to calculate score</Text>
          )}

          <Pressable style={styles.modalDismiss} onPress={onClose}>
            <Text style={styles.modalDismissText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────

export default function WishlistScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<'all' | WishlistPriority>('all');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [happinessModal, setHappinessModal] = useState<{
    visible: boolean;
    score: HappinessScore | null;
    loading: boolean;
  }>({ visible: false, score: null, loading: false });

  // Data queries
  const queryParams: ListWishlistItemsParams = useMemo(
    () => ({
      status: 'active',
      priority: activeFilter === 'all' ? undefined : activeFilter,
      sort: 'happiness',
      limit: 50,
    }),
    [activeFilter]
  );

  const {
    data: itemsResponse,
    isLoading: itemsLoading,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['wishlist-items', queryParams],
    queryFn: () => listWishlistItems(queryParams),
  });

  const { data: budgetResponse, refetch: refetchBudget } = useQuery({
    queryKey: ['budget-current'],
    queryFn: () => getCurrentBudget(),
  });

  const items = itemsResponse?.data ?? [];
  const budget = (budgetResponse?.data ?? null) as BudgetCurrentResponse | null;

  // Mutations
  const dismissMutation = useMutation({
    mutationFn: (id: string) => dismissWishlistItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      updateWishlistItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
    },
  });

  const setBudgetMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (budget) {
        return updateBudget(budget.id, amount);
      }
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return setBudget({
        budget_amount: amount,
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-current'] });
      setShowBudgetModal(false);
    },
  });

  const handleCalculateHappiness = useCallback(
    async (itemId: string) => {
      setHappinessModal({ visible: true, score: null, loading: true });
      try {
        const result = await getHappinessScore(itemId);
        setHappinessModal({ visible: true, score: result.data, loading: false });
        // Refresh the list to pick up the new score
        queryClient.invalidateQueries({ queryKey: ['wishlist-items'] });
      } catch {
        setHappinessModal({ visible: true, score: null, loading: false });
      }
    },
    [queryClient]
  );

  const handleItemPress = useCallback(
    (item: WishlistItem) => {
      // If no happiness score yet, calculate it
      if (item.happiness_score_prediction == null) {
        handleCalculateHappiness(item.id);
      } else {
        // Show the score
        handleCalculateHappiness(item.id);
      }
    },
    [handleCalculateHappiness]
  );

  const onRefresh = useCallback(() => {
    refetchItems();
    refetchBudget();
  }, [refetchItems, refetchBudget]);

  // ── Empty state ──────────────────────────────────────────
  if (!itemsLoading && items.length === 0 && activeFilter === 'all') {
    return (
      <View style={styles.container}>
        <BudgetBar
          budget={budget}
          onSetBudget={() => setShowBudgetModal(true)}
        />
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Your wish list is empty</Text>
          <Text style={styles.emptySubtitle}>
            Screenshot something you want to buy, and Adore will tell you if
            it's worth it based on your wardrobe and budget.
          </Text>

          <Pressable
            style={styles.addButton}
            onPress={() => router.push('/add-wishlist-item')}
          >
            <Ionicons name="camera-outline" size={20} color="#fff" />
            <Text style={styles.addText}>Add from Screenshot</Text>
          </Pressable>

          <Pressable
            style={styles.addButtonSecondary}
            onPress={() =>
              router.push({ pathname: '/add-wishlist-item', params: { mode: 'manual' } })
            }
          >
            <Ionicons name="add" size={20} color={colors.accent} />
            <Text style={styles.addTextSecondary}>Add Manually</Text>
          </Pressable>
        </View>

        <BudgetModal
          visible={showBudgetModal}
          currentBudget={budget}
          onClose={() => setShowBudgetModal(false)}
          onSave={(amount) => setBudgetMutation.mutate(amount)}
          saving={setBudgetMutation.isPending}
        />
      </View>
    );
  }

  // ── Main list view ───────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Budget */}
      <BudgetBar
        budget={budget}
        onSetBudget={() => setShowBudgetModal(true)}
      />

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTab,
              activeFilter === tab.key && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}

        {/* Add button */}
        <Pressable
          style={styles.addFab}
          onPress={() => router.push('/add-wishlist-item')}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Items list */}
      {itemsLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <WishlistCard
              item={item}
              onDismiss={(id) => dismissMutation.mutate(id)}
              onChangePriority={(id, priority) =>
                updateMutation.mutate({ id, updates: { priority } })
              }
              onMarkPurchased={(id) =>
                updateMutation.mutate({ id, updates: { status: 'purchased' } })
              }
              onCalculateHappiness={handleCalculateHappiness}
              onPress={handleItemPress}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyFilter}>
              <Text style={styles.emptyFilterText}>
                No {activeFilter !== 'all' ? activeFilter : ''} items
              </Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <BudgetModal
        visible={showBudgetModal}
        currentBudget={budget}
        onClose={() => setShowBudgetModal(false)}
        onSave={(amount) => setBudgetMutation.mutate(amount)}
        saving={setBudgetMutation.isPending}
      />

      <HappinessDetailModal
        visible={happinessModal.visible}
        score={happinessModal.score}
        loading={happinessModal.loading}
        onClose={() =>
          setHappinessModal({ visible: false, score: null, loading: false })
        }
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Budget
  budgetPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  budgetPromptText: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  budgetBar: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  budgetLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  budgetTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 3,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  budgetAmount: {
    fontFamily: fonts.mono.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  budgetTotal: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterTabText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
  },
  addFab: {
    marginLeft: 'auto',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cards
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGlowHigh: {
    borderColor: '#D4A04A',
    borderWidth: 1.5,
    shadowColor: '#D4A04A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  cardGlowMedium: {
    borderColor: colors.border,
  },
  cardImageWrap: {
    width: 100,
    position: 'relative',
  },
  cardImage: {
    width: 100,
    height: '100%',
    minHeight: 120,
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    width: 100,
    minHeight: 120,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  priorityBadgeText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  cardBrand: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  cardPrice: {
    fontFamily: fonts.mono.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.background,
    borderRadius: radii.full,
  },
  scoreText: {
    fontFamily: fonts.mono.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  calcButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
  },
  calcButtonText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.accent,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  warningText: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.warning,
  },
  antiImpulseCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FFF5F0',
    borderRadius: radii.sm,
  },
  antiImpulseText: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.error,
    lineHeight: 15,
  },
  encourageCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#F5F8F5',
    borderRadius: radii.sm,
  },
  encourageText: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.success,
    lineHeight: 15,
  },

  // Actions overlay
  actionsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  actionsSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  actionsTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  actionRowActive: {
    opacity: 0.6,
  },
  actionText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  actionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  actionSectionLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // Empty states
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
  addText: {
    fontFamily: fonts.inter.medium,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  addButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  addTextSecondary: {
    fontFamily: fonts.inter.medium,
    color: colors.accent,
    fontSize: 16,
  },
  emptyFilter: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textMuted,
  },

  // Loading
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing['2xl'],
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  budgetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  budgetCurrency: {
    fontFamily: fonts.mono.medium,
    fontSize: 24,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  budgetInput: {
    flex: 1,
    fontFamily: fonts.mono.medium,
    fontSize: 24,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalSave: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    color: '#fff',
  },

  // Happiness detail modal
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.lg,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  scoreBig: {
    fontFamily: fonts.mono.medium,
    fontSize: 48,
    color: colors.textPrimary,
  },
  scoreOutOf: {
    fontFamily: fonts.mono.regular,
    fontSize: 20,
    color: colors.textMuted,
    marginLeft: 2,
  },
  reasoningText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  breakdownList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownLabel: {
    width: 100,
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    width: 28,
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  flagsList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  flagCritical: {
    backgroundColor: '#FFF0F0',
  },
  flagWarning: {
    backgroundColor: '#FFF8F0',
  },
  flagInfo: {
    backgroundColor: '#F0F5FF',
  },
  flagText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  confidenceText: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
    paddingVertical: spacing['3xl'],
  },
  modalDismiss: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  modalDismissText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    color: colors.accent,
  },
});
