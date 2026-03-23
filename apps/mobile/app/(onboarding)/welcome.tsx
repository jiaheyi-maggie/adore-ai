import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radii, spacing } from '../../lib/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Fade in content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle shimmer loop on brand name
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Brand name with shimmer */}
        <Animated.Text style={[styles.brandName, { opacity: shimmerOpacity }]}>
          adore
        </Animated.Text>

        <Text style={styles.subtitle}>Your Style Intelligence</Text>

        <Text style={styles.description}>
          Discover your colors, understand your style,{'\n'}and build a wardrobe you
          love.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/style-quiz')}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: fonts.cormorant.semibold,
    fontSize: 64,
    color: colors.accent,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.md,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  description: {
    fontFamily: fonts.inter.regular,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  buttonContainer: {
    paddingBottom: spacing['5xl'],
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 17,
    fontWeight: '600',
    color: colors.surface,
  },
});
