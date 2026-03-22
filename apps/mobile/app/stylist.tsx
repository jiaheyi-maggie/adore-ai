import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, fonts } from '../lib/theme';
import {
  sendMessage,
  getMessages,
  type ChatResponse,
} from '../lib/api';
import type { Message, ApiResponse } from '@adore/shared';

// ── Typing Dots Animation ──────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = createDotAnimation(dot1, 0);
    const anim2 = createDotAnimation(dot2, 150);
    const anim3 = createDotAnimation(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={styles.typingContainer}>
      <View style={styles.aiBubble}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.dot, dotStyle(dot1)]} />
          <Animated.View style={[styles.dot, dotStyle(dot2)]} />
          <Animated.View style={[styles.dot, dotStyle(dot3)]} />
        </View>
      </View>
    </View>
  );
}

// ── Welcome Message ────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  id: '__welcome__',
  conversation_id: '',
  role: 'assistant',
  content:
    "Hi! I'm your personal stylist. I learn your preferences over time and help you make great wardrobe decisions.\n\nTry asking me:\n\"What should I wear today?\"\n\"Should I buy this?\"\n\"What's missing from my wardrobe?\"",
  tool_calls: null,
  token_usage: null,
  created_at: new Date().toISOString(),
};

// ── Message Bubble ─────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.created_at);
  const timeStr = timestamp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAI,
      ]}
    >
      {!isUser && (
        <View style={styles.avatarContainer}>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
        </View>
      )}
      <View style={styles.bubbleWrapper}>
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.aiMessageText,
            ]}
          >
            {message.content}
          </Text>
        </View>
        <Text
          style={[
            styles.timestamp,
            isUser ? styles.timestampUser : styles.timestampAI,
          ]}
        >
          {message.id === '__welcome__' ? '' : timeStr}
        </Text>
      </View>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────

export default function StylistScreen() {
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // Optimistic messages that haven't been confirmed from the server yet
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  // Fetch messages for current conversation
  const {
    data: messagesData,
    isLoading: isLoadingMessages,
  } = useQuery({
    queryKey: ['stylist-messages', conversationId],
    queryFn: () => getMessages(conversationId!, { limit: 50 }),
    enabled: !!conversationId,
  });

  // Build the display messages list
  const serverMessages = messagesData?.data ?? [];
  const displayMessages: Message[] = (() => {
    if (!conversationId && optimisticMessages.length === 0) {
      // No conversation yet — show welcome message
      return [WELCOME_MESSAGE];
    }

    // Merge server messages with optimistic messages
    // Keep only optimistic messages whose IDs aren't yet in the server data
    const serverIds = new Set(serverMessages.map((m) => m.id));
    const pendingOptimistic = optimisticMessages.filter(
      (m) => !serverIds.has(m.id)
    );

    const merged = [...serverMessages, ...pendingOptimistic];

    // If empty, show welcome
    if (merged.length === 0) {
      return [WELCOME_MESSAGE];
    }

    return merged;
  })();

  // Reversed for inverted FlatList
  const reversedMessages = [...displayMessages].reverse();

  // Send message mutation
  const chatMutation = useMutation({
    mutationFn: (params: { message: string; conversationId?: string }) =>
      sendMessage(params.message, params.conversationId),
    onSuccess: (response: ApiResponse<ChatResponse>) => {
      const { message: aiMessage, conversation } = response.data;

      // Set conversation ID if this was a new conversation
      if (!conversationId) {
        setConversationId(conversation.id);
      }

      // Add AI message optimistically
      setOptimisticMessages((prev) => [...prev, aiMessage]);

      // Invalidate the messages query to sync with server
      queryClient.invalidateQueries({
        queryKey: ['stylist-messages', conversation.id],
      });

      // Also invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: ['stylist-conversations'],
      });
    },
    onError: (error: Error) => {
      // Remove the optimistic user message on error
      setOptimisticMessages((prev) =>
        prev.filter((m) => !m.id.startsWith('__optimistic_'))
      );
      console.error('Chat error:', error.message);
    },
    onSettled: () => {
      setIsSending(false);
    },
  });

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText('');
    setIsSending(true);

    // Add optimistic user message
    const optimisticUserMsg: Message = {
      id: `__optimistic_user_${Date.now()}`,
      conversation_id: conversationId ?? '',
      role: 'user',
      content: text,
      tool_calls: null,
      token_usage: null,
      created_at: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimisticUserMsg]);

    chatMutation.mutate({
      message: text,
      conversationId: conversationId ?? undefined,
    });
  }, [inputText, isSending, conversationId, chatMutation]);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setOptimisticMessages([]);
    setInputText('');
    setIsSending(false);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => <MessageBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header actions */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={handleNewConversation}
          style={styles.newChatButton}
          hitSlop={8}
        >
          <Ionicons name="create-outline" size={20} color={colors.accent} />
          <Text style={styles.newChatText}>New Chat</Text>
        </Pressable>
      </View>

      {/* Messages */}
      {isLoadingMessages && conversationId ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          ListHeaderComponent={isSending ? <TypingIndicator /> : null}
        />
      )}

      {/* Input area */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Ask your stylist..."
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={4000}
          returnKeyType="default"
          editable={!isSending}
        />
        <Pressable
          style={[
            styles.sendButton,
            (!inputText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  newChatText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.accent,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
  },
  messageRowAI: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  bubbleWrapper: {
    flexShrink: 1,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.accentSoft,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: colors.textPrimary,
  },
  timestamp: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  timestampUser: {
    textAlign: 'right',
  },
  timestampAI: {
    textAlign: 'left',
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginVertical: 4,
    paddingLeft: 36, // align with AI messages (avatar width + margin)
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.secondary,
  },

  // Input area
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: colors.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
