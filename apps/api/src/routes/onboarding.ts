import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { COLOR_SEASONS } from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';

const onboarding = new Hono<{ Variables: AppVariables }>();
onboarding.use('*', authMiddleware);

// ── Validation Schemas ──────────────────────────────────────

const completeOnboardingSchema = z.object({
  name: z.string().min(1).max(100),
  style_archetypes: z.record(z.string(), z.number()).optional(),
  color_season: z.enum(COLOR_SEASONS).nullable().optional(),
  skin_undertone: z.enum(['warm', 'cool', 'neutral']).nullable().optional(),
});

const colorAnalysisSchema = z.object({
  image_url: z.string().url(),
});

// ── POST /auth/profile/onboarding — Complete onboarding ─────

onboarding.post(
  '/profile/onboarding',
  zValidator('json', completeOnboardingSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const { name, style_archetypes, color_season, skin_undertone } = body;

    // Update users table
    const { error: userError } = await supabase
      .from('users')
      .update({
        name,
        onboarding_completed: true,
      })
      .eq('id', userId);

    if (userError) {
      return c.json(
        { data: null, error: { code: 'UPDATE_FAILED', message: userError.message } },
        400,
      );
    }

    // Update style_profiles
    const profileUpdates: Record<string, unknown> = {};
    if (style_archetypes) profileUpdates.style_archetypes = style_archetypes;
    if (color_season) profileUpdates.color_season = color_season;
    if (skin_undertone) profileUpdates.skin_undertone = skin_undertone;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabase
        .from('style_profiles')
        .update(profileUpdates)
        .eq('user_id', userId);

      if (profileError) {
        return c.json(
          { data: null, error: { code: 'PROFILE_UPDATE_FAILED', message: profileError.message } },
          400,
        );
      }
    }

    return c.json({
      data: { onboarding_completed: true },
      error: null,
    });
  },
);

// ── POST /auth/profile/color-analysis — Analyze selfie ──────

const COLOR_ANALYSIS_PROMPT = `You are a professional color analyst. Analyze this selfie to determine the person's color season based on their natural coloring (skin tone, hair color, eye color).

Respond with ONLY a JSON object (no markdown, no explanation) matching this exact schema:

{
  "color_season": one of: ${COLOR_SEASONS.join(', ')},
  "skin_undertone": one of: "warm", "cool", "neutral",
  "best_colors": string[] (8-12 specific fashion color names that would look best on this person),
  "color_swatches": string[] (4 hex codes representing the person's best core colors),
  "reasoning": string (1-2 sentences explaining the analysis),
  "confidence": number 0.0-1.0 (how confident you are in this determination)
}

Rules:
- Base your analysis on visible skin tone, hair color, and eye color
- Consider undertone warmth/coolness from the skin
- Spring: warm + light. Summer: cool + light. Autumn: warm + deep. Winter: cool + deep.
- Add modifiers: light, warm, cool, clear, deep, soft
- best_colors should be specific fashion color names (not generic — "dusty rose" not "pink")
- color_swatches: 4 hex codes representing complementary colors for this person
- Be honest about confidence — if lighting is poor or filters are present, lower confidence`;

onboarding.post(
  '/profile/color-analysis',
  zValidator('json', colorAnalysisSchema),
  async (c) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return c.json(
        { data: null, error: { code: 'CONFIG_ERROR', message: 'GEMINI_API_KEY not configured' } },
        500,
      );
    }

    const { image_url } = c.req.valid('json');

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    try {
      // Fetch the image and convert to base64
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
              { text: COLOR_ANALYSIS_PROMPT },
            ],
          },
        ],
      });

      const text = response.text?.trim();
      if (!text) {
        throw new Error('No text response from Gemini');
      }

      let jsonStr = text;
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const result = JSON.parse(jsonStr);

      // Validate required fields
      if (!result.color_season || !result.skin_undertone) {
        throw new Error('Incomplete color analysis result');
      }

      return c.json({ data: result, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze colors';
      return c.json(
        { data: null, error: { code: 'ANALYSIS_FAILED', message } },
        502,
      );
    }
  },
);

// ── GET /auth/profile — Get current user profile ────────────

onboarding.get('/profile', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: userError.message } },
      404,
    );
  }

  const { data: styleProfile } = await supabase
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  return c.json({
    data: {
      user,
      style_profile: styleProfile ?? null,
    },
    error: null,
  });
});

export default onboarding;
