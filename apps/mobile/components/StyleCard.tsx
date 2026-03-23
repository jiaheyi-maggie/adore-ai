// ═══════════════════════════════════════════════════════════
// StyleCard — Shareable style identity card with aura blob
// Designed for Instagram Stories crop (~350x500)
// ═══════════════════════════════════════════════════════════

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import StyleAura from './StyleAura';
import { colors, fonts, radii, spacing } from '../lib/theme';
import type { StyleDimensions } from '../lib/style-dimensions';

// ── Props ───────────────────────────────────────────────────

interface StyleCardProps {
  dimensions: StyleDimensions;
  userName: string;
  /** Seed for deterministic aura shape (e.g. user ID) */
  seed?: string;
  /** Show the share button below the card */
  showShareButton?: boolean;
}

// ── Component ───────────────────────────────────────────────

export default function StyleCard({
  dimensions,
  userName,
  seed = 'default',
  showShareButton = true,
}: StyleCardProps) {
  const viewShotRef = useRef<ViewShot>(null);

  const handleShare = useCallback(async () => {
    try {
      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
        return;
      }

      // Capture the card as PNG
      // Note: Skia Canvas renders to a separate GPU surface. If ViewShot
      // cannot capture it, we fall through to the error handler.
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) {
        Alert.alert('Screenshot instead', 'Take a screenshot to share your Style Card.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your Style Aura',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Share failed', message);
    }
  }, []);

  return (
    <View style={styles.wrapper}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
      >
        <View style={styles.card} collapsable={false}>
          {/* User name at top */}
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>

          {/* Aura blob centered */}
          <View style={styles.auraContainer}>
            <StyleAura
              colorTemp={dimensions.colorTemp}
              saturation={dimensions.saturation}
              structure={dimensions.structure}
              complexity={dimensions.complexity}
              formality={dimensions.formality}
              riskTolerance={dimensions.riskTolerance}
              primaryColor={dimensions.primaryColor}
              secondaryColor={dimensions.secondaryColor}
              accentColor={dimensions.accentColor}
              size={240}
              seed={seed}
            />
          </View>

          {/* Archetype name */}
          <Text style={styles.archetypeName}>{dimensions.archetypeName}</Text>

          {/* Trait pills */}
          <View style={styles.traitRow}>
            {dimensions.traits.map((trait) => (
              <View key={trait} style={styles.traitPill}>
                <Text style={styles.traitText}>{trait}</Text>
              </View>
            ))}
          </View>

          {/* Branding */}
          <Text style={styles.branding}>adore</Text>
        </View>
      </ViewShot>

      {/* Share button outside the captured area */}
      {showShareButton && (
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={18} color={colors.surface} />
          <Text style={styles.shareText}>Share Style Card</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: '100%',
  },
  card: {
    width: 350,
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    // Subtle shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  userName: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },
  auraContainer: {
    width: 240,
    height: 240,
    marginBottom: spacing.xl,
  },
  archetypeName: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  traitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.sm,
  },
  traitPill: {
    backgroundColor: colors.background,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  traitText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  branding: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    letterSpacing: 4,
    textTransform: 'lowercase',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing['3xl'],
    marginTop: spacing.lg,
    width: 350,
  },
  shareText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    fontWeight: '600',
    color: colors.surface,
  },
});
