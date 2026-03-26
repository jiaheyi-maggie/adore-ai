import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ItemAttributes } from '@adore/shared';
import {
  uploadImage,
  batchScan,
  batchConfirm,
  type BatchScanItem,
  type BatchConfirmItem,
} from '../lib/api';
import { colors, fonts, categoryColors } from '../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64;

type FlowStep = 'instructions' | 'processing' | 'review' | 'confirming';

interface ReviewItem extends BatchScanItem {
  included: boolean;
  editedName: string;
}

export default function BatchScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<FlowStep>('instructions');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [processingStatus, setProcessingStatus] = useState('');
  const [itemCountAnim] = useState(() => new Animated.Value(0));
  const [displayCount, setDisplayCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Animate the item count during processing
  const animateCount = useCallback(
    (target: number) => {
      const duration = 1200;
      const steps = target;
      const stepDuration = duration / Math.max(steps, 1);
      let current = 0;

      const interval = setInterval(() => {
        current++;
        setDisplayCount(current);
        if (current >= target) {
          clearInterval(interval);
        }
      }, stepDuration);

      return () => clearInterval(interval);
    },
    []
  );

  // ── Image Picking ─────────────────────────────────────────

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    let pickerResult: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos.');
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
      processImage(uri);
    }
  }, []);

  // ── Processing Pipeline ───────────────────────────────────

  const processImage = useCallback(async (uri: string) => {
    setStep('processing');
    setDisplayCount(0);

    try {
      // Step 1: Upload
      setProcessingStatus('Uploading photo...');
      const uploaded = await uploadImage(uri);
      setUploadedUrl(uploaded.public_url);

      // Step 2: Batch scan
      setProcessingStatus('Detecting items...');
      const result = await batchScan(uploaded.public_url);

      // Animate the count climbing
      const cleanup = animateCount(result.items_detected);

      setScanId(result.scan_id);
      setReviewItems(
        result.items.map((item) => ({
          ...item,
          included: true,
          editedName: item.name,
        }))
      );

      // Brief pause to let the count animation finish
      await new Promise((resolve) => setTimeout(resolve, 1400));
      cleanup();
      setDisplayCount(result.items_detected);

      setStep('review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      Alert.alert('Error', message, [
        { text: 'Retry', onPress: () => processImage(uri) },
        { text: 'Cancel', onPress: () => setStep('instructions') },
      ]);
      setStep('instructions');
    }
  }, [animateCount]);

  // ── Toggle item inclusion ─────────────────────────────────

  const toggleItem = useCallback((detectionId: string) => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.detection_id === detectionId
          ? { ...item, included: !item.included }
          : item
      )
    );
  }, []);

  // ── Update item name ──────────────────────────────────────

  const updateItemName = useCallback((detectionId: string, newName: string) => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.detection_id === detectionId
          ? { ...item, editedName: newName }
          : item
      )
    );
  }, []);

  // ── Confirm batch ─────────────────────────────────────────

  const includedCount = reviewItems.filter((i) => i.included).length;

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error('No scan ID');

      const confirmItems: BatchConfirmItem[] = reviewItems.map((item) => ({
        detection_id: item.detection_id,
        confirmed: item.included,
        name: item.editedName !== item.name ? item.editedName : undefined,
      }));

      return batchConfirm(scanId, confirmItems);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
      Alert.alert(
        'Items Added',
        `${result.confirmed_count} item${result.confirmed_count !== 1 ? 's' : ''} added to your wardrobe!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (err) => {
      Alert.alert('Error', err.message);
      setStep('review');
    },
  });

  const handleConfirm = useCallback(() => {
    if (includedCount === 0) {
      Alert.alert('No items selected', 'Toggle at least one item to add to your wardrobe.');
      return;
    }
    setStep('confirming');
    confirmMutation.mutate();
  }, [includedCount, confirmMutation]);

  // ── Bounding box crop helper ──────────────────────────────
  // box_2d is [y_min, x_min, y_max, x_max] normalized 0-1000

  const getCropStyle = useCallback(
    (box: [number, number, number, number]) => {
      // For the preview, we show the detected region as a highlighted area
      // by using the image with a clip. Since React Native doesn't support
      // CSS clip-path natively, we'll use the full image and overlay a
      // highlight indicator showing the approximate region.
      return {
        top: (box[0] / 1000) * 200,
        left: (box[1] / 1000) * CARD_WIDTH,
        width: ((box[3] - box[1]) / 1000) * CARD_WIDTH,
        height: ((box[2] - box[0]) / 1000) * 200,
      };
    },
    []
  );

  // ── Render: Instructions ──────────────────────────────────

  if (step === 'instructions') {
    return (
      <View style={styles.container}>
        <View style={styles.instructionsContainer}>
          <Ionicons name="scan-outline" size={64} color={colors.accent} />
          <Text style={styles.title}>Batch Scan</Text>
          <Text style={styles.subtitle}>
            Lay 5-10 items flat on a surface.{'\n'}
            Leave a little space between each.
          </Text>

          <View style={styles.tipsContainer}>
            <TipRow icon="sunny-outline" text="Good lighting helps accuracy" />
            <TipRow icon="resize-outline" text="Spread items apart for best results" />
            <TipRow icon="eye-outline" text="All items should be fully visible" />
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => pickImage('camera')}
          >
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => pickImage('library')}
          >
            <Ionicons name="images-outline" size={22} color={colors.secondary} />
            <Text style={styles.secondaryButtonText}>Choose from Library</Text>
          </Pressable>

          <Pressable style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Render: Processing ────────────────────────────────────

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

          <View style={styles.scanOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>

          <Text style={styles.processingText}>{processingStatus}</Text>

          {displayCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{displayCount}</Text>
              <Text style={styles.countLabel}>items found</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Render: Review Carousel ───────────────────────────────

  if (step === 'review' && reviewItems.length > 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>
            Found {reviewItems.length} item{reviewItems.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.reviewSubtitle}>
            {includedCount} selected to add
          </Text>
        </View>

        {/* Item Carousel */}
        <FlatList
          ref={flatListRef}
          data={reviewItems}
          keyExtractor={(item) => item.detection_id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 16}
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.x / (CARD_WIDTH + 16)
            );
            setCurrentIndex(index);
          }}
          renderItem={({ item, index }) => (
            <View style={styles.card}>
              {/* Image preview with bounding box indicator */}
              <View style={styles.cardImageContainer}>
                {imageUri && (
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                )}
                {/* Bounding box overlay */}
                <View
                  style={[
                    styles.boundingBox,
                    {
                      top: (item.box_2d[0] / 1000) * 200,
                      left: (item.box_2d[1] / 1000) * CARD_WIDTH,
                      width: ((item.box_2d[3] - item.box_2d[1]) / 1000) * CARD_WIDTH,
                      height: ((item.box_2d[2] - item.box_2d[0]) / 1000) * 200,
                    },
                  ]}
                />
                {/* Item number badge */}
                <View style={styles.itemNumberBadge}>
                  <Text style={styles.itemNumberText}>
                    {index + 1}/{reviewItems.length}
                  </Text>
                </View>
              </View>

              {/* Item details */}
              <View style={styles.cardBody}>
                {/* Editable name */}
                <TextInput
                  style={styles.nameInput}
                  value={item.editedName}
                  onChangeText={(text) => updateItemName(item.detection_id, text)}
                  placeholder="Item name"
                  placeholderTextColor={colors.textMuted}
                />

                {/* Category + color badges */}
                <View style={styles.badgeRow}>
                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor:
                          categoryColors[item.attributes.category] ??
                          colors.accentSoft,
                      },
                    ]}
                  >
                    <Text style={styles.categoryBadgeText}>
                      {item.attributes.category}
                    </Text>
                  </View>

                  <View style={styles.colorBadge}>
                    {item.attributes.colors.hex_codes?.[0] && (
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: item.attributes.colors.hex_codes[0] },
                        ]}
                      />
                    )}
                    <Text style={styles.colorBadgeText}>
                      {item.attributes.colors.dominant}
                    </Text>
                  </View>

                  {item.attributes.pattern !== 'solid' && (
                    <View style={styles.patternBadge}>
                      <Text style={styles.patternBadgeText}>
                        {item.attributes.pattern}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Subcategory + material */}
                {(item.attributes.subcategory || item.attributes.material) && (
                  <Text style={styles.detailText}>
                    {[item.attributes.subcategory, item.attributes.material]
                      .filter(Boolean)
                      .join(' \u00B7 ')}
                  </Text>
                )}

                {/* Toggle inclusion */}
                <Pressable
                  style={[
                    styles.toggleButton,
                    item.included
                      ? styles.toggleButtonActive
                      : styles.toggleButtonInactive,
                  ]}
                  onPress={() => toggleItem(item.detection_id)}
                >
                  <Ionicons
                    name={item.included ? 'checkmark-circle' : 'close-circle-outline'}
                    size={20}
                    color={item.included ? '#fff' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.toggleButtonText,
                      item.included
                        ? styles.toggleButtonTextActive
                        : styles.toggleButtonTextInactive,
                    ]}
                  >
                    {item.included ? 'Add to wardrobe' : 'Skip'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        />

        {/* Pagination dots */}
        <View style={styles.dotsRow}>
          {reviewItems.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
                reviewItems[index].included
                  ? styles.dotIncluded
                  : styles.dotExcluded,
              ]}
            />
          ))}
        </View>

        {/* Confirm button */}
        <View style={styles.confirmContainer}>
          <Pressable
            style={[
              styles.confirmButton,
              includedCount === 0 && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={includedCount === 0}
          >
            <Ionicons name="checkmark-done" size={22} color="#fff" />
            <Text style={styles.confirmButtonText}>
              Add {includedCount} item{includedCount !== 1 ? 's' : ''} to wardrobe
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelLink}
            onPress={() => {
              setStep('instructions');
              setReviewItems([]);
              setImageUri(null);
              setScanId(null);
            }}
          >
            <Text style={styles.cancelText}>Start over</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Render: Confirming ────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.processingText}>Adding items to wardrobe...</Text>
      </View>
    </View>
  );
}

// ── Tip Row Component ───────────────────────────────────────

function TipRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons name={icon as any} size={18} color={colors.textSecondary} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Instructions
  instructionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 32,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  tipsContainer: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
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
  cancelLink: {
    paddingVertical: 12,
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
    width: 240,
    height: 240,
    borderRadius: 16,
    marginBottom: 24,
  },
  scanOverlay: {
    marginBottom: 16,
  },
  processingText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  countText: {
    fontFamily: fonts.mono.medium,
    fontSize: 48,
    fontWeight: '500',
    color: colors.accent,
  },
  countLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Review
  reviewHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  reviewTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  reviewSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Carousel
  carouselContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  card: {
    width: CARD_WIDTH,
    marginRight: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImageContainer: {
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 4,
    backgroundColor: 'rgba(196, 149, 106, 0.15)',
  },
  itemNumberBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  itemNumberText: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    color: '#fff',
  },
  cardBody: {
    padding: 16,
  },
  nameInput: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    textTransform: 'capitalize',
  },
  colorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorBadgeText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.secondary,
    textTransform: 'capitalize',
  },
  patternBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  patternBadgeText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.secondary,
    textTransform: 'capitalize',
  },
  detailText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: colors.accent,
  },
  toggleButtonInactive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleButtonText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
  toggleButtonTextInactive: {
    color: colors.textSecondary,
  },

  // Pagination dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    borderRadius: 4,
  },
  dotIncluded: {
    backgroundColor: colors.accent,
  },
  dotExcluded: {
    backgroundColor: colors.textMuted,
  },

  // Confirm
  confirmContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    width: '100%',
    marginBottom: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontFamily: fonts.inter.semibold,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
