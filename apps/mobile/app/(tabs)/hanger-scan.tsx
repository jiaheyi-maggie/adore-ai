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
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ItemAttributes } from '@adore/shared';
import {
  uploadImage,
  rapidScan,
  rapidConfirm,
  type RapidScanItem,
  type RapidConfirmItem,
} from '../../lib/api';
import { colors, fonts, categoryColors } from '../../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64;
const CAPTURE_INTERVAL_MS = 2500;
const THUMBNAIL_SIZE = 52;

type FlowStep =
  | 'instructions'
  | 'scanning'
  | 'processing'
  | 'review'
  | 'confirming';

interface ReviewItem extends RapidScanItem {
  included: boolean;
  editedName: string;
}

export default function HangerScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const captureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<FlowStep>('instructions');
  const [capturedUris, setCapturedUris] = useState<string[]>([]);
  const [captureCount, setCaptureCount] = useState(0);
  const [scanId, setScanId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Flash animation for capture feedback
  const flashOpacity = useRef(new Animated.Value(0)).current;

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (startDelayRef.current) {
        clearTimeout(startDelayRef.current);
        startDelayRef.current = null;
      }
      if (captureTimerRef.current) {
        clearInterval(captureTimerRef.current);
        captureTimerRef.current = null;
      }
    };
  }, []);

  // ── Camera capture logic ────────────────────────────────────

  const triggerCaptureFlash = useCallback(() => {
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [flashOpacity]);

  const captureFrame = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      if (photo?.uri) {
        setCapturedUris((prev) => [...prev, photo.uri]);
        setCaptureCount((prev) => prev + 1);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Visual flash
        triggerCaptureFlash();
      }
    } catch (err) {
      // Silently skip failed captures - camera might be transitioning
      console.warn('Capture failed:', err);
    }
  }, [triggerCaptureFlash]);

  const startScanning = useCallback(async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera Permission',
          'Camera access is required for closet scanning.'
        );
        return;
      }
    }

    setCapturedUris([]);
    setCaptureCount(0);
    setStep('scanning');

    // Start auto-capture interval after a brief delay for camera to initialize
    startDelayRef.current = setTimeout(() => {
      startDelayRef.current = null;
      captureTimerRef.current = setInterval(() => {
        captureFrame();
      }, CAPTURE_INTERVAL_MS);
    }, 1000);
  }, [permission, requestPermission, captureFrame]);

  const stopScanning = useCallback(() => {
    if (startDelayRef.current) {
      clearTimeout(startDelayRef.current);
      startDelayRef.current = null;
    }
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    if (capturedUris.length === 0) {
      Alert.alert('No captures', 'No photos were captured. Try again.', [
        { text: 'OK', onPress: () => setStep('instructions') },
      ]);
      return;
    }

    processCaptures(capturedUris);
  }, [capturedUris]);

  // ── Processing pipeline ─────────────────────────────────────

  const processCaptures = useCallback(
    async (uris: string[]) => {
      setStep('processing');
      setProcessingProgress(0);
      setProcessingStatus(`Uploading ${uris.length} photos...`);

      try {
        // Upload all photos in parallel, tracking progress
        const uploadedUrls: string[] = [];
        let uploaded = 0;

        const uploadResults = await Promise.allSettled(
          uris.map(async (uri) => {
            const result = await uploadImage(uri);
            uploaded++;
            setProcessingProgress(
              Math.round((uploaded / uris.length) * 50)
            );
            return result.public_url;
          })
        );

        for (const result of uploadResults) {
          if (result.status === 'fulfilled') {
            uploadedUrls.push(result.value);
          }
        }

        if (uploadedUrls.length === 0) {
          throw new Error('Failed to upload any photos');
        }

        setProcessingStatus(
          `Analyzing ${uploadedUrls.length} garments...`
        );
        setProcessingProgress(55);

        // Call rapid-scan endpoint
        const result = await rapidScan(uploadedUrls);
        setProcessingProgress(95);

        setScanId(result.scan_id);
        setReviewItems(
          result.items.map((item) => ({
            ...item,
            included: true,
            editedName: item.name,
          }))
        );

        setProcessingProgress(100);

        // Brief pause so user sees 100%
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (result.items.length === 0) {
          Alert.alert(
            'No items detected',
            'We could not identify any garments in the captured frames. Try again with better lighting.',
            [{ text: 'OK', onPress: () => setStep('instructions') }]
          );
          return;
        }

        setStep('review');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Processing failed';
        Alert.alert('Error', message, [
          {
            text: 'Retry',
            onPress: () => processCaptures(uris),
          },
          { text: 'Cancel', onPress: () => setStep('instructions'), style: 'cancel' },
        ]);
      }
    },
    []
  );

  // ── Review actions ──────────────────────────────────────────

  const toggleItem = useCallback((detectionId: string) => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.detection_id === detectionId
          ? { ...item, included: !item.included }
          : item
      )
    );
  }, []);

  const updateItemName = useCallback(
    (detectionId: string, newName: string) => {
      setReviewItems((prev) =>
        prev.map((item) =>
          item.detection_id === detectionId
            ? { ...item, editedName: newName }
            : item
        )
      );
    },
    []
  );

  const includedCount = reviewItems.filter((i) => i.included).length;

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!scanId) throw new Error('No scan ID');

      const confirmItems: RapidConfirmItem[] = reviewItems.map((item) => ({
        detection_id: item.detection_id,
        confirmed: item.included,
        name:
          item.editedName !== item.name ? item.editedName : undefined,
      }));

      return rapidConfirm(scanId, confirmItems);
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
      Alert.alert(
        'No items selected',
        'Toggle at least one item to add to your wardrobe.'
      );
      return;
    }
    setStep('confirming');
    confirmMutation.mutate();
  }, [includedCount, confirmMutation]);

  // ── Render: Instructions ────────────────────────────────────

  if (step === 'instructions') {
    return (
      <View style={styles.container}>
        <View style={styles.instructionsContainer}>
          <Ionicons
            name="albums-outline"
            size={64}
            color={colors.accent}
          />
          <Text style={styles.title}>Closet Scan</Text>
          <Text style={styles.subtitle}>
            Open your closet and slide hangers{'\n'}one by one. We'll
            capture each item{'\n'}automatically — no button needed.
          </Text>

          <View style={styles.tipsContainer}>
            <TipRow
              icon="time-outline"
              text="Slide one hanger every 2-3 seconds"
            />
            <TipRow
              icon="sunny-outline"
              text="Good lighting helps accuracy"
            />
            <TipRow
              icon="phone-portrait-outline"
              text="Hold phone steady, facing the closet"
            />
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={startScanning}
          >
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Start Scanning</Text>
          </Pressable>

          <Pressable
            style={styles.cancelLink}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Render: Scanning (Camera) ───────────────────────────────

  if (step === 'scanning') {
    const recentThumbnails = capturedUris.slice(-3).reverse();

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          {/* Green flash overlay on capture */}
          <Animated.View
            style={[
              styles.captureFlash,
              { opacity: flashOpacity },
            ]}
            pointerEvents="none"
          />

          {/* Counter overlay at top */}
          <View style={styles.counterOverlay}>
            <Text style={styles.counterNumber}>{captureCount}</Text>
            <Text style={styles.counterLabel}>items captured</Text>
          </View>

          {/* Recent thumbnails strip at bottom-left */}
          <View style={styles.thumbnailStrip}>
            {recentThumbnails.map((uri, i) => (
              <View key={`thumb-${capturedUris.length - i}`} style={styles.thumbnailWrapper}>
                <Image
                  source={{ uri }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>

          {/* Done button at bottom center */}
          <View style={styles.doneButtonContainer}>
            <Pressable
              style={styles.doneButton}
              onPress={stopScanning}
            >
              <Text style={styles.doneButtonText}>Done</Text>
              <Text style={styles.doneButtonSub}>
                {captureCount} captured
              </Text>
            </Pressable>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Render: Processing ──────────────────────────────────────

  if (step === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.processingTitle}>
            Processing {capturedUris.length} items...
          </Text>
          <Text style={styles.processingStatus}>
            {processingStatus}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${processingProgress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {processingProgress}%
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: Review Carousel ─────────────────────────────────

  if (step === 'review' && reviewItems.length > 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>
            Found {reviewItems.length} item
            {reviewItems.length !== 1 ? 's' : ''}
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
              {/* Image preview */}
              <View style={styles.cardImageContainer}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cardImage}
                  resizeMode="cover"
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
                  onChangeText={(text) =>
                    updateItemName(item.detection_id, text)
                  }
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
                          categoryColors[
                            item.attributes.category
                          ] ?? colors.accentSoft,
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
                          {
                            backgroundColor:
                              item.attributes.colors.hex_codes[0],
                          },
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
                {(item.attributes.subcategory ||
                  item.attributes.material) && (
                  <Text style={styles.detailText}>
                    {[
                      item.attributes.subcategory,
                      item.attributes.material,
                    ]
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
                    name={
                      item.included
                        ? 'checkmark-circle'
                        : 'close-circle-outline'
                    }
                    size={20}
                    color={
                      item.included ? '#fff' : colors.textSecondary
                    }
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
              Add {includedCount} item
              {includedCount !== 1 ? 's' : ''} to wardrobe
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelLink}
            onPress={() => {
              setStep('instructions');
              setReviewItems([]);
              setCapturedUris([]);
              setScanId(null);
              setCaptureCount(0);
            }}
          >
            <Text style={styles.cancelText}>Start over</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Render: Confirming ──────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.processingTitle}>
          Adding items to wardrobe...
        </Text>
      </View>
    </View>
  );
}

// ── Tip Row Component ───────────────────────────────────────

function TipRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.tipRow}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={18}
        color={colors.textSecondary}
      />
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
  cancelLink: {
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: fonts.inter.regular,
    color: colors.textSecondary,
    fontSize: 14,
  },

  // Camera / Scanning
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: colors.success,
    borderRadius: 0,
  },
  counterOverlay: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  counterNumber: {
    fontFamily: fonts.mono.medium,
    fontSize: 36,
    fontWeight: '500',
    color: colors.accent,
  },
  counterLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: '#fff',
    marginTop: 2,
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    flexDirection: 'row',
    gap: 8,
  },
  thumbnailWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: THUMBNAIL_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  doneButtonContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  doneButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: fonts.inter.semibold,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  doneButtonSub: {
    fontFamily: fonts.inter.regular,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },

  // Processing
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  processingTitle: {
    fontFamily: fonts.inter.medium,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  processingStatus: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: fonts.mono.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
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
