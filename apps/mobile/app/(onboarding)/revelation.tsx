import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '../../lib/theme';
import { completeOnboarding } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { COLOR_SEASONS } from '@adore/shared';
import type { ColorSeason, StyleProfile } from '@adore/shared';
import StyleAuraNative from '../../components/StyleAuraNative';
import { computeStyleDimensions, DEFAULT_DIMENSIONS } from '../../lib/style-dimensions';

interface DetectedItemSummary {
  description: string;
  category: string;
  colors: { dominant: string; secondary: string[] };
}

interface ArchetypeEntry {
  name: string;
  label: string;
  weight: number;
  percent: number;
}

// ── Archetype display names ───────────────────────────────────
const ARCHETYPE_LABELS: Record<string, string> = {
  minimalist: 'Minimalist',
  classic: 'Classic',
  bohemian: 'Bohemian',
  edgy: 'Edgy',
  romantic: 'Romantic',
  maximalist: 'Maximalist',
  glamorous: 'Glamorous',
  vintage: 'Vintage',
  cozy: 'Cozy',
  athletic: 'Athletic',
};

// ── Style DNA Bar Component ───────────────────────────────────

function StyleDNABar({
  entry,
  index,
}: {
  entry: ArchetypeEntry;
  index: number;
}) {
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 120;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(barOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(barWidth, {
          toValue: entry.percent,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [entry.percent, index]);

  const animatedWidth = barWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[dnaStyles.row, { opacity: barOpacity }]}>
      <Text style={dnaStyles.archetypeName}>{entry.label}</Text>
      <View style={dnaStyles.barTrack}>
        <Animated.View
          style={[dnaStyles.barFill, { width: animatedWidth }]}
        />
      </View>
      <Text style={dnaStyles.percentText}>{entry.percent}%</Text>
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function RevelationScreen() {
  const router = useRouter();
  const { refreshOnboardingStatus, user } = useAuth();
  const params = useLocalSearchParams<{
    name: string;
    occasions: string;
    liked_styles: string;
    disliked_styles: string;
    color_season: string;
    skin_undertone: string;
    best_colors: string;
    color_swatches: string;
    detected_items: string;
    photo_url: string;
    style_archetypes?: string;
  }>();

  const [isCompleting, setIsCompleting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Safe JSON parse -- Expo Router params can be strings, arrays, or already-parsed
  function safeParseArray<T = string>(value: string | string[] | undefined): T[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as T[];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If it's a single comma-separated string or just a plain string
      return typeof value === 'string' ? (value.split(',').filter(Boolean) as T[]) : [];
    }
  }

  function safeParseObject(value: string | string[] | undefined): Record<string, number> {
    if (!value || Array.isArray(value)) return {};
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, number>;
      }
      return {};
    } catch {
      return {};
    }
  }

  const name = params.name || 'there';
  const occasions = safeParseArray(params.occasions);
  const likedStyles = safeParseArray(params.liked_styles);
  const dislikedStyles = safeParseArray(params.disliked_styles);
  const colorSeason = params.color_season || null;
  const skinUndertone = params.skin_undertone || null;
  const bestColors = safeParseArray(params.best_colors);
  const colorSwatches = safeParseArray(params.color_swatches);
  const detectedItems = safeParseArray<DetectedItemSummary>(params.detected_items);
  const rawArchetypes = safeParseObject(params.style_archetypes);

  // ── Aura dimensions: compute from available data ──────────────────────
  const auraDimensions = useMemo(() => {
    if (Object.keys(rawArchetypes).length === 0 && !colorSeason) {
      return DEFAULT_DIMENSIONS;
    }

    // Build a partial StyleProfile from the onboarding data we have
    const partialProfile: StyleProfile = {
      id: '',
      user_id: '',
      color_season: colorSeason && (COLOR_SEASONS as readonly string[]).includes(colorSeason)
        ? (colorSeason as ColorSeason)
        : null,
      skin_undertone: (skinUndertone as 'warm' | 'cool' | 'neutral') ?? null,
      style_archetypes: rawArchetypes,
      color_preferences: {},
      formality_distribution: { casual: 0.3, smart_casual: 0.3, business: 0.2, formal: 0.1, black_tie: 0.1 },
      brand_affinities: {},
      price_range: { min: 0, max: 0, sweet_spot: 0 },
      avoided_styles: [],
      body_metrics: null,
      taste_vector: null,
      created_at: '',
      updated_at: '',
    };

    return computeStyleDimensions(partialProfile);
  }, [rawArchetypes, colorSeason, skinUndertone]);

  // ── Style DNA: convert archetype weights to sorted, filtered entries ──
  const archetypeEntries = useMemo((): ArchetypeEntry[] => {
    const entries = Object.entries(rawArchetypes);
    if (entries.length === 0) return [];

    // Convert weights (0-1) to percentages
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total === 0) return [];

    return entries
      .map(([key, weight]) => ({
        name: key,
        label: ARCHETYPE_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1),
        weight,
        percent: Math.round((weight / total) * 100),
      }))
      .filter((e) => e.percent >= 5) // Filter out archetypes below 5%
      .sort((a, b) => b.percent - a.percent);
  }, [rawArchetypes]);

  // ── AI Summary Sentence ──────────────────────────────────────
  const styleSummary = useMemo((): string | null => {
    if (archetypeEntries.length === 0) return null;

    const top1 = archetypeEntries[0].label.toLowerCase();

    if (archetypeEntries.length === 1) {
      return `Your style is distinctly ${top1}.`;
    }

    const top2 = archetypeEntries[1].label.toLowerCase();
    const top3 = archetypeEntries.length >= 3 ? archetypeEntries[2].label.toLowerCase() : null;

    if (top3) {
      return `You gravitate toward ${top1} with a strong ${top2} foundation, and touches of ${top3}.`;
    }
    return `You gravitate toward ${top1} with a strong ${top2} foundation.`;
  }, [archetypeEntries]);

  // Color season display name
  const seasonLabel = colorSeason
    ? colorSeason
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : null;

  // Compute "X% in your best colors" fun fact
  let colorMatchPercent: number | null = null;
  if (detectedItems.length > 0 && bestColors.length > 0) {
    const bestColorsLower = bestColors.map((c) => c.toLowerCase());
    let matchCount = 0;
    for (const item of detectedItems) {
      const itemColor = item.colors.dominant.toLowerCase();
      if (bestColorsLower.some((bc) => itemColor.includes(bc) || bc.includes(itemColor))) {
        matchCount++;
      }
    }
    colorMatchPercent = Math.round((matchCount / detectedItems.length) * 100);
  }

  const handleStartExploring = async () => {
    setIsCompleting(true);
    try {
      // Validate color_season against the enum before sending -- Gemini may have
      // returned a format that doesn't match (e.g. "Cool Summer" vs "summer-cool").
      const validColorSeason =
        colorSeason && (COLOR_SEASONS as readonly string[]).includes(colorSeason)
          ? (colorSeason as ColorSeason)
          : undefined;
      const validUndertone =
        skinUndertone && ['warm', 'cool', 'neutral'].includes(skinUndertone)
          ? (skinUndertone as 'warm' | 'cool' | 'neutral')
          : undefined;

      await completeOnboarding({
        name,
        occasions,
        liked_styles: likedStyles,
        disliked_styles: dislikedStyles,
        color_season: validColorSeason,
        skin_undertone: validUndertone,
      });

      // Refresh auth state to detect onboarding_completed = true
      await refreshOnboardingStatus();

      // Navigation will happen automatically via root layout detecting onboarding_completed
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Failed to complete onboarding', message);
      setIsCompleting(false);
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Welcome greeting */}
        <Text style={styles.welcomeText}>
          Welcome to Adore,{'\n'}
          {name}
        </Text>

        {/* Style Aura Blob — the "wow" moment */}
        <View style={styles.auraContainer}>
          <StyleAuraNative
            primaryColor={auraDimensions.primaryColor}
            secondaryColor={auraDimensions.secondaryColor}
            accentColor={auraDimensions.accentColor}
            complexity={auraDimensions.complexity}
            structure={auraDimensions.structure}
            size={200}
          />
          <Text style={styles.auraLabel}>{auraDimensions.archetypeName}</Text>
        </View>

        {/* Style DNA Spectrum */}
        {archetypeEntries.length > 0 && (
          <View style={dnaStyles.container}>
            <Text style={dnaStyles.header}>YOUR STYLE DNA</Text>
            {archetypeEntries.map((entry, i) => (
              <StyleDNABar key={entry.name} entry={entry} index={i} />
            ))}
          </View>
        )}

        {/* AI Summary Sentence */}
        {styleSummary && (
          <Text style={styles.summaryText}>{styleSummary}</Text>
        )}

        {/* Color Season Badge */}
        {seasonLabel && (
          <View style={styles.seasonBadge}>
            <View style={styles.badgeIcon}>
              <Ionicons
                name="color-palette"
                size={22}
                color={colors.accent}
              />
            </View>
            <Text style={styles.badgeLabel}>COLOR SEASON</Text>
            <Text style={styles.badgeValue}>{seasonLabel}</Text>
            {colorSwatches.length > 0 && (
              <View style={styles.miniSwatchRow}>
                {colorSwatches.slice(0, 4).map((hex, i) => (
                  <View
                    key={i}
                    style={[styles.miniSwatch, { backgroundColor: hex }]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Detected items */}
        {detectedItems.length > 0 && (
          <View style={styles.itemsSection}>
            <Text style={styles.sectionLabel}>YOUR OUTFIT TODAY</Text>
            <View style={styles.itemChips}>
              {detectedItems.map((item, i) => (
                <View key={i} style={styles.itemChip}>
                  <Text style={styles.itemChipText}>
                    {item.description || item.category}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Fun fact */}
        {colorMatchPercent !== null && colorMatchPercent > 0 && (
          <View style={styles.funFactCard}>
            <Ionicons name="bulb-outline" size={20} color={colors.accent} />
            <Text style={styles.funFactText}>
              {colorMatchPercent}% of your outfit is in your best colors
            </Text>
          </View>
        )}

        {/* CTA */}
        <Pressable
          style={[styles.primaryButton, isCompleting && styles.buttonDisabled]}
          onPress={handleStartExploring}
          disabled={isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Start Exploring</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.surface} />
            </>
          )}
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}

// ── Style DNA styles ──────────────────────────────────────────

const dnaStyles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  header: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  archetypeName: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    width: 85,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 5,
  },
  percentText: {
    fontFamily: fonts.mono.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    width: 36,
    textAlign: 'right',
  },
});

// ── Main styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['5xl'],
    paddingBottom: spacing['4xl'],
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  welcomeText: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 36,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  auraContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  auraLabel: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  summaryText: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    marginBottom: spacing['2xl'],
  },
  seasonBadge: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    minWidth: 160,
    marginBottom: spacing['2xl'],
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  badgeValue: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  miniSwatchRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  miniSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemsSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  sectionLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  itemChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  itemChip: {
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  itemChipText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textPrimary,
  },
  funFactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing['3xl'],
  },
  funFactText: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 18,
    paddingHorizontal: spacing['4xl'],
    width: '100%',
    marginTop: 'auto',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 17,
    fontWeight: '600',
    color: colors.surface,
  },
});
