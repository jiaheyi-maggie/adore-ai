import { useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import { queryClient } from '../lib/query-client';
import { colors, fonts } from '../lib/theme';

// Keep the splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={loadingStyles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
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
          <Tabs.Screen
            name="index"
            options={{
              title: 'Wardrobe',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="shirt-outline" size={size} color={color} />
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
          {/* Hide add-item from tabs — it's a modal screen accessed via navigation */}
          <Tabs.Screen
            name="add-item"
            options={{
              href: null,
              title: 'Add Item',
            }}
          />
          {/* Hide log-outfit from tabs — it's a modal screen accessed via journal */}
          <Tabs.Screen
            name="log-outfit"
            options={{
              href: null,
              title: 'Log Outfit',
            }}
          />
          {/* Hide sell-item from tabs — accessed via wardrobe long-press */}
          <Tabs.Screen
            name="sell-item"
            options={{
              href: null,
              title: 'Sell Item',
            }}
          />
          {/* Hide my-listings from tabs — accessed via profile */}
          <Tabs.Screen
            name="my-listings"
            options={{
              href: null,
              title: 'My Listings',
            }}
          />
        </Tabs>
      </View>
    </QueryClientProvider>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
