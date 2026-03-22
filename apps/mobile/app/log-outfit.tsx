import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OCCASION_TYPES, MOOD_TAGS } from '@adore/shared';
import type { OccasionType, MoodTag, WeatherContext } from '@adore/shared';
import {
  uploadImage,
  decomposeOutfit,
  createOutfit,
  getWeatherForLocation,
  type DecomposedItem,
  type CreateOutfitPayload,
} from '../lib/api';
import { colors, fonts } from '../lib/theme';

// ── Constants ─────────────────────────────────────────────────

const MOOD_EMOJI: Record<MoodTag, string> = {
  confident: '\u{1F60E}',    // sunglasses
  comfortable: '\u{1F60C}',  // relieved
  creative: '\u{1F3A8}',     // artist palette
  powerful: '\u{1F4AA}',     // flexed biceps
  relaxed: '\u{1F9D8}',      // person in lotus position
  overdressed: '\u{1F454}',  // necktie
  underdressed: '\u{1F62C}', // grimacing
  meh: '\u{1F610}',          // neutral face
};

const OCCASION_ICONS: Record<OccasionType, string> = {
  work: '\u{1F4BC}',
  casual: '\u{1F45F}',
  'date-night': '\u{1F377}',
  'formal-event': '\u{1F3A9}',
  workout: '\u{1F3CB}',
  travel: '\u{2708}',
  interview: '\u{1F4CB}',
  'wedding-guest': '\u{1F492}',
  brunch: '\u{1F95E}',
  'night-out': '\u{1F378}',
  wfh: '\u{1F3E0}',
  errand: '\u{1F6D2}',
};

type FlowStep = 'pick' | 'processing' | 'review' | 'saving';

export default function LogOutfitScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<FlowStep>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');

  // Decomposition results
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [decomposedItems, setDecomposedItems] = useState<DecomposedItem[]>([]);
  /** Track which unmatched items user wants to add to wardrobe */
  const [addToWardrobe, setAddToWardrobe] = useState<Record<number, boolean>>({});

  // Outfit metadata
  const [occasion, setOccasion] = useState<OccasionType | null>(null);
  const [moodTag, setMoodTag] = useState<MoodTag | null>(null);
  const [notes, setNotes] = useState('');
  const [weather, setWeather] = useState<WeatherContext | null>(null);

  // Fetch weather on mount (non-blocking)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        const w = await getWeatherForLocation(loc.coords.latitude, loc.coords.longitude);
        if (w) setWeather(w);
      } catch {
        // Weather is optional
      }
    })();
  }, []);

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
        allowsEditing: false, // Full-body shots need full frame
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
        allowsEditing: false,
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

    try {
      // Step 1: Upload
      setProcessingStatus('Uploading photo...');
      const uploaded = await uploadImage(uri);
      setPhotoUrl(uploaded.public_url);

      // Step 2: Decompose outfit via AI
      setProcessingStatus('Identifying outfit items...');
      const items = await decomposeOutfit(uploaded.public_url);
      setDecomposedItems(items);

      // Default: add unmatched items to wardrobe
      const defaults: Record<number, boolean> = {};
      items.forEach((item, i) => {
        if (!item.match) {
          defaults[i] = true;
        }
      });
      setAddToWardrobe(defaults);

      setStep('review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      Alert.alert('Error', message, [
        { text: 'Retry', onPress: () => processImage(uri) },
        { text: 'Cancel', onPress: () => setStep('pick') },
      ]);
      setStep('pick');
    }
  }, []);

  // ── Save Outfit ───────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Collect matched wardrobe item IDs
      const matchedItemIds: string[] = [];
      const newItems: CreateOutfitPayload['new_items'] = [];

      decomposedItems.forEach((item, index) => {
        if (item.match) {
          matchedItemIds.push(item.match.wardrobe_item_id);
        } else if (addToWardrobe[index]) {
          const detected = item.detected_item;
          newItems.push({
            name: detected.description || `${detected.colors.dominant} ${detected.subcategory ?? detected.category}`,
            category: detected.category,
            subcategory: detected.subcategory,
            colors: [detected.colors.dominant, ...detected.colors.secondary],
            pattern: detected.pattern,
            material: detected.material,
            brand: detected.brand,
            formality_level: detected.formality_level,
            seasons: detected.seasons,
            condition: detected.condition,
          });
        }
      });

      const payload: CreateOutfitPayload = {
        photo_url: photoUrl,
        occasion,
        mood_tag: moodTag,
        worn_date: new Date().toISOString().split('T')[0],
        notes: notes.trim() || null,
        weather_context: weather,
        item_ids: matchedItemIds,
        new_items: newItems.length > 0 ? newItems : undefined,
      };

      return createOutfit(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
      router.back();
    },
    onError: (err) => {
      Alert.alert('Save failed', err.message);
      setStep('review');
    },
  });

  const handleSave = useCallback(() => {
    setStep('saving');
    saveMutation.mutate();
  }, [saveMutation]);

  // ── Render: Pick Image ────────────────────────────────────

  if (step === 'pick') {
    return (
      <View style={styles.container}>
        <View style={styles.pickContainer}>
          <Text style={styles.title}>Log Today's Outfit</Text>
          <Text style={styles.subtitle}>
            Take a full-body photo or pick one from your library.{'\n'}
            We'll identify each item automatically.
          </Text>

          <Pressable style={styles.primaryButton} onPress={() => pickImage('camera')}>
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>Take Photo</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => pickImage('library')}>
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
          <ActivityIndicator size="large" color={colors.accent} style={styles.processingSpinner} />
          <Text style={styles.processingText}>{processingStatus}</Text>
          <Text style={styles.processingSubtext}>
            Detecting individual items in your outfit...
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: Review ────────────────────────────────────────

  if (step === 'review') {
    const matchedCount = decomposedItems.filter((i) => i.match).length;
    const unmatchedCount = decomposedItems.length - matchedCount;

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.reviewScroll}
          contentContainerStyle={styles.reviewContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Outfit Photo */}
          {photoUrl && (
            <View style={styles.outfitImageContainer}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.outfitImage}
                resizeMode="cover"
              />
              {weather && (
                <View style={styles.weatherBadge}>
                  <Text style={styles.weatherText}>
                    {weather.temperature_f}{'\u00B0'}F {weather.condition}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Detected Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {decomposedItems.length} item{decomposedItems.length !== 1 ? 's' : ''} detected
            </Text>
            {matchedCount > 0 && (
              <Text style={styles.matchSummary}>
                {matchedCount} matched in wardrobe
                {unmatchedCount > 0 ? ` \u00B7 ${unmatchedCount} new` : ''}
              </Text>
            )}

            {decomposedItems.map((item, index) => (
              <View key={index} style={styles.detectedItem}>
                <View style={styles.detectedItemHeader}>
                  <View style={styles.detectedItemInfo}>
                    <Text style={styles.detectedItemName}>
                      {item.detected_item.description ||
                        `${item.detected_item.colors.dominant} ${item.detected_item.subcategory ?? item.detected_item.category}`}
                    </Text>
                    <View style={styles.chipRow}>
                      <Chip label={item.detected_item.category} />
                      <Chip
                        label={item.detected_item.colors.dominant}
                        color={item.detected_item.colors.hex_codes?.[0]}
                      />
                    </View>
                  </View>

                  {item.match ? (
                    <View style={styles.matchBadge}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={styles.matchBadgeText}>In wardrobe</Text>
                    </View>
                  ) : (
                    <View style={styles.addToggle}>
                      <Text style={styles.addToggleLabel}>Add?</Text>
                      <Switch
                        value={addToWardrobe[index] ?? false}
                        onValueChange={(val) =>
                          setAddToWardrobe((prev) => ({ ...prev, [index]: val }))
                        }
                        trackColor={{ false: colors.border, true: colors.accent }}
                        thumbColor="#fff"
                      />
                    </View>
                  )}
                </View>

                {item.match?.wardrobe_item && (
                  <View style={styles.matchDetail}>
                    {item.match.wardrobe_item.image_url_clean ??
                    item.match.wardrobe_item.image_url ? (
                      <Image
                        source={{
                          uri:
                            item.match.wardrobe_item.image_url_clean ??
                            item.match.wardrobe_item.image_url ??
                            undefined,
                        }}
                        style={styles.matchThumbnail}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={styles.matchName} numberOfLines={1}>
                      {item.match.wardrobe_item.name}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Occasion Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Occasion</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {OCCASION_TYPES.map((occ) => (
                <Pressable
                  key={occ}
                  style={[
                    styles.occasionChip,
                    occasion === occ && styles.occasionChipSelected,
                  ]}
                  onPress={() => setOccasion(occasion === occ ? null : occ)}
                >
                  <Text style={styles.occasionEmoji}>
                    {OCCASION_ICONS[occ]}
                  </Text>
                  <Text
                    style={[
                      styles.occasionText,
                      occasion === occ && styles.occasionTextSelected,
                    ]}
                  >
                    {occ.replace(/-/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Mood Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How do you feel?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {MOOD_TAGS.map((mood) => (
                <Pressable
                  key={mood}
                  style={[
                    styles.moodChip,
                    moodTag === mood && styles.moodChipSelected,
                  ]}
                  onPress={() => setMoodTag(moodTag === mood ? null : mood)}
                >
                  <Text style={styles.moodEmoji}>{MOOD_EMOJI[mood]}</Text>
                  <Text
                    style={[
                      styles.moodText,
                      moodTag === mood && styles.moodTextSelected,
                    ]}
                  >
                    {mood}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="How's the fit? Any styling notes?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Save Button */}
          <View style={styles.saveSection}>
            <Pressable
              style={[
                styles.primaryButton,
                saveMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>Save Outfit</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelLink}
              onPress={() => {
                setStep('pick');
                setDecomposedItems([]);
                setPhotoUrl(null);
                setImageUri(null);
                setAddToWardrobe({});
                setOccasion(null);
                setMoodTag(null);
                setNotes('');
              }}
            >
              <Text style={styles.cancelText}>Retake Photo</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Render: Saving (fallback) ─────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.processingText}>Saving outfit...</Text>
      </View>
    </View>
  );
}

// ── Chip Component ────────────────────────────────────────────

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.chip}>
      {color && <View style={[styles.colorDot, { backgroundColor: color }]} />}
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pickContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
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
  buttonDisabled: {
    opacity: 0.6,
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
    width: 180,
    height: 280,
    borderRadius: 12,
    marginBottom: 24,
  },
  processingSpinner: {
    marginBottom: 16,
  },
  processingText: {
    fontFamily: fonts.inter.medium,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  processingSubtext: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Review
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingBottom: 40,
  },

  // Outfit photo
  outfitImageContainer: {
    width: '100%',
    height: 360,
    backgroundColor: colors.accentSoft,
    position: 'relative',
  },
  outfitImage: {
    width: '100%',
    height: '100%',
  },
  weatherBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  weatherText: {
    fontFamily: fonts.inter.medium,
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  matchSummary: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -8,
    marginBottom: 12,
  },

  // Detected items
  detectedItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detectedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detectedItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  detectedItemName: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  chipText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.secondary,
    textTransform: 'capitalize',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Match badge
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  matchBadgeText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  matchDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  matchThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: colors.accentSoft,
  },
  matchName: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },

  // Add toggle
  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addToggleLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Occasion picker
  horizontalScroll: {
    paddingRight: 16,
    gap: 8,
  },
  occasionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  occasionChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  occasionEmoji: {
    fontSize: 16,
  },
  occasionText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.secondary,
    textTransform: 'capitalize',
  },
  occasionTextSelected: {
    color: '#fff',
  },

  // Mood picker
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  moodChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  moodEmoji: {
    fontSize: 18,
  },
  moodText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.secondary,
    textTransform: 'capitalize',
  },
  moodTextSelected: {
    color: '#fff',
  },

  // Notes
  notesInput: {
    fontFamily: fonts.inter.regular,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Save
  saveSection: {
    paddingHorizontal: 16,
    marginTop: 24,
    alignItems: 'center',
  },
});
