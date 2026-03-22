import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';

export default function StylistScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.chatArea}>
        <View style={styles.welcomeBubble}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
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
          placeholderTextColor={colors.textMuted}
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
    backgroundColor: colors.background,
  },
  chatArea: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  welcomeBubble: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  welcomeText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    backgroundColor: colors.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
