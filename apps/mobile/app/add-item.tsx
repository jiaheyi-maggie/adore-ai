import { useState, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ItemAttributes } from '@adore/shared';
import {
  uploadImage,
  removeBackground,
  scanItem,
  createItem,
} from '../lib/api';

type FlowStep = 'pick' | 'processing' | 'review' | 'saving';

interface ProcessingResult {
  imageUrl: string;
  cleanUrl: string | null;
  attributes: ItemAttributes | null;
}

export default function AddItemScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<FlowStep>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [result, setResult] = useState<ProcessingResult | null>(null);

  // Editable fields for review
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');

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
        allowsEditing: true,
        aspect: [3, 4],
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
        allowsEditing: true,
        aspect: [3, 4],
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

      // Step 2: Run background removal + attribute extraction in parallel
      setProcessingStatus('Analyzing item...');
      const [bgResult, attributes] = await Promise.allSettled([
        removeBackground(uploaded.public_url),
        scanItem(uploaded.public_url),
      ]);

      const cleanUrl =
        bgResult.status === 'fulfilled' ? bgResult.value.clean_url : null;
      const attrs =
        attributes.status === 'fulfilled' ? attributes.value : null;

      setResult({
        imageUrl: uploaded.public_url,
        cleanUrl,
        attributes: attrs,
      });

      // Pre-fill the name from attributes
      if (attrs) {
        const autoName = [attrs.brand, attrs.colors.dominant, attrs.subcategory ?? attrs.category]
          .filter(Boolean)
          .join(' ');
        setName(autoName.charAt(0).toUpperCase() + autoName.slice(1));
        setBrand(attrs.brand ?? '');
      }

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

  // ── Save Item ─────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result?.attributes) throw new Error('No scan data');

      const attrs = result.attributes;
      return createItem({
        name: name.trim() || `${attrs.category} item`,
        category: attrs.category,
        subcategory: attrs.subcategory,
        colors: [attrs.colors.dominant, ...attrs.colors.secondary],
        pattern: attrs.pattern,
        material: attrs.material,
        brand: brand.trim() || attrs.brand,
        formality_level: attrs.formality_level,
        seasons: attrs.seasons,
        condition: attrs.condition,
        image_url: result.imageUrl,
        image_url_clean: result.cleanUrl,
        source: 'manual' as const,
        notes: notes.trim() || null,
        status: 'active' as const,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe-items'] });
      router.back();
    },
    onError: (err) => {
      Alert.alert('Save failed', err.message);
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
          <Text style={styles.title}>Add New Item</Text>
          <Text style={styles.subtitle}>
            Take a photo of your clothing item or choose from your library
          </Text>

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
            <Ionicons name="images-outline" size={22} color="#1a1a1a" />
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
          <ActivityIndicator
            size="large"
            color="#1a1a1a"
            style={styles.processingSpinner}
          />
          <Text style={styles.processingText}>{processingStatus}</Text>
          <Text style={styles.processingSubtext}>
            Removing background and extracting details...
          </Text>
        </View>
      </View>
    );
  }

  // ── Render: Review ────────────────────────────────────────

  if (step === 'review' && result) {
    const attrs = result.attributes;
    const displayImage = result.cleanUrl ?? result.imageUrl;

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
          {/* Image Preview */}
          <View style={styles.reviewImageContainer}>
            <Image
              source={{ uri: displayImage }}
              style={styles.reviewImage}
              resizeMode="contain"
            />
          </View>

          {/* Extracted Attributes */}
          {attrs && (
            <View style={styles.attributesContainer}>
              <Text style={styles.sectionTitle}>Detected Attributes</Text>

              <View style={styles.chipRow}>
                <Chip label={attrs.category} />
                {attrs.subcategory && <Chip label={attrs.subcategory} />}
                <Chip label={attrs.pattern} />
              </View>

              <View style={styles.chipRow}>
                <Chip label={attrs.colors.dominant} color={attrs.colors.hex_codes?.[0]} />
                {attrs.colors.secondary.map((color, i) => (
                  <Chip key={i} label={color} />
                ))}
              </View>

              {attrs.material && (
                <View style={styles.chipRow}>
                  <Chip label={attrs.material} />
                </View>
              )}

              <View style={styles.chipRow}>
                {attrs.seasons.map((season) => (
                  <Chip key={season} label={season} />
                ))}
              </View>

              {attrs.style_tags.length > 0 && (
                <View style={styles.chipRow}>
                  {attrs.style_tags.map((tag) => (
                    <Chip key={tag} label={tag} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Editable Fields */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Details</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Navy Crew Neck T-Shirt"
              placeholderTextColor="#bbb"
            />

            <Text style={styles.label}>Brand</Text>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Uniqlo"
              placeholderTextColor="#bbb"
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes..."
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Actions */}
          <View style={styles.reviewActions}>
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
                  <Text style={styles.primaryButtonText}>Add to Wardrobe</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelLink}
              onPress={() => {
                setStep('pick');
                setResult(null);
                setImageUri(null);
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
        <ActivityIndicator size="large" color="#1a1a1a" />
        <Text style={styles.processingText}>Saving to wardrobe...</Text>
      </View>
    </View>
  );
}

// ── Chip Component ──────────────────────────────────────────

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.chip}>
      {color && (
        <View style={[styles.colorDot, { backgroundColor: color }]} />
      )}
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  pickContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#1a1a1a',
    borderWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#1a1a1a',
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
    color: '#888',
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
    width: 200,
    height: 260,
    borderRadius: 12,
    marginBottom: 24,
  },
  processingSpinner: {
    marginBottom: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  processingSubtext: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },

  // Review
  reviewScroll: {
    flex: 1,
  },
  reviewContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  reviewImageContainer: {
    alignItems: 'center',
    marginVertical: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    overflow: 'hidden',
  },
  reviewImage: {
    width: '100%',
    height: 320,
  },

  // Attributes
  attributesContainer: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    color: '#444',
    textTransform: 'capitalize',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  // Form
  formSection: {
    marginTop: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Review Actions
  reviewActions: {
    marginTop: 24,
    alignItems: 'center',
  },
});
