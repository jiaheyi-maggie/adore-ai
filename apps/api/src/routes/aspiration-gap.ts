// ═══════════════════════════════════════════════════════════
// Aspiration Gap — "You think you're minimalist but your closet says romantic"
// Computes the delta between aspirational style (onboarding) and actual wardrobe
// ═══════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { GoogleGenAI } from '@google/genai';
import type { WardrobeItem, StyleProfile } from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { scoreItemForArchetype, BASE_ARCHETYPES, buildSyntheticPresetFromBase } from '../lib/style-scoring';

const aspirationGap = new Hono<{ Variables: AppVariables }>();
aspirationGap.use('*', authMiddleware);

// ── GET /auth/profile/aspiration-gap ─────────────────────────

aspirationGap.get('/profile/aspiration-gap', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  // 1. Fetch style profile
  const { data: styleProfile, error: profileError } = await supabase
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileError || !styleProfile) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Style profile not found. Complete onboarding first.' } },
      404,
    );
  }

  const profile = styleProfile as StyleProfile;
  const rawAspirations = profile.style_archetypes ?? {};

  if (Object.keys(rawAspirations).length === 0) {
    return c.json(
      { data: null, error: { code: 'NO_ARCHETYPES', message: 'No style archetypes set. Complete the style quiz first.' } },
      400,
    );
  }

  // Normalize aspirational archetypes to sum to 1.0 (matches actual normalization)
  const aspirationalTotal = Object.values(rawAspirations).reduce((s, v) => s + v, 0);
  const aspirationalArchetypes: Record<string, number> = {};
  if (aspirationalTotal > 0) {
    for (const [name, val] of Object.entries(rawAspirations)) {
      aspirationalArchetypes[name] = Math.round((val / aspirationalTotal) * 100) / 100;
    }
  }

  // 2. Fetch wardrobe items
  const { data: wardrobeItems, error: wardrobeError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .neq('status', 'sold')
    .limit(500);

  if (wardrobeError) {
    return c.json(
      { data: null, error: { code: 'QUERY_FAILED', message: wardrobeError.message } },
      400,
    );
  }

  const items = (wardrobeItems ?? []) as WardrobeItem[];

  // 3. Compute actual archetype distribution from wardrobe
  const actualArchetypes: Record<string, number> = {};

  if (items.length > 0) {
    // Score each item against each base archetype and aggregate
    const archetypeScoreSums: Record<string, number> = {};

    for (const archetypeName of BASE_ARCHETYPES) {
      const preset = buildSyntheticPresetFromBase(archetypeName);
      if (!preset) continue;

      let totalScore = 0;
      for (const item of items) {
        totalScore += scoreItemForArchetype(item, preset);
      }
      archetypeScoreSums[archetypeName] = totalScore;
    }

    // Normalize to 0-1 distribution
    const grandTotal = Object.values(archetypeScoreSums).reduce((s, v) => s + v, 0);
    if (grandTotal > 0) {
      for (const [name, score] of Object.entries(archetypeScoreSums)) {
        actualArchetypes[name] = Math.round((score / grandTotal) * 100) / 100;
      }
    }
  }

  // 4. Compute gaps
  const allArchetypes = new Set([
    ...Object.keys(aspirationalArchetypes),
    ...Object.keys(actualArchetypes),
  ]);

  const gaps: Array<{
    archetype: string;
    actual: number;
    aspirational: number;
    delta: number;
    insight: string;
  }> = [];

  for (const arch of allArchetypes) {
    const actual = actualArchetypes[arch] ?? 0;
    const aspirational = aspirationalArchetypes[arch] ?? 0;
    const delta = Math.round((aspirational - actual) * 100) / 100;

    if (Math.abs(delta) < 0.02) continue; // skip negligible gaps

    const displayName = arch.charAt(0).toUpperCase() + arch.slice(1);
    let insight: string;

    if (delta > 0.15) {
      insight = `You aspire to be more ${displayName.toLowerCase()} but your wardrobe hasn't caught up yet`;
    } else if (delta > 0.05) {
      insight = `You're slightly more ${displayName.toLowerCase()} in aspiration than in practice`;
    } else if (delta < -0.15) {
      insight = `Your wardrobe is more ${displayName.toLowerCase()} than you'd expect — you might be a natural`;
    } else if (delta < -0.05) {
      insight = `You lean slightly more ${displayName.toLowerCase()} in practice than you realize`;
    } else {
      insight = `Your ${displayName.toLowerCase()} style is well-aligned between aspiration and wardrobe`;
    }

    gaps.push({ archetype: arch, actual, aspirational, delta, insight });
  }

  // Sort by absolute delta descending (biggest gaps first)
  gaps.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // 5. Generate AI summary (template fallback)
  const summary = await generateGapSummary(gaps, items.length);

  return c.json({
    data: {
      actual_archetypes: actualArchetypes,
      aspirational_archetypes: aspirationalArchetypes,
      gaps,
      summary,
      wardrobe_item_count: items.length,
    },
    error: null,
  });
});

// ── AI Summary Generation ─────────────────────────────────────

async function generateGapSummary(
  gaps: Array<{ archetype: string; actual: number; aspirational: number; delta: number }>,
  itemCount: number,
): Promise<string> {
  if (gaps.length === 0) {
    return 'Your wardrobe perfectly reflects your style aspirations. You\'re dressing exactly as you want to!';
  }

  if (itemCount === 0) {
    return 'Add items to your wardrobe to see how your actual style compares to your aspirations.';
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return generateTemplateSummary(gaps);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const topGaps = gaps.slice(0, 5).map((g) => {
      const direction = g.delta > 0 ? 'aspires toward' : 'naturally leans';
      return `${g.archetype}: ${direction} (${Math.abs(g.delta * 100).toFixed(0)}% gap)`;
    });

    const prompt = `You are a concise personal stylist. Write a 2-sentence summary of this person's style aspiration gap. Be warm and insightful, not judgmental.

Gap data (positive delta = aspires toward but wardrobe doesn't reflect; negative delta = wardrobe shows more than they realize):
${topGaps.join('\n')}

Wardrobe size: ${itemCount} items

Rules:
- Maximum 2 sentences
- Be specific about which archetypes are misaligned
- Use "your closet says" / "you gravitate toward" type phrasing
- No markdown, plain text only
- Sound like a friend, not a textbook`;

    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    const text = response?.text?.trim();
    if (text && text.length > 20) return text;
  } catch (err) {
    console.error('[aspiration-gap] Gemini summary failed:', err instanceof Error ? err.message : err);
  }

  return generateTemplateSummary(gaps);
}

function generateTemplateSummary(
  gaps: Array<{ archetype: string; delta: number }>,
): string {
  const topPositive = gaps.find((g) => g.delta > 0.05);
  const topNegative = gaps.find((g) => g.delta < -0.05);

  if (topPositive && topNegative) {
    const pos = topPositive.archetype;
    const neg = topNegative.archetype;
    return `You aspire to be more ${pos} but your closet tells a ${neg} story. That's not a bad thing — it means you have a natural affinity for ${neg} style that you might not have recognized.`;
  }

  if (topPositive) {
    return `You're drawn to ${topPositive.archetype} style but your wardrobe hasn't caught up yet. A few intentional additions could close that gap.`;
  }

  if (topNegative) {
    return `Your wardrobe is naturally more ${topNegative.archetype} than you realized. You might be underselling this part of your style identity.`;
  }

  return 'Your wardrobe is closely aligned with your style aspirations. You\'re on the right track!';
}

export default aspirationGap;
