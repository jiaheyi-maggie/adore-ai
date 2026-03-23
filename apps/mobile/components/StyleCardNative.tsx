import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import StyleAuraNative from './StyleAuraNative';
import { colors, fonts, radii, spacing } from '../lib/theme';
import type { StyleDimensions } from '../lib/style-dimensions';

interface StyleCardNativeProps {
  dimensions: StyleDimensions;
  userName: string;
}

export default function StyleCardNative({ dimensions, userName }: StyleCardNativeProps) {
  const viewShotRef = useRef<ViewShot>(null);

  const handleShare = useCallback(async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
        return;
      }
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
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>

          <View style={styles.auraContainer}>
            <StyleAuraNative
              primaryColor={dimensions.primaryColor}
              secondaryColor={dimensions.secondaryColor}
              accentColor={dimensions.accentColor}
              complexity={dimensions.complexity}
              structure={dimensions.structure}
              size={220}
            />
          </View>

          <Text style={styles.archetypeName}>{dimensions.archetypeName}</Text>

          <View style={styles.traitRow}>
            {dimensions.traits.map((trait) => (
              <View key={trait} style={styles.traitPill}>
                <Text style={styles.traitText}>{trait}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.branding}>adore</Text>
        </View>
      </ViewShot>

      <Pressable style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={18} color={colors.surface} />
        <Text style={styles.shareText}>Share Style Card</Text>
      </Pressable>
    </View>
  );
}

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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
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
    width: 220,
    height: 220,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
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
