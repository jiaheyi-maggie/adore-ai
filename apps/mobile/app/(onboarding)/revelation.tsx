import { useState, useEffect, useRef } from 'react';
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
import type { ColorSeason } from '@adore/shared';

interface DetectedItemSummary {
  description: string;
  category: string;
  colors: { dominant: string; secondary: string[] };
}

export default function RevelationScreen() {
  const router = useRouter();
  const { refreshOnboardingStatus } = useAuth();
  const params = useLocalSearchParams<{
    name: string;
    style_archetypes: string;
    color_season: string;
    skin_undertone: string;
    best_colors: string;
    color_swatches: string;
    detected_items: string;
    photo_url: string;
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

  const name = params.name || 'there';
  const styleArchetypes: Record<string, number> = params.style_archetypes
    ? JSON.parse(params.style_archetypes)
    : {};
  const colorSeason = params.color_season || null;
  const skinUndertone = params.skin_undertone || null;
  const bestColors: string[] = params.best_colors
    ? JSON.parse(params.best_colors)
    : [];
  const colorSwatches: string[] = params.color_swatches
    ? JSON.parse(params.color_swatches)
    : [];
  const detectedItems: DetectedItemSummary[] = params.detected_items
    ? JSON.parse(params.detected_items)
    : [];

  // Compute dominant archetype
  const topArchetype = Object.entries(styleArchetypes).sort(
    ([, a], [, b]) => b - a,
  )[0];
  const archetypeLabel = topArchetype
    ? topArchetype[0].charAt(0).toUpperCase() + topArchetype[0].slice(1)
    : null;

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
      await completeOnboarding({
        name,
        style_archetypes: styleArchetypes,
        color_season: (colorSeason as ColorSeason) || undefined,
        skin_undertone: (skinUndertone as 'warm' | 'cool' | 'neutral') || undefined,
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

        {/* Badges section */}
        <View style={styles.badgesRow}>
          {/* Style Archetype Badge */}
          {archetypeLabel && (
            <View style={styles.badge}>
              <View style={styles.badgeIcon}>
                <Ionicons
                  name="sparkles"
                  size={22}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.badgeLabel}>STYLE VIBE</Text>
              <Text style={styles.badgeValue}>{archetypeLabel}</Text>
            </View>
          )}

          {/* Color Season Badge */}
          {seasonLabel && (
            <View style={styles.badge}>
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
        </View>

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
    marginBottom: spacing['3xl'],
  },
  badgesRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  badge: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
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
