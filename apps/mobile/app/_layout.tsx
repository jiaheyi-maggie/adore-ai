import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#1a1a1a',
          tabBarInactiveTintColor: '#999',
          tabBarStyle: {
            backgroundColor: '#fafafa',
            borderTopColor: '#eee',
          },
          headerStyle: {
            backgroundColor: '#fafafa',
          },
          headerTitleStyle: {
            fontWeight: '300',
            letterSpacing: 2,
          },
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
      </Tabs>
    </QueryClientProvider>
  );
}
