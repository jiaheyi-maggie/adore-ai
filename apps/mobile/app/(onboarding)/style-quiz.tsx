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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii, spacing } from '../../lib/theme';

// ── Style quiz definitions ──────────────────────────────────

interface StyleChoice {
  question: string;
  optionA: { label: string; icon: string; archetype: string };
  optionB: { label: string; icon: string; archetype: string };
}

const STYLE_QUESTIONS: StyleChoice[] = [
  {
    question: 'Which speaks to you more?',
    optionA: {
      label: 'Minimal\n& Clean',
      icon: 'remove-outline',
      archetype: 'minimalist',
    },
    optionB: {
      label: 'Layered\n& Maximal',
      icon: 'layers-outline',
      archetype: 'maximalist',
    },
  },
  {
    question: 'Your color instinct?',
    optionA: {
      label: 'Neutral\nEarth Tones',
      icon: 'leaf-outline',
      archetype: 'earthy',
    },
    optionB: {
      label: 'Bold\nSaturated Color',
      icon: 'color-palette-outline',
      archetype: 'colorful',
    },
  },
  {
    question: 'How do you like your fit?',
    optionA: {
      label: 'Structured\n& Tailored',
      icon: 'resize-outline',
      archetype: 'classic',
    },
    optionB: {
      label: 'Relaxed\n& Flowy',
      icon: 'water-outline',
      archetype: 'bohemian',
    },
  },
  {
    question: 'Your style timeline?',
    optionA: {
      label: 'Classic\n& Timeless',
      icon: 'time-outline',
      archetype: 'classic',
    },
    optionB: {
      label: 'Trend-Forward\n& Edgy',
      icon: 'flash-outline',
      archetype: 'edgy',
    },
  },
  {
    question: 'Your shopping philosophy?',
    optionA: {
      label: 'Investment\nPieces',
      icon: 'diamond-outline',
      archetype: 'investment',
    },
    optionB: {
      label: 'Variety\n& Rotation',
      icon: 'shuffle-outline',
      archetype: 'eclectic',
    },
  },
];

// ── Component ───────────────────────────────────────────────

export default function StyleQuizScreen() {
  const router = useRouter();

  // Phase: 'name' or 'quiz'
  const [phase, setPhase] = useState<'name' | 'quiz'>('name');
  const [name, setName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

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

  const handleNameSubmit = () => {
    if (!name.trim()) return;
    animateTransition(() => setPhase('quiz'));
  };

  const handleChoice = (archetype: string) => {
    // Accumulate archetype scores
    const updated = { ...answers };
    updated[archetype] = (updated[archetype] ?? 0) + 0.2;

    setAnswers(updated);

    if (currentQuestion < STYLE_QUESTIONS.length - 1) {
      animateTransition(() => setCurrentQuestion((prev) => prev + 1));
    } else {
      // Quiz complete - normalize scores and navigate
      const total = Object.values(updated).reduce((sum, v) => sum + v, 0);
      const normalized: Record<string, number> = {};
      for (const [key, value] of Object.entries(updated)) {
        normalized[key] = Math.round((value / total) * 100) / 100;
      }

      // Navigate to color analysis, passing data via params
      router.push({
        pathname: '/color-analysis',
        params: {
          name: name.trim(),
          style_archetypes: JSON.stringify(normalized),
        },
      });
    }
  };

  // ── Name Phase ──────────────────────────────────────────────

  if (phase === 'name') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
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
            onSubmitEditing={handleNameSubmit}
          />

          <Pressable
            style={[styles.continueButton, !name.trim() && styles.buttonDisabled]}
            onPress={handleNameSubmit}
            disabled={!name.trim()}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.surface} />
          </Pressable>
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          {STYLE_QUESTIONS.map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Quiz Phase ────────────────────────────────────────────

  const question = STYLE_QUESTIONS[currentQuestion];

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.questionNumber}>
          {currentQuestion + 1} of {STYLE_QUESTIONS.length}
        </Text>
        <Text style={styles.heading}>{question.question}</Text>

        <View style={styles.choicesRow}>
          {/* Option A */}
          <Pressable
            style={styles.choiceCard}
            onPress={() => handleChoice(question.optionA.archetype)}
          >
            <View style={styles.choiceIconContainer}>
              <Ionicons
                name={question.optionA.icon as any}
                size={36}
                color={colors.accent}
              />
            </View>
            <Text style={styles.choiceLabel}>{question.optionA.label}</Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.orDivider}>
            <Text style={styles.orText}>or</Text>
          </View>

          {/* Option B */}
          <Pressable
            style={styles.choiceCard}
            onPress={() => handleChoice(question.optionB.archetype)}
          >
            <View style={styles.choiceIconContainer}>
              <Ionicons
                name={question.optionB.icon as any}
                size={36}
                color={colors.accent}
              />
            </View>
            <Text style={styles.choiceLabel}>{question.optionB.label}</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dotsContainer}>
        <View style={styles.dotCompleted} />
        {STYLE_QUESTIONS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentQuestion && styles.dotActive,
              i < currentQuestion && styles.dotCompleted,
            ]}
          />
        ))}
      </View>
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
    marginBottom: spacing['3xl'],
  },
  questionNumber: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
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
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: spacing['2xl'],
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
  choicesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
  choiceCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  choiceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
  orDivider: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    marginLeft: -14,
    zIndex: 1,
  },
  orText: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing['4xl'],
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
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
  },
});
