import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { MarketplaceListing, PaginatedResponse } from '@adore/shared';
import { listListings, getUserProfile } from '../../lib/api';
import { colors, fonts, spacing, radii } from '../../lib/theme';
import { computeStyleDimensions, DEFAULT_DIMENSIONS } from '../../lib/style-dimensions';
import StyleCard from '../../components/StyleCard';

export default function ProfileScreen() {
  const router = useRouter();

  // Fetch active listings to show count badge
  const { data: activeListingsData } = useQuery<PaginatedResponse<MarketplaceListing>>({
    queryKey: ['marketplace-listings', 'active', 'badge'],
    queryFn: () => listListings({ status: 'active', limit: 100 }),
  });
  const activeCount = activeListingsData?.data.length ?? 0;

  // Fetch user profile + style profile for the aura
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: getUserProfile,
  });

  const user = profileData?.data.user;
  const styleProfile = profileData?.data.style_profile;
  const userName = user?.name || 'Your Style';

  // Compute style dimensions (or use defaults if no profile yet)
  const dimensions = styleProfile
    ? computeStyleDimensions(styleProfile)
    : DEFAULT_DIMENSIONS;

  const hasStyleProfile = !!styleProfile?.style_archetypes &&
    Object.keys(styleProfile.style_archetypes).length > 0;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Style Card / Aura Section */}
      <View style={styles.auraSection}>
        {profileLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading your style...</Text>
          </View>
        ) : hasStyleProfile ? (
          <StyleCard
            dimensions={dimensions}
            userName={userName}
            seed={user?.id || 'default'}
            showShareButton={true}
          />
        ) : (
          <View style={styles.emptyAura}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyName}>{userName}</Text>
            <Text style={styles.emptySubtitle}>
              Complete your style quiz to unlock your Style Aura
            </Text>
          </View>
        )}
      </View>

      {/* Menu items */}
      <View style={styles.menuSection}>
        <MenuItem
          icon="pricetag-outline"
          label="My Listings"
          badge={activeCount > 0 ? `${activeCount} active` : undefined}
          onPress={() => router.push('/my-listings')}
        />
        <MenuItem
          icon="color-palette-outline"
          label="Color Analysis"
          badge={styleProfile?.color_season
            ? styleProfile.color_season.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            : 'Not set'}
        />
        <MenuItem
          icon="analytics-outline"
          label="Style DNA"
          badge={hasStyleProfile ? dimensions.archetypeName : 'Not set'}
        />
        <MenuItem icon="wallet-outline" label="Budget" badge="Not set" />
        <MenuItem icon="flag-outline" label="Style Goals" badge="0 active" />
        <MenuItem icon="stats-chart-outline" label="Wardrobe Analytics" />
        <MenuItem icon="leaf-outline" label="Sustainability Score" />
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon as any} size={22} color={colors.secondary} />
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && <Text style={styles.menuBadge}>{badge}</Text>}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing['4xl'],
  },
  auraSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyAura: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyName: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  menuSection: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  menuBadge: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
});
