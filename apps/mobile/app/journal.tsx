import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function JournalScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Ionicons name="camera-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No outfits logged yet</Text>
        <Text style={styles.emptySubtitle}>
          Snap a photo of what you're wearing today.{'\n'}
          Your wardrobe builds itself over time.
        </Text>
        <Pressable style={styles.captureButton}>
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.captureText}>Log Today's Outfit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 24,
    gap: 10,
  },
  captureText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
