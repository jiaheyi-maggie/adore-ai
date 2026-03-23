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
import {
  uploadImage,
  decomposeOutfit,
  createOutfit,
  type DecomposedItem,
} from '../../lib/api';

type ScreenPhase = 'prompt' | 'analyzing' | 'result';

export default function FirstOutfitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string;
    style_archetypes: string;
    color_season: string;
    skin_undertone: string;
    best_colors: string;
    color_swatches: string;
  }>();

  const [phase, setPhase] = useState<ScreenPhase>('prompt');
  const [decomposedItems, setDecomposedItems] = useState<DecomposedItem[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

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

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Please allow camera access in Settings to snap your outfit.',
        );
        return;
      }

      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (pickerResult.canceled) return;

      const imageUri = pickerResult.assets[0].uri;
      animateToPhase('analyzing');

      // Upload the photo
      const { public_url } = await uploadImage(imageUri);
      setPhotoUrl(public_url);

      // Decompose the outfit
      const items = await decomposeOutfit(public_url);
      setDecomposedItems(items);

      // Create the outfit journal entry with detected items as new wardrobe items
      const newItems = items.map((item) => ({
        name: item.detected_item.description || `${item.detected_item.category} item`,
        category: item.detected_item.category as any,
        subcategory: item.detected_item.subcategory ?? null,
        colors: [
          item.detected_item.colors.dominant,
          ...item.detected_item.colors.secondary,
        ],
        pattern: (item.detected_item.pattern as any) || 'solid',
        material: (item.detected_item.material as any) ?? null,
        brand: item.detected_item.brand ?? null,
        formality_level: item.detected_item.formality_level,
        seasons: (item.detected_item.seasons as any[]) || [],
        condition: (item.detected_item.condition as any) || 'good',
        image_url: public_url,
      }));

      await createOutfit({
        photo_url: public_url,
        occasion: 'casual',
        worn_date: new Date().toISOString().split('T')[0],
        notes: 'First outfit snap from onboarding',
        new_items: newItems,
      });

      animateToPhase('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process outfit';
      Alert.alert('Something went wrong', message);
      animateToPhase('prompt');
    }
  };

  const handleContinue = () => {
    router.push({
      pathname: '/revelation',
      params: {
        ...params,
        detected_items: JSON.stringify(
          decomposedItems.map((d) => ({
            description: d.detected_item.description,
            category: d.detected_item.category,
            colors: d.detected_item.colors,
          })),
        ),
        photo_url: photoUrl ?? '',
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/revelation',
      params: {
        ...params,
        detected_items: '[]',
        photo_url: '',
      },
    });
  };

  // ── Prompt Phase ────────────────────────────────────────

  if (phase === 'prompt') {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <Text style={styles.heading}>
            Snap what you're{'\n'}wearing right now
          </Text>
          <Text style={styles.subtext}>
            No judgment, pajamas count.
          </Text>

          <Pressable style={styles.cameraButton} onPress={handleTakePhoto}>
            <Ionicons name="camera" size={36} color={colors.surface} />
          </Pressable>

          <Text style={styles.hint}>
            This starts your outfit journal{'\n'}and builds your wardrobe automatically.
          </Text>
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
          <Text style={styles.heading}>Breaking down your outfit...</Text>
          <Text style={styles.subtext}>
            Identifying each piece you're wearing.
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

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Ionicons name="checkmark-circle" size={48} color={colors.success} />
        <Text style={styles.resultHeading}>
          Found {decomposedItems.length} item{decomposedItems.length !== 1 ? 's' : ''}!
        </Text>

        <View style={styles.itemsList}>
          {decomposedItems.slice(0, 6).map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View
                style={[
                  styles.categoryDot,
                  { backgroundColor: getCategoryColor(item.detected_item.category) },
                ]}
              />
              <Text style={styles.itemName} numberOfLines={1}>
                {item.detected_item.description || item.detected_item.category}
              </Text>
              <Text style={styles.itemColor}>
                {item.detected_item.colors.dominant}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.resultHint}>
          These have been added to your wardrobe.
        </Text>

        <Pressable style={styles.primaryButton} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>See Your Results</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.surface} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function getCategoryColor(category: string): string {
  const categoryColors: Record<string, string> = {
    tops: '#7BA3C9',
    bottoms: '#8B7BB5',
    dresses: '#C97B8B',
    outerwear: '#7B9B8B',
    shoes: '#C4956A',
    accessories: '#B5A08B',
    bags: '#9B8B7B',
    jewelry: '#D4B896',
    activewear: '#7BBBA3',
    swimwear: '#7BADC9',
    sleepwear: '#B5A3C4',
  };
  return categoryColors[category] ?? colors.textMuted;
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
  cameraButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing['4xl'],
    marginBottom: spacing['2xl'],
  },
  hint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
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
  resultHeading: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 28,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  itemsList: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  itemColor: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  resultHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing['3xl'],
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
