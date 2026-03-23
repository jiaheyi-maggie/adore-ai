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
  occasions: z.array(z.string()).optional(),
  liked_styles: z.array(z.string()).optional(),
  disliked_styles: z.array(z.string()).optional(),
  color_season: z.enum(COLOR_SEASONS).nullable().optional(),
  skin_undertone: z.enum(['warm', 'cool', 'neutral']).nullable().optional(),
  // Legacy — still accepted for backward compat
  style_archetypes: z.record(z.string(), z.number()).optional(),
});

const colorAnalysisSchema = z.object({
  image_url: z.string().url(),
});

// ── POST /auth/profile/onboarding — Complete onboarding ─────

onboarding.post(
  '/profile/onboarding',
  zValidator('json', completeOnboardingSchema, (result, c) => {
    if (!result.success) {
      console.error('Onboarding validation failed:', JSON.stringify(result.error.issues, null, 2));
      return c.json(
        { data: null, error: { code: 'VALIDATION_FAILED', message: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') } },
        400
      );
    }
  }),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const {
      name,
      occasions,
      liked_styles,
      disliked_styles,
      color_season,
      skin_undertone,
      style_archetypes: legacyArchetypes,
    } = body;

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

    // Compute style profile from quiz data
    const profileUpdates: Record<string, unknown> = {};

    // Compute style_archetypes from liked/disliked style tags
    if (liked_styles && liked_styles.length > 0) {
      const archetypes = computeStyleArchetypes(liked_styles);
      profileUpdates.style_archetypes = archetypes;
    } else if (legacyArchetypes) {
      // Backward compat: accept pre-computed archetypes
      profileUpdates.style_archetypes = legacyArchetypes;
    }

    // Compute formality_distribution from occasions
    if (occasions && occasions.length > 0) {
      profileUpdates.formality_distribution = computeFormalityDistribution(occasions);
    }

    // Compute avoided_styles from disliked tags
    if (disliked_styles && disliked_styles.length > 0) {
      profileUpdates.avoided_styles = disliked_styles;
    }

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

      // Normalize color_season to match our enum (Gemini may return variant formats)
      result.color_season = normalizeColorSeason(result.color_season);
      if (!result.color_season) {
        throw new Error('Unrecognized color season from analysis');
      }

      // Normalize skin_undertone
      const undertone = result.skin_undertone.toLowerCase().trim();
      if (['warm', 'cool', 'neutral'].includes(undertone)) {
        result.skin_undertone = undertone;
      } else {
        result.skin_undertone = 'neutral';
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

// ── Server-side computation helpers ─────────────────────────

/** Map style tags to archetype categories and compute weighted scores. */
function computeStyleArchetypes(tags: string[]): Record<string, number> {
  const archetypeMap: Record<string, string[]> = {
    minimalist: ['minimalist', 'clean', 'refined', 'understated', 'monochrome'],
    classic: ['classic', 'tailored', 'polished', 'preppy', 'collegiate', 'timeless'],
    bohemian: ['boho', 'relaxed', 'beachy', 'coastal', 'natural', 'organic', 'earthy'],
    edgy: ['edgy', 'rocker', 'bold', 'streetwear', 'urban', 'grunge', 'leather'],
    romantic: ['romantic', 'feminine', 'soft', 'delicate'],
    maximalist: ['maximalist', 'colorful', 'eclectic', 'bold-pattern', 'statement'],
    glamorous: ['glamorous', 'sparkle', 'powerful', 'commanding', 'sharp', 'power'],
    vintage: ['vintage', 'retro', 'nostalgic'],
    cozy: ['cozy', 'layered', 'hygge', 'comfortable'],
    athletic: ['athletic', 'sporty', 'athleisure'],
  };

  const scores: Record<string, number> = {};
  const tagsLower = tags.map((t) => t.toLowerCase());

  for (const [archetype, keywords] of Object.entries(archetypeMap)) {
    let count = 0;
    for (const keyword of keywords) {
      if (tagsLower.includes(keyword)) count++;
    }
    if (count > 0) scores[archetype] = count;
  }

  // Normalize to 0-1 range
  const total = Object.values(scores).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    for (const key of Object.keys(scores)) {
      scores[key] = Math.round((scores[key] / total) * 100) / 100;
    }
  }

  return scores;
}

/** Map occasion selections to formality distribution weights. */
function computeFormalityDistribution(
  occasions: string[],
): Record<string, number> {
  // Each occasion contributes weights to formality levels
  const occasionWeights: Record<string, Record<string, number>> = {
    casual: { casual: 0.6, smart_casual: 0.2 },
    work: { smart_casual: 0.3, business: 0.5, formal: 0.1 },
    social: { smart_casual: 0.4, casual: 0.3, formal: 0.1 },
    active: { casual: 0.8 },
    creative: { casual: 0.3, smart_casual: 0.4 },
    events: { formal: 0.4, black_tie: 0.3, smart_casual: 0.2 },
  };

  const distribution: Record<string, number> = {
    casual: 0,
    smart_casual: 0,
    business: 0,
    formal: 0,
    black_tie: 0,
  };

  for (const occasion of occasions) {
    const weights = occasionWeights[occasion];
    if (weights) {
      for (const [level, weight] of Object.entries(weights)) {
        distribution[level] += weight;
      }
    }
  }

  // Normalize to sum to 1
  const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);
  if (total > 0) {
    for (const key of Object.keys(distribution)) {
      distribution[key] = Math.round((distribution[key] / total) * 100) / 100;
    }
  }

  return distribution;
}

/**
 * Normalize a color_season string from Gemini to match our COLOR_SEASONS enum.
 * Gemini may return values like "Cool Summer", "cool-summer", "Summer Cool", etc.
 * Our enum uses the format "season-modifier" (e.g., "summer-cool").
 * Returns the matching COLOR_SEASONS value, or null if no match.
 */
function normalizeColorSeason(raw: string): string | null {
  const lower = raw.toLowerCase().trim();

  // Direct match
  if ((COLOR_SEASONS as readonly string[]).includes(lower)) {
    return lower;
  }

  // Replace spaces/underscores with hyphens and try again
  const hyphenated = lower.replace(/[\s_]+/g, '-');
  if ((COLOR_SEASONS as readonly string[]).includes(hyphenated)) {
    return hyphenated;
  }

  // Try reversed word order: "cool summer" -> "summer-cool"
  const parts = lower.split(/[\s\-_]+/);
  if (parts.length === 2) {
    const reversed = `${parts[1]}-${parts[0]}`;
    if ((COLOR_SEASONS as readonly string[]).includes(reversed)) {
      return reversed;
    }
  }

  // Fuzzy: find the season that contains both words regardless of order
  if (parts.length >= 2) {
    for (const season of COLOR_SEASONS) {
      const seasonParts = season.split('-');
      if (
        parts.every((p) => seasonParts.some((sp) => sp.startsWith(p) || p.startsWith(sp)))
      ) {
        return season;
      }
    }
  }

  return null;
}

export default onboarding;
