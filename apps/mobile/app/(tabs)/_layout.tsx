import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontFamily: fonts.cormorant.medium,
          fontSize: 20,
          fontWeight: '500',
          color: colors.textPrimary,
        },
        headerShadowVisible: false,
      }}
    >
      {/* ── Visible Tabs (5) ────────────────────────── */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stylist"
        options={{
          title: 'Stylist',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      {/* ── Hidden screens — accessed via navigation, not tabs ── */}
      <Tabs.Screen
        name="wardrobe"
        options={{
          href: null,
          title: 'Wardrobe',
        }}
      />
      <Tabs.Screen
        name="add-item"
        options={{
          href: null,
          title: 'Add Item',
        }}
      />
      <Tabs.Screen
        name="log-outfit"
        options={{
          href: null,
          title: 'Log Outfit',
        }}
      />
      <Tabs.Screen
        name="sell-item"
        options={{
          href: null,
          title: 'Sell Item',
        }}
      />
      <Tabs.Screen
        name="my-listings"
        options={{
          href: null,
          title: 'My Listings',
        }}
      />
      <Tabs.Screen
        name="add-wishlist-item"
        options={{
          href: null,
          title: 'Add to Wishlist',
        }}
      />
      <Tabs.Screen
        name="batch-scan"
        options={{
          href: null,
          title: 'Batch Scan',
        }}
      />
      <Tabs.Screen
        name="hanger-scan"
        options={{
          href: null,
          title: 'Closet Scan',
        }}
      />
      <Tabs.Screen
        name="style-shift"
        options={{
          href: null,
          title: 'Style Shifting',
        }}
      />
      <Tabs.Screen
        name="check-purchase"
        options={{
          href: null,
          title: 'Check a Purchase',
        }}
      />
    </Tabs>
  );
}
