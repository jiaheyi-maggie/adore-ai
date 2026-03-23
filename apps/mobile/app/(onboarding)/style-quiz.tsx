import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '../../lib/theme';

// ── Types ──────────────────────────────────────────────────

interface OccasionCard {
  id: string;
  icon: string;
  label: string;
}

interface StyleCard {
  id: string;
  icon: string;
  label: string;
  tags: {
    categories: string[];
    formality: string[];
    colors: string[];
    patterns: string[];
    style_tags: string[];
  };
}

// ── Data ───────────────────────────────────────────────────

const OCCASIONS: OccasionCard[] = [
  { id: 'casual', icon: 'sunny-outline', label: 'Casual / daily life' },
  { id: 'work', icon: 'briefcase-outline', label: 'Work / office' },
  { id: 'social', icon: 'wine-outline', label: 'Social / going out' },
  { id: 'active', icon: 'fitness-outline', label: 'Active / fitness' },
  { id: 'creative', icon: 'color-palette-outline', label: 'Creative / expressive' },
  { id: 'events', icon: 'sparkles-outline', label: 'Events / dress up' },
];

const LIKED_STYLE_CARDS: StyleCard[] = [
  {
    id: 'structured-blazer',
    icon: 'shirt-outline',
    label: 'Structured blazer + slim pants',
    tags: {
      categories: ['outerwear', 'bottoms'],
      formality: ['business', 'smart_casual'],
      colors: ['navy', 'charcoal', 'black'],
      patterns: ['solid'],
      style_tags: ['tailored', 'polished', 'classic'],
    },
  },
  {
    id: 'flowy-sundress',
    icon: 'flower-outline',
    label: 'Flowy sundress + sandals',
    tags: {
      categories: ['dresses', 'shoes'],
      formality: ['casual'],
      colors: ['pastels', 'white', 'florals'],
      patterns: ['floral', 'solid'],
      style_tags: ['feminine', 'relaxed', 'romantic'],
    },
  },
  {
    id: 'all-black',
    icon: 'moon-outline',
    label: 'All-black everything',
    tags: {
      categories: ['tops', 'bottoms', 'outerwear'],
      formality: ['smart_casual', 'casual'],
      colors: ['black'],
      patterns: ['solid'],
      style_tags: ['minimalist', 'monochrome', 'edgy'],
    },
  },
  {
    id: 'earth-tones',
    icon: 'leaf-outline',
    label: 'Earth tones + linen',
    tags: {
      categories: ['tops', 'bottoms'],
      formality: ['casual', 'smart_casual'],
      colors: ['beige', 'olive', 'terracotta', 'cream'],
      patterns: ['solid'],
      style_tags: ['earthy', 'natural', 'organic'],
    },
  },
  {
    id: 'streetwear',
    icon: 'flash-outline',
    label: 'Streetwear + sneakers',
    tags: {
      categories: ['tops', 'shoes', 'outerwear'],
      formality: ['casual'],
      colors: ['white', 'black', 'bold'],
      patterns: ['graphic', 'solid'],
      style_tags: ['streetwear', 'athletic', 'urban'],
    },
  },
  {
    id: 'minimal-jewelry',
    icon: 'diamond-outline',
    label: 'Minimal jewelry + clean lines',
    tags: {
      categories: ['jewelry', 'accessories'],
      formality: ['smart_casual', 'business'],
      colors: ['gold', 'silver', 'white', 'neutral'],
      patterns: ['solid'],
      style_tags: ['minimalist', 'refined', 'understated'],
    },
  },
  {
    id: 'bold-prints',
    icon: 'color-palette-outline',
    label: 'Bold prints + color mixing',
    tags: {
      categories: ['tops', 'dresses', 'bottoms'],
      formality: ['casual', 'smart_casual'],
      colors: ['multi', 'bright', 'saturated'],
      patterns: ['abstract', 'geometric', 'floral'],
      style_tags: ['maximalist', 'colorful', 'eclectic'],
    },
  },
  {
    id: 'preppy',
    icon: 'school-outline',
    label: 'Preppy + polished',
    tags: {
      categories: ['tops', 'bottoms', 'outerwear'],
      formality: ['smart_casual', 'business'],
      colors: ['navy', 'white', 'green', 'red'],
      patterns: ['striped', 'plaid', 'solid'],
      style_tags: ['preppy', 'classic', 'collegiate'],
    },
  },
  {
    id: 'romantic-soft',
    icon: 'heart-outline',
    label: 'Romantic + soft',
    tags: {
      categories: ['dresses', 'tops'],
      formality: ['casual', 'smart_casual'],
      colors: ['blush', 'lavender', 'cream', 'dusty-rose'],
      patterns: ['floral', 'solid'],
      style_tags: ['romantic', 'feminine', 'soft'],
    },
  },
  {
    id: 'leather-edge',
    icon: 'flame-outline',
    label: 'Leather + edge',
    tags: {
      categories: ['outerwear', 'shoes', 'accessories'],
      formality: ['casual', 'smart_casual'],
      colors: ['black', 'dark-brown', 'burgundy'],
      patterns: ['solid'],
      style_tags: ['edgy', 'rocker', 'bold'],
    },
  },
  {
    id: 'cozy-knits',
    icon: 'cafe-outline',
    label: 'Cozy knits + layers',
    tags: {
      categories: ['tops', 'outerwear'],
      formality: ['casual'],
      colors: ['cream', 'oatmeal', 'camel', 'grey'],
      patterns: ['solid', 'striped'],
      style_tags: ['cozy', 'layered', 'hygge'],
    },
  },
  {
    id: 'sparkle-statement',
    icon: 'sparkles-outline',
    label: 'Sparkle + statement pieces',
    tags: {
      categories: ['jewelry', 'dresses', 'accessories'],
      formality: ['formal', 'smart_casual'],
      colors: ['gold', 'silver', 'metallic'],
      patterns: ['solid', 'other'],
      style_tags: ['glamorous', 'statement', 'bold'],
    },
  },
  {
    id: 'relaxed-beachy',
    icon: 'umbrella-outline',
    label: 'Relaxed + beachy',
    tags: {
      categories: ['tops', 'bottoms', 'dresses'],
      formality: ['casual'],
      colors: ['white', 'blue', 'sand', 'coral'],
      patterns: ['solid', 'striped'],
      style_tags: ['beachy', 'relaxed', 'coastal'],
    },
  },
  {
    id: 'power-dressing',
    icon: 'shield-outline',
    label: 'Power dressing',
    tags: {
      categories: ['outerwear', 'bottoms', 'dresses'],
      formality: ['business', 'formal'],
      colors: ['black', 'red', 'navy', 'white'],
      patterns: ['solid'],
      style_tags: ['powerful', 'commanding', 'sharp'],
    },
  },
  {
    id: 'vintage-retro',
    icon: 'time-outline',
    label: 'Vintage + retro',
    tags: {
      categories: ['dresses', 'tops', 'accessories'],
      formality: ['casual', 'smart_casual'],
      colors: ['mustard', 'burgundy', 'teal', 'rust'],
      patterns: ['plaid', 'polka-dot', 'floral'],
      style_tags: ['vintage', 'retro', 'nostalgic'],
    },
  },
];

const DISLIKED_STYLE_CARDS: StyleCard[] = [
  {
    id: 'neon-bright',
    icon: 'bulb-outline',
    label: 'Neon + ultra-bright colors',
    tags: {
      categories: ['tops', 'activewear'],
      formality: ['casual'],
      colors: ['neon', 'fluorescent'],
      patterns: ['solid', 'graphic'],
      style_tags: ['neon', 'loud', 'attention-grabbing'],
    },
  },
  {
    id: 'head-to-toe-logos',
    icon: 'pricetag-outline',
    label: 'Head-to-toe logos',
    tags: {
      categories: ['tops', 'accessories', 'bags'],
      formality: ['casual'],
      colors: ['multi'],
      patterns: ['graphic'],
      style_tags: ['logo-heavy', 'branded', 'flashy'],
    },
  },
  {
    id: 'ultra-baggy',
    icon: 'resize-outline',
    label: 'Ultra-baggy oversized',
    tags: {
      categories: ['tops', 'bottoms'],
      formality: ['casual'],
      colors: ['neutral'],
      patterns: ['solid'],
      style_tags: ['oversized', 'baggy', 'shapeless'],
    },
  },
  {
    id: 'animal-print-heavy',
    icon: 'paw-outline',
    label: 'Animal print everything',
    tags: {
      categories: ['tops', 'dresses', 'accessories'],
      formality: ['casual', 'smart_casual'],
      colors: ['brown', 'black', 'gold'],
      patterns: ['animal-print'],
      style_tags: ['animal-print', 'bold-pattern', 'statement'],
    },
  },
  {
    id: 'frilly-ruffles',
    icon: 'gift-outline',
    label: 'Lots of frills + ruffles',
    tags: {
      categories: ['dresses', 'tops'],
      formality: ['casual', 'formal'],
      colors: ['pastels', 'white'],
      patterns: ['solid'],
      style_tags: ['frilly', 'ruffled', 'overly-feminine'],
    },
  },
  {
    id: 'athleisure-only',
    icon: 'barbell-outline',
    label: 'Athleisure as everyday wear',
    tags: {
      categories: ['activewear', 'shoes'],
      formality: ['casual'],
      colors: ['black', 'grey'],
      patterns: ['solid'],
      style_tags: ['athleisure', 'sporty', 'gym-to-street'],
    },
  },
  {
    id: 'heavy-distressing',
    icon: 'cut-outline',
    label: 'Heavy rips + distressing',
    tags: {
      categories: ['bottoms', 'tops'],
      formality: ['casual'],
      colors: ['blue', 'black'],
      patterns: ['solid'],
      style_tags: ['distressed', 'ripped', 'grunge'],
    },
  },
  {
    id: 'matching-sets',
    icon: 'people-outline',
    label: 'Matchy-matchy sets',
    tags: {
      categories: ['tops', 'bottoms'],
      formality: ['casual', 'smart_casual'],
      colors: ['multi'],
      patterns: ['solid', 'graphic'],
      style_tags: ['co-ord', 'matching', 'uniform'],
    },
  },
  {
    id: 'chunky-platform',
    icon: 'footsteps-outline',
    label: 'Chunky platforms + big soles',
    tags: {
      categories: ['shoes'],
      formality: ['casual'],
      colors: ['black', 'white'],
      patterns: ['solid'],
      style_tags: ['platform', 'chunky', 'maximalist-shoe'],
    },
  },
  {
    id: 'sheer-cutouts',
    icon: 'eye-outline',
    label: 'Sheer fabrics + cutouts',
    tags: {
      categories: ['tops', 'dresses'],
      formality: ['casual', 'smart_casual'],
      colors: ['black', 'nude'],
      patterns: ['solid'],
      style_tags: ['sheer', 'cutout', 'revealing'],
    },
  },
  {
    id: 'cargo-utility',
    icon: 'construct-outline',
    label: 'Heavy cargo + utility',
    tags: {
      categories: ['bottoms', 'outerwear'],
      formality: ['casual'],
      colors: ['olive', 'khaki', 'brown'],
      patterns: ['solid'],
      style_tags: ['cargo', 'utility', 'tactical'],
    },
  },
  {
    id: 'boho-maximal',
    icon: 'flower-outline',
    label: 'Full boho with fringe',
    tags: {
      categories: ['dresses', 'accessories'],
      formality: ['casual'],
      colors: ['brown', 'rust', 'turquoise'],
      patterns: ['other', 'abstract'],
      style_tags: ['boho', 'fringe', 'festival'],
    },
  },
];

const TOTAL_STEPS = 4;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = spacing.sm;
const CARD_COLUMNS_OCCASION = 2;
const CARD_COLUMNS_STYLE = 3;

// ── Component ───────────────────────────────────────────────

export default function StyleQuizScreen() {
  const router = useRouter();

  const [step, setStep] = useState(0); // 0=name, 1=occasions, 2=liked, 3=disliked
  const [name, setName] = useState('');
  const [selectedOccasions, setSelectedOccasions] = useState<Set<string>>(new Set());
  const [likedStyles, setLikedStyles] = useState<Set<string>>(new Set());
  const [dislikedStyles, setDislikedStyles] = useState<Set<string>>(new Set());

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      callback();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      animateTransition(() => setStep((s) => s + 1));
    } else {
      // Collect all tag arrays from liked/disliked cards
      const likedTags = collectTags(LIKED_STYLE_CARDS, likedStyles);
      const dislikedTags = collectTags(DISLIKED_STYLE_CARDS, dislikedStyles);

      // Compute archetype weights from liked cards' style_tags for the DNA visualization
      const archetypeMap = computeStyleArchetypes(LIKED_STYLE_CARDS, likedStyles);

      router.push({
        pathname: '/color-analysis',
        params: {
          name: name.trim(),
          occasions: JSON.stringify(Array.from(selectedOccasions)),
          liked_styles: JSON.stringify(likedTags),
          disliked_styles: JSON.stringify(dislikedTags),
          style_archetypes: JSON.stringify(archetypeMap),
        },
      });
    }
  };

  // ── Step 0: Name Input ──────────────────────────────────

  if (step === 0) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.centeredContent, { opacity: fadeAnim }]}>
          <Text style={styles.heading}>What should I call you?</Text>
          <Text style={styles.subtext}>So I can personalize your experience.</Text>

          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => name.trim() && goNext()}
          />

          <Pressable
            style={[styles.continueButton, !name.trim() && styles.buttonDisabled]}
            onPress={goNext}
            disabled={!name.trim()}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.surface} />
          </Pressable>
        </Animated.View>

        <ProgressDots current={step} total={TOTAL_STEPS} />
      </KeyboardAvoidingView>
    );
  }

  // ── Step 1: Occasion Map ────────────────────────────────

  if (step === 1) {
    const toggleOccasion = (id: string) => {
      setSelectedOccasions((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const cardWidth =
      (SCREEN_WIDTH - spacing['3xl'] * 2 - GRID_GAP * (CARD_COLUMNS_OCCASION - 1)) /
      CARD_COLUMNS_OCCASION;

    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.heading}>What does your week look like?</Text>
            <Text style={styles.subtext}>Tap all that apply.</Text>

            <View style={styles.gridContainer}>
              {OCCASIONS.map((card) => {
                const selected = selectedOccasions.has(card.id);
                return (
                  <Pressable
                    key={card.id}
                    style={[
                      styles.occasionCard,
                      { width: cardWidth },
                      selected && styles.cardSelected,
                    ]}
                    onPress={() => toggleOccasion(card.id)}
                  >
                    <Ionicons name={card.icon as any} size={32} color={colors.secondary} />
                    <Text style={styles.occasionLabel}>{card.label}</Text>
                    {selected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color={colors.surface} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            style={[
              styles.continueButton,
              selectedOccasions.size === 0 && styles.buttonDisabled,
            ]}
            onPress={goNext}
            disabled={selectedOccasions.size === 0}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.surface} />
          </Pressable>
          <ProgressDots current={step} total={TOTAL_STEPS} />
        </View>
      </View>
    );
  }

  // ── Step 2: Visual Taste (Liked) ────────────────────────

  if (step === 2) {
    const toggleLiked = (id: string) => {
      setLikedStyles((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const cardWidth =
      (SCREEN_WIDTH - spacing['3xl'] * 2 - GRID_GAP * (CARD_COLUMNS_STYLE - 1)) /
      CARD_COLUMNS_STYLE;

    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.heading}>Outfits that feel like YOU</Text>
            <Text style={styles.subtext}>
              Tap anything that catches your eye {'\u2014'} no wrong answers.
            </Text>

            <View style={styles.gridContainer}>
              {LIKED_STYLE_CARDS.map((card) => {
                const selected = likedStyles.has(card.id);
                return (
                  <Pressable
                    key={card.id}
                    style={[
                      styles.styleCard,
                      { width: cardWidth },
                      selected && styles.cardSelected,
                    ]}
                    onPress={() => toggleLiked(card.id)}
                  >
                    <Ionicons name={card.icon as any} size={24} color={colors.secondary} />
                    <Text style={styles.styleCardLabel}>{card.label}</Text>
                    {selected && (
                      <View style={styles.checkBadge}>
                        <Ionicons name="checkmark" size={14} color={colors.surface} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.bottomBar}>
          {likedStyles.size > 0 && (
            <Text style={styles.counterText}>{likedStyles.size} selected</Text>
          )}
          <Pressable
            style={[
              styles.continueButton,
              likedStyles.size < 3 && styles.buttonDisabled,
            ]}
            onPress={goNext}
            disabled={likedStyles.size < 3}
          >
            <Text style={styles.continueButtonText}>
              {likedStyles.size < 3
                ? `Pick at least ${3 - likedStyles.size} more`
                : 'Continue'}
            </Text>
            {likedStyles.size >= 3 && (
              <Ionicons name="arrow-forward" size={18} color={colors.surface} />
            )}
          </Pressable>
          <ProgressDots current={step} total={TOTAL_STEPS} />
        </View>
      </View>
    );
  }

  // ── Step 3: Anti-Taste (Disliked) ──────────────────────

  const toggleDisliked = (id: string) => {
    setDislikedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const antiCardWidth =
    (SCREEN_WIDTH - spacing['3xl'] * 2 - GRID_GAP * (CARD_COLUMNS_STYLE - 1)) /
    CARD_COLUMNS_STYLE;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.heading}>Not your thing</Text>
          <Text style={styles.subtext}>
            Anything you'd definitely avoid? (optional)
          </Text>

          <View style={styles.gridContainer}>
            {DISLIKED_STYLE_CARDS.map((card) => {
              const selected = dislikedStyles.has(card.id);
              return (
                <Pressable
                  key={card.id}
                  style={[
                    styles.styleCard,
                    { width: antiCardWidth },
                    selected && styles.cardRejected,
                  ]}
                  onPress={() => toggleDisliked(card.id)}
                >
                  <Ionicons name={card.icon as any} size={24} color={colors.secondary} />
                  <Text style={styles.styleCardLabel}>{card.label}</Text>
                  {selected && (
                    <View style={styles.rejectBadge}>
                      <Ionicons name="close" size={14} color={colors.surface} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {dislikedStyles.size > 0 && (
          <Text style={styles.counterText}>{dislikedStyles.size} marked</Text>
        )}
        <Pressable style={styles.continueButton} onPress={goNext}>
          <Text style={styles.continueButtonText}>
            {dislikedStyles.size === 0 ? 'Skip' : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.surface} />
        </Pressable>
        <ProgressDots current={step} total={TOTAL_STEPS} />
      </View>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function collectTags(cards: StyleCard[], selectedIds: Set<string>): string[] {
  const tagSet = new Set<string>();
  for (const card of cards) {
    if (selectedIds.has(card.id)) {
      for (const tag of card.tags.style_tags) tagSet.add(tag);
      for (const cat of card.tags.categories) tagSet.add(cat);
      for (const color of card.tags.colors) tagSet.add(color);
      for (const pattern of card.tags.patterns) tagSet.add(pattern);
      for (const formality of card.tags.formality) tagSet.add(formality);
    }
  }
  return Array.from(tagSet);
}

/**
 * Compute style archetype weights from selected cards' style_tags.
 * Mirrors the backend `computeStyleArchetypes` logic so the revelation screen
 * can display the Style DNA without a round-trip.
 */
function computeStyleArchetypes(
  cards: StyleCard[],
  selectedIds: Set<string>,
): Record<string, number> {
  const archetypeKeywords: Record<string, string[]> = {
    minimalist: ['minimalist', 'clean', 'refined', 'understated', 'monochrome'],
    classic: ['classic', 'tailored', 'polished', 'preppy', 'collegiate', 'timeless'],
    bohemian: ['boho', 'relaxed', 'beachy', 'coastal', 'natural', 'organic', 'earthy'],
    edgy: ['edgy', 'rocker', 'bold', 'streetwear', 'urban', 'grunge', 'leather'],
    romantic: ['romantic', 'feminine', 'soft', 'delicate'],
    maximalist: ['maximalist', 'colorful', 'eclectic', 'bold-pattern', 'statement'],
    glamorous: ['glamorous', 'sparkle', 'powerful', 'commanding', 'sharp', 'power'],
    vintage: ['vintage', 'retro', 'nostalgic'],
    cozy: ['cozy', 'layered', 'hygge', 'comfortable'],
    athletic: ['athletic', 'sporty', 'athleisure'],
  };

  // Collect all style_tags from selected cards
  const allStyleTags: string[] = [];
  for (const card of cards) {
    if (selectedIds.has(card.id)) {
      for (const tag of card.tags.style_tags) {
        allStyleTags.push(tag.toLowerCase());
      }
    }
  }

  // Score each archetype by counting keyword matches
  const scores: Record<string, number> = {};
  for (const [archetype, keywords] of Object.entries(archetypeKeywords)) {
    let count = 0;
    for (const keyword of keywords) {
      if (allStyleTags.includes(keyword)) count++;
    }
    if (count > 0) scores[archetype] = count;
  }

  // Normalize to 0-1 range (matching backend behavior)
  const total = Object.values(scores).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    for (const key of Object.keys(scores)) {
      scores[key] = Math.round((scores[key] / total) * 100) / 100;
    }
  }

  return scores;
}

// ── Progress Dots ───────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            i < current && styles.dotCompleted,
          ]}
        />
      ))}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['5xl'],
    paddingBottom: spacing.lg,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
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
    marginBottom: spacing['2xl'],
  },
  nameInput: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    minWidth: 200,
    marginBottom: spacing['3xl'],
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing['2xl'],
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },

  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },

  // Occasion cards (2-column)
  occasionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    position: 'relative',
  },
  cardEmoji: {
    fontSize: 32,
  },
  occasionLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  cardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accentSoft + '40',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Style cards (3-column)
  styleCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs + 2,
    alignItems: 'center',
    gap: spacing.xs,
    position: 'relative',
    minHeight: 100,
    justifyContent: 'center',
  },
  styleCardEmoji: {
    fontSize: 26,
  },
  styleCardLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Rejected card styling
  cardRejected: {
    borderColor: colors.error,
    borderWidth: 2,
    backgroundColor: colors.error + '10',
  },
  rejectBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  counterText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
    textAlign: 'center',
  },

  // Progress dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  dotCompleted: {
    backgroundColor: colors.accentSoft,
  },
});
