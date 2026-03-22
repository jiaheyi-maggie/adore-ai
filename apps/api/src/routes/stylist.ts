import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';

const stylist = new Hono<{ Variables: AppVariables }>();
stylist.use('*', authMiddleware);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Validation Schemas ──────────────────────────────────────

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversation_id: z.string().uuid().optional(),
});

const listConversationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const listMessagesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── System Prompt Builder ───────────────────────────────────

function buildSystemPrompt(context: {
  styleProfile: Record<string, unknown> | null;
  wardrobeSummary: string;
  recentOutfits: string;
  memories: string;
  weatherContext: string;
}): string {
  const parts: string[] = [];

  parts.push(`You are Adore, a personal stylist AI. You're warm, knowledgeable, and honest. You know fashion but you're not pretentious. You speak like a stylish friend who genuinely wants to help — concise, encouraging, occasionally playful. Never condescending.

Your job:
- Help with outfit suggestions by referencing SPECIFIC items from the user's wardrobe by name
- Advise on purchase decisions (should they buy something?)
- Analyze wardrobe gaps and suggest improvements
- Remember and respect their stated preferences
- Be concise — 2-4 sentences for quick questions, longer only when they ask for detail
- When suggesting outfits, name the specific items (e.g. "your navy crew neck tee with the cream linen trousers")
- If they ask "what should I wear", always suggest specific items from their wardrobe
- Never invent items they don't own — if their wardrobe is limited, acknowledge it honestly`);

  if (context.styleProfile) {
    const sp = context.styleProfile;
    const profileParts: string[] = [];

    if (sp.color_season) profileParts.push(`Color season: ${sp.color_season}`);
    if (sp.skin_undertone) profileParts.push(`Skin undertone: ${sp.skin_undertone}`);

    const archetypes = sp.style_archetypes as Record<string, number> | null;
    if (archetypes && Object.keys(archetypes).length > 0) {
      const sorted = Object.entries(archetypes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, score]) => `${name} (${Math.round(score * 100)}%)`);
      profileParts.push(`Style archetypes: ${sorted.join(', ')}`);
    }

    const brandAffinities = sp.brand_affinities as Record<string, number> | null;
    if (brandAffinities && Object.keys(brandAffinities).length > 0) {
      const topBrands = Object.entries(brandAffinities)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name]) => name);
      profileParts.push(`Favorite brands: ${topBrands.join(', ')}`);
    }

    const avoidedStyles = sp.avoided_styles as string[] | null;
    if (avoidedStyles && avoidedStyles.length > 0) {
      profileParts.push(`Avoids: ${avoidedStyles.join(', ')}`);
    }

    const formality = sp.formality_distribution as Record<string, number> | null;
    if (formality) {
      const topFormality = Object.entries(formality)
        .sort(([, a], [, b]) => b - a)
        .filter(([, v]) => v > 0)
        .slice(0, 2)
        .map(([name]) => name.replace('_', ' '));
      if (topFormality.length > 0) {
        profileParts.push(`Typical formality: ${topFormality.join(', ')}`);
      }
    }

    if (profileParts.length > 0) {
      parts.push(`\n--- USER STYLE PROFILE ---\n${profileParts.join('\n')}`);
    }
  }

  if (context.wardrobeSummary) {
    parts.push(`\n--- USER'S WARDROBE ---\n${context.wardrobeSummary}`);
  }

  if (context.recentOutfits) {
    parts.push(`\n--- RECENT OUTFITS ---\n${context.recentOutfits}`);
  }

  if (context.memories) {
    parts.push(`\n--- REMEMBERED PREFERENCES ---\n${context.memories}`);
  }

  if (context.weatherContext) {
    parts.push(`\n--- CURRENT WEATHER ---\n${context.weatherContext}`);
  }

  const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  parts.push(`\n--- CURRENT CONTEXT ---\nToday is ${dayOfWeek}, ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`);

  return parts.join('\n');
}

// ── Context Builders ────────────────────────────────────────

async function buildWardrobeSummary(
  supabase: ReturnType<typeof import('../lib/supabase').createUserClient>
): Promise<string> {
  // Get category counts
  const { data: items } = await supabase
    .from('wardrobe_items')
    .select('id, name, category, colors, brand, times_worn, formality_level, seasons')
    .in('status', ['active', 'stored'])
    .order('times_worn', { ascending: false })
    .limit(200);

  if (!items || items.length === 0) {
    return 'The user has no items in their wardrobe yet.';
  }

  // Category breakdown
  const categoryCount: Record<string, number> = {};
  for (const item of items) {
    categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
  }
  const breakdown = Object.entries(categoryCount)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(', ');

  // Most worn items (top 10)
  const mostWorn = items
    .filter((i) => i.times_worn > 0)
    .slice(0, 10)
    .map((i) => {
      const colorStr = i.colors?.length > 0 ? i.colors.join('/') + ' ' : '';
      const brandStr = i.brand ? ` (${i.brand})` : '';
      return `- ${i.name}: ${colorStr}${i.category}${brandStr} — worn ${i.times_worn}x`;
    });

  // Least worn (never worn items)
  const neverWorn = items
    .filter((i) => i.times_worn === 0)
    .slice(0, 5)
    .map((i) => {
      const colorStr = i.colors?.length > 0 ? i.colors.join('/') + ' ' : '';
      return `- ${i.name}: ${colorStr}${i.category}`;
    });

  const parts = [`The user owns ${items.length} items: ${breakdown}.`];

  if (mostWorn.length > 0) {
    parts.push(`\nMost-worn items:\n${mostWorn.join('\n')}`);
  }

  if (neverWorn.length > 0) {
    parts.push(`\nNever worn:\n${neverWorn.join('\n')}`);
  }

  // Full item list for reference (compact format)
  const allItems = items.map((i) => {
    const colorStr = i.colors?.length > 0 ? i.colors.join('/') : 'no color noted';
    const brandStr = i.brand ? `, ${i.brand}` : '';
    return `- ${i.name} [${i.category}] ${colorStr}${brandStr}`;
  });
  parts.push(`\nFull wardrobe:\n${allItems.join('\n')}`);

  return parts.join('\n');
}

async function buildRecentOutfits(
  supabase: ReturnType<typeof import('../lib/supabase').createUserClient>
): Promise<string> {
  const { data: outfits } = await supabase
    .from('outfits')
    .select(
      `
      id, occasion, mood_tag, worn_date, notes,
      outfit_items (
        wardrobe_item:wardrobe_items (name, category, colors)
      )
    `
    )
    .order('worn_date', { ascending: false })
    .limit(5);

  if (!outfits || outfits.length === 0) {
    return '';
  }

  const descriptions = outfits.map((outfit) => {
    const outfitItems = (outfit.outfit_items ?? []) as unknown as Array<{
      wardrobe_item: { name: string; category: string; colors: string[] } | null;
    }>;
    const itemNames = outfitItems
      .map((oi) => oi.wardrobe_item?.name)
      .filter(Boolean)
      .join(', ');

    const parts = [];
    if (outfit.worn_date) parts.push(outfit.worn_date);
    if (outfit.occasion) parts.push(`for ${outfit.occasion}`);
    if (outfit.mood_tag) parts.push(`felt ${outfit.mood_tag}`);
    if (itemNames) parts.push(`wore: ${itemNames}`);
    if (outfit.notes) parts.push(`"${outfit.notes}"`);

    return `- ${parts.join(' | ')}`;
  });

  return `In recent days, the user wore:\n${descriptions.join('\n')}`;
}

async function buildMemoriesContext(
  supabase: ReturnType<typeof import('../lib/supabase').createUserClient>,
  messageContent: string
): Promise<string> {
  // Fetch all active (non-superseded) memories, ordered by importance
  const { data: memories } = await supabase
    .from('agent_memories')
    .select('content, memory_type, importance_score')
    .is('superseded_by', null)
    .order('importance_score', { ascending: false })
    .limit(20);

  if (!memories || memories.length === 0) {
    return '';
  }

  // Simple keyword relevance: score memories by overlap with the user's message
  const messageWords = new Set(
    messageContent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  const scored = memories.map((m) => {
    const contentWords = m.content.toLowerCase().split(/\s+/);
    const overlap = contentWords.filter((w: string) => messageWords.has(w)).length;
    return { ...m, relevance: overlap };
  });

  // Take top 10 by relevance, then importance
  const relevant = scored
    .sort((a, b) => b.relevance - a.relevance || b.importance_score - a.importance_score)
    .slice(0, 10);

  const lines = relevant.map(
    (m) => `- [${m.memory_type}] ${m.content}`
  );

  return `Known preferences and facts about this user:\n${lines.join('\n')}`;
}

// ── Memory Extraction ───────────────────────────────────────

const MEMORY_EXTRACTION_PROMPT = `You are analyzing a conversation between a user and their personal stylist AI. Extract any NEW facts, preferences, or plans the user revealed in their LATEST message that would be useful to remember for future conversations.

Look for:
- Style preferences ("I don't like yellow", "I prefer oversized fits")
- Upcoming events ("I have a wedding in June", "Starting a new job next month")
- Body/fit preferences ("V-necks look best on me", "I'm petite")
- Shopping preferences ("I only buy sustainable brands", "My budget is $200/month")
- Lifestyle info relevant to styling ("I bike to work", "I work from home")

Respond with ONLY a JSON array of extracted memories. If nothing new to remember, respond with an empty array [].

Each memory object:
{
  "content": "concise statement of the fact/preference",
  "memory_type": "semantic" (preferences/facts) or "episodic" (events/plans),
  "importance_score": 1-10 (10 = critical preference, 1 = minor detail)
}

Rules:
- Only extract from the USER's message, not the assistant's
- Be concise — "Dislikes yellow clothing" not "The user mentioned they don't like yellow"
- Don't extract greetings, thanks, or conversational fluff
- If unsure whether something is worth remembering, skip it`;

async function extractAndStoreMemories(
  ai: InstanceType<typeof GoogleGenAI>,
  supabase: ReturnType<typeof import('../lib/supabase').createUserClient>,
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${MEMORY_EXTRACTION_PROMPT}\n\n--- CONVERSATION ---\nUser: ${userMessage}\nAssistant: ${assistantResponse}`,
            },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text) return;

    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const memories = JSON.parse(jsonStr);
    if (!Array.isArray(memories) || memories.length === 0) return;

    // Validate and insert each memory
    const memorySchema = z.object({
      content: z.string().min(1).max(500),
      memory_type: z.enum(['semantic', 'episodic', 'working', 'procedural']),
      importance_score: z.number().min(1).max(10),
    });

    for (const raw of memories) {
      const parsed = memorySchema.safeParse(raw);
      if (!parsed.success) continue;

      const { content, memory_type, importance_score } = parsed.data;

      // Check for duplicate/similar existing memory to avoid redundancy
      const { data: existing } = await supabase
        .from('agent_memories')
        .select('id, content')
        .eq('memory_type', memory_type)
        .is('superseded_by', null)
        .ilike('content', `%${content.slice(0, 30)}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        // Supersede the old memory with the updated one
        const newMemory = await supabase
          .from('agent_memories')
          .insert({
            user_id: userId,
            memory_type,
            content,
            importance_score,
          })
          .select('id')
          .single();

        if (newMemory.data) {
          await supabase
            .from('agent_memories')
            .update({ superseded_by: newMemory.data.id })
            .eq('id', existing[0].id);
        }
      } else {
        await supabase.from('agent_memories').insert({
          user_id: userId,
          memory_type,
          content,
          importance_score,
        });
      }
    }
  } catch {
    // Memory extraction is non-fatal — don't block the chat response
    console.error('Memory extraction failed (non-fatal)');
  }
}

// ── Generate conversation title from first exchange ─────────

async function generateConversationTitle(
  ai: InstanceType<typeof GoogleGenAI>,
  userMessage: string
): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate a very short title (3-6 words max) for a stylist conversation that starts with this message. Respond with ONLY the title text, no quotes, no punctuation at the end.\n\nMessage: "${userMessage}"`,
            },
          ],
        },
      ],
    });
    const title = response.text?.trim();
    return title && title.length < 60 ? title : 'New conversation';
  } catch {
    return 'New conversation';
  }
}

// ── POST /stylist/chat — Send message, get AI response ──────

stylist.post('/chat', zValidator('json', chatSchema), async (c) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return c.json(
      { data: null, error: { code: 'CONFIG_ERROR', message: 'GEMINI_API_KEY not configured' } },
      500
    );
  }

  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const { message, conversation_id } = c.req.valid('json');

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  let conversationId = conversation_id;
  let isNewConversation = false;

  // 1. Create or validate conversation
  if (!conversationId) {
    isNewConversation = true;
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title: null })
      .select()
      .single();

    if (convError || !conv) {
      return c.json(
        { data: null, error: { code: 'CREATE_FAILED', message: convError?.message ?? 'Failed to create conversation' } },
        400
      );
    }
    conversationId = conv.id;
  } else {
    // Verify the conversation exists and belongs to this user
    const { data: existing, error: existError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .single();

    if (existError || !existing) {
      return c.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        404
      );
    }
  }

  // 2. Save user message
  const { data: userMsg, error: userMsgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })
    .select()
    .single();

  if (userMsgError || !userMsg) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: userMsgError?.message ?? 'Failed to save message' } },
      400
    );
  }

  // 3. Build AI context (parallel fetches)
  const [styleProfileResult, wardrobeSummary, recentOutfits, memoriesContext, conversationHistory] =
    await Promise.all([
      supabase.from('style_profiles').select('*').limit(1).single(),
      buildWardrobeSummary(supabase),
      buildRecentOutfits(supabase),
      buildMemoriesContext(supabase, message),
      // Fetch last 20 messages for this conversation
      supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20),
    ]);

  const styleProfile = styleProfileResult.data ?? null;

  // Build weather context string (best effort)
  let weatherStr = '';
  // We don't have lat/lon in the chat request, so skip weather for now
  // Future: accept optional location in chat payload

  const systemPrompt = buildSystemPrompt({
    styleProfile,
    wardrobeSummary,
    recentOutfits,
    memories: memoriesContext,
    weatherContext: weatherStr,
  });

  // 4. Build Gemini messages array
  const geminiMessages: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Add conversation history (excluding the message we just inserted, which is the latest)
  const history = conversationHistory.data ?? [];
  for (const msg of history) {
    // Skip the message we just inserted (it's the last user message)
    if (msg.role === 'system') continue;
    geminiMessages.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // 5. Call Gemini
  let assistantContent: string;
  let tokenUsage: { input: number; output: number } | null = null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        maxOutputTokens: 1024,
        temperature: 0.8,
        systemInstruction: systemPrompt,
      },
      contents: geminiMessages,
    });

    assistantContent = response.text?.trim() ?? 'I apologize, I had trouble generating a response. Could you try asking again?';

    if (response.usageMetadata) {
      tokenUsage = {
        input: response.usageMetadata.promptTokenCount ?? 0,
        output: response.usageMetadata.candidatesTokenCount ?? 0,
      };
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Gemini API error';
    console.error('Gemini chat error:', errMessage);
    return c.json(
      { data: null, error: { code: 'AI_ERROR', message: 'Failed to generate response. Please try again.' } },
      502
    );
  }

  // 6. Save assistant message
  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: assistantContent,
      token_usage: tokenUsage,
    })
    .select()
    .single();

  if (assistantMsgError || !assistantMsg) {
    // Non-fatal for the user — they still get the response
    console.error('Failed to save assistant message:', assistantMsgError?.message);
  }

  // 7. Update conversation timestamp and generate title for new conversations
  if (isNewConversation) {
    // Fire-and-forget: generate title and update
    generateConversationTitle(ai, message).then((title) => {
      supabase
        .from('conversations')
        .update({ title })
        .eq('id', conversationId!)
        .then(() => {});
    });
  } else {
    // Touch updated_at
    supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .then(() => {});
  }

  // 8. Extract memories in background (fire-and-forget)
  extractAndStoreMemories(ai, supabase, userId, message, assistantContent);

  // 9. Fetch the conversation record to return
  const { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  return c.json({
    data: {
      message: assistantMsg ?? {
        id: 'temp',
        conversation_id: conversationId,
        role: 'assistant' as const,
        content: assistantContent,
        tool_calls: null,
        token_usage: tokenUsage,
        created_at: new Date().toISOString(),
      },
      conversation: conversation ?? {
        id: conversationId,
        user_id: userId,
        title: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    error: null,
  });
});

// ── GET /stylist/conversations — List conversations (paginated) ──

stylist.get(
  '/conversations',
  zValidator('query', listConversationsSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const { cursor, limit } = c.req.valid('query');

    let query = supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('updated_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      return c.json(
        { data: null, error: { code: 'QUERY_FAILED', message: error.message } },
        400
      );
    }

    const items = data ?? [];
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].updated_at : null;

    return c.json({
      data: page,
      error: null,
      pagination: {
        cursor: nextCursor,
        has_more: hasMore,
        count: page.length,
      },
    });
  }
);

// ── GET /stylist/conversations/:id/messages — Get messages ──

stylist.get(
  '/conversations/:id/messages',
  zValidator('query', listMessagesSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const { cursor, limit } = c.req.valid('query');

    if (!UUID_REGEX.test(id)) {
      return c.json(
        { data: null, error: { code: 'INVALID_ID', message: 'Invalid conversation ID format' } },
        400
      );
    }

    // Verify the conversation exists (RLS will scope to user)
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', id)
      .single();

    if (convError || !conv) {
      return c.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        404
      );
    }

    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(limit + 1);

    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) {
      return c.json(
        { data: null, error: { code: 'QUERY_FAILED', message: error.message } },
        400
      );
    }

    const items = data ?? [];
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].created_at : null;

    return c.json({
      data: page,
      error: null,
      pagination: {
        cursor: nextCursor,
        has_more: hasMore,
        count: page.length,
      },
    });
  }
);

// ── DELETE /stylist/conversations/:id — Delete conversation ──

stylist.delete('/conversations/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  if (!UUID_REGEX.test(id)) {
    return c.json(
      { data: null, error: { code: 'INVALID_ID', message: 'Invalid conversation ID format' } },
      400
    );
  }

  // CASCADE will delete messages too
  const { error } = await supabase.from('conversations').delete().eq('id', id);

  if (error) {
    return c.json(
      { data: null, error: { code: 'DELETE_FAILED', message: error.message } },
      400
    );
  }

  return c.json({ data: { deleted: true }, error: null });
});

export default stylist;
