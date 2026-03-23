import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, radii, spacing } from '../../lib/theme';
import { uploadImage, analyzeColors, type ColorAnalysisResult } from '../../lib/api';

type ScreenPhase = 'prompt' | 'analyzing' | 'result';

export default function ColorAnalysisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string;
    occasions: string;
    liked_styles: string;
    disliked_styles: string;
    // Legacy compat — may also receive style_archetypes
    style_archetypes?: string;
  }>();

  const [phase, setPhase] = useState<ScreenPhase>('prompt');
  const [result, setResult] = useState<ColorAnalysisResult | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateToPhase = (newPhase: ScreenPhase) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setPhase(newPhase);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const processImage = async (imageUri: string) => {
    animateToPhase('analyzing');
    try {
      const { public_url } = await uploadImage(imageUri);
      const response = await analyzeColors(public_url);
      setResult(response.data);
      animateToPhase('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Color analysis failed';
      Alert.alert('Analysis failed', message);
      animateToPhase('prompt');
    }
  };

  const handleTakeSelfie = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Please allow camera access in Settings to take a selfie.',
        );
        return;
      }

      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (pickerResult.canceled) return;
      await processImage(pickerResult.assets[0].uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Color analysis failed';
      Alert.alert('Analysis failed', message);
      animateToPhase('prompt');
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (pickerResult.canceled) return;
      await processImage(pickerResult.assets[0].uri);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Color analysis failed';
      Alert.alert('Analysis failed', message);
      animateToPhase('prompt');
    }
  };

  const handleContinue = () => {
    router.push({
      pathname: '/first-outfit',
      params: {
        name: params.name,
        occasions: params.occasions ?? '[]',
        liked_styles: params.liked_styles ?? '[]',
        disliked_styles: params.disliked_styles ?? '[]',
        color_season: result?.color_season ?? '',
        skin_undertone: result?.skin_undertone ?? '',
        best_colors: result?.best_colors ? JSON.stringify(result.best_colors) : '[]',
        color_swatches: result?.color_swatches
          ? JSON.stringify(result.color_swatches)
          : '[]',
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/first-outfit',
      params: {
        name: params.name,
        occasions: params.occasions ?? '[]',
        liked_styles: params.liked_styles ?? '[]',
        disliked_styles: params.disliked_styles ?? '[]',
        color_season: '',
        skin_undertone: '',
        best_colors: '[]',
        color_swatches: '[]',
      },
    });
  };

  // ── Prompt Phase ────────────────────────────────────────

  if (phase === 'prompt') {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.heading}>Let's find your colors</Text>
          <Text style={styles.subtext}>
            Take a quick selfie in natural light.{'\n'}No filters, just you.
          </Text>

          {/* Camera viewfinder placeholder */}
          <View style={styles.viewfinder}>
            <View style={styles.viewfinderInner}>
              <Ionicons name="person-outline" size={64} color={colors.accentSoft} />
            </View>
            {/* Corner accents */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          <Pressable style={styles.cameraButton} onPress={handleTakeSelfie}>
            <Ionicons name="camera" size={28} color={colors.surface} />
          </Pressable>

          <Pressable style={styles.libraryButton} onPress={handleChooseFromLibrary}>
            <Ionicons name="images-outline" size={20} color={colors.secondary} />
            <Text style={styles.libraryButtonText}>Choose from Library</Text>
          </Pressable>
        </Animated.View>

        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      </View>
    );
  }

  // ── Analyzing Phase ─────────────────────────────────────

  if (phase === 'analyzing') {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.heading}>Analyzing your colors...</Text>
          <Text style={styles.subtext}>
            Looking at your skin tone, hair, and features.
          </Text>
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={{ marginTop: spacing['3xl'] }}
          />
        </Animated.View>
      </View>
    );
  }

  // ── Result Phase ────────────────────────────────────────

  const seasonLabel = result?.color_season
    ? result.color_season
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : 'Unknown';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.resultLabel}>YOUR COLOR SEASON</Text>
        <Text style={styles.resultSeason}>{seasonLabel}</Text>

        {result?.reasoning && (
          <Text style={styles.resultReasoning}>{result.reasoning}</Text>
        )}

        {/* Color swatches */}
        {result?.color_swatches && result.color_swatches.length > 0 && (
          <View style={styles.swatchRow}>
            {result.color_swatches.slice(0, 4).map((hex, i) => (
              <View
                key={i}
                style={[styles.swatch, { backgroundColor: hex }]}
              />
            ))}
          </View>
        )}

        {/* Best colors list */}
        {result?.best_colors && result.best_colors.length > 0 && (
          <View style={styles.bestColorsContainer}>
            <Text style={styles.bestColorsLabel}>YOUR BEST COLORS</Text>
            <View style={styles.bestColorsGrid}>
              {result.best_colors.slice(0, 8).map((color, i) => (
                <View key={i} style={styles.colorChip}>
                  <Text style={styles.colorChipText}>{color}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Pressable style={styles.primaryButton} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.surface} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing['3xl'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 32,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtext: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  viewfinder: {
    width: 220,
    height: 220,
    borderRadius: radii['2xl'],
    borderWidth: 2,
    borderColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing['2xl'],
    position: 'relative',
  },
  viewfinderInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.accent,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: radii['2xl'],
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: radii['2xl'],
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: radii['2xl'],
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: radii['2xl'],
  },
  cameraButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  libraryButtonText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondary,
  },
  skipButton: {
    alignItems: 'center',
    paddingBottom: spacing['4xl'],
  },
  skipText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Result phase
  resultLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  resultSeason: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 36,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  resultReasoning: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bestColorsContainer: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  bestColorsLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  bestColorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  colorChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  colorChipText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textPrimary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: spacing['3xl'],
  },
  primaryButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
});
