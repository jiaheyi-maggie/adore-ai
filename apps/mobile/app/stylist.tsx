import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StylistScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.chatArea}>
        <View style={styles.welcomeBubble}>
          <Ionicons name="sparkles" size={20} color="#1a1a1a" />
          <Text style={styles.welcomeText}>
            Hi! I'm your personal stylist. I learn your preferences over time
            and help you make great wardrobe decisions.{'\n\n'}
            Try asking me:{'\n'}
            "What should I wear today?"{'\n'}
            "Should I buy this?"{'\n'}
            "What's missing from my wardrobe?"
          </Text>
        </View>
      </View>
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Ask your stylist..."
          placeholderTextColor="#999"
        />
        <Pressable style={styles.sendButton}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
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
  chatArea: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  welcomeBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  welcomeText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  sendButton: {
    backgroundColor: '#1a1a1a',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
