import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { MarketplaceListing, PaginatedResponse } from '@adore/shared';
import { listListings } from '../lib/api';
import { colors, fonts } from '../lib/theme';

export default function ProfileScreen() {
  const router = useRouter();

  // Fetch active listings to show count badge
  const { data: activeListingsData } = useQuery<PaginatedResponse<MarketplaceListing>>({
    queryKey: ['marketplace-listings', 'active', 'badge'],
    queryFn: () => listListings({ status: 'active', limit: 100 }),
  });
  const activeCount = activeListingsData?.data.length ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={colors.textMuted} />
        </View>
        <Text style={styles.name}>Set up your profile</Text>
        <Text style={styles.subtitle}>
          Take a selfie for color analysis and answer a few style questions
        </Text>
      </View>

      <View style={styles.menuSection}>
        <MenuItem
          icon="pricetag-outline"
          label="My Listings"
          badge={activeCount > 0 ? `${activeCount} active` : undefined}
          onPress={() => router.push('/my-listings')}
        />
        <MenuItem icon="color-palette-outline" label="Color Analysis" badge="Not set" />
        <MenuItem icon="analytics-outline" label="Style DNA" badge="Not set" />
        <MenuItem icon="wallet-outline" label="Budget" badge="Not set" />
        <MenuItem icon="flag-outline" label="Style Goals" badge="0 active" />
        <MenuItem icon="stats-chart-outline" label="Wardrobe Analytics" />
        <MenuItem icon="leaf-outline" label="Sustainability Score" />
      </View>
    </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontFamily: fonts.cormorant.medium,
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 12,
  },
  subtitle: {
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
