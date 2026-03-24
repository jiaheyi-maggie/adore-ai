import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WardrobeItem, StyleProfile } from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import {
  getAllPresets,
  getPresetById,
  type ArchetypePreset,
} from '../lib/archetype-presets';
import {
  scoreItemForArchetype,
  classifyWardrobe,
  computeDimensionDeltas,
  identifyGapCategories,
} from '../lib/style-scoring';
import { searchProduct, storeProductMatches } from '../lib/product-search';

const styleShift = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
styleShift.use('*', authMiddleware);

// ── Intensity blend ratios ─────────────────────────────────

type Intensity = 'taste' | 'explore' | 'transform';

/** Ratio of [current, target] in the blend */
const INTENSITY_RATIOS: Record<Intensity, { current: number; target: number }> = {
  taste: { current: 0.8, target: 0.2 },
  explore: { current: 0.6, target: 0.4 },
  transform: { current: 0.3, target: 0.7 },
};

// ── Phase schedule by intensity ────────────────────────────

const PHASE_SCHEDULES: Record<Intensity, Array<{ blend_ratio: { current: number; target: number } }>> = {
  taste: [
    { blend_ratio: { current: 0.9, target: 0.1 } },
    { blend_ratio: { current: 0.85, target: 0.15 } },
    { blend_ratio: { current: 0.8, target: 0.2 } },
  ],
  explore: [
    { blend_ratio: { current: 0.8, target: 0.2 } },
    { blend_ratio: { current: 0.6, target: 0.4 } },
    { blend_ratio: { current: 0.6, target: 0.4 } },
  ],
  transform: [
    { blend_ratio: { current: 0.6, target: 0.4 } },
    { blend_ratio: { current: 0.4, target: 0.6 } },
    { blend_ratio: { current: 0.3, target: 0.7 } },
  ],
};

const PHASE_LABELS = ['Taste', 'Explore', 'Settle'] as const;
const PHASE_WEEKS = ['Weeks 1-4', 'Weeks 5-8', 'Weeks 9-12'] as const;

function buildPhaseSchedule(intensity: Intensity): Array<{
  phase: number;
  label: string;
  weeks: string;
  blend_ratio: { current: number; target: number };
}> {
  return PHASE_SCHEDULES[intensity].map((entry, i) => ({
    phase: i + 1,
    label: PHASE_LABELS[i],
    weeks: PHASE_WEEKS[i],
    blend_ratio: entry.blend_ratio,
  }));
}

// ── Validation Schemas ──────────────────────────────────────

const createShiftSchema = z
  .object({
    target_preset_id: z.string().optional(),
    target_description: z.string().max(500).optional(),
    intensity: z.enum(['taste', 'explore', 'transform']),
    title: z.string().max(200).optional(),
  })
  .refine(
    (data) => data.target_preset_id || data.target_description,
    { message: 'Either target_preset_id or target_description is required' }
  );

const bridgeOutfitsSchema = z.object({
  count: z.number().int().min(1).max(10).default(5),
});

const shoppingListSchema = z.object({
  max_items: z.number().int().min(1).max(10).default(5),
  budget_max: z.number().min(0).optional(),
});

// ── Helpers ─────────────────────────────────────────────────

async function fetchWardrobeItems(
  supabase: SupabaseClient,
  userId: string
): Promise<WardrobeItem[]> {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .neq('status', 'sold');

  if (error) throw new Error(`Failed to fetch wardrobe: ${error.message}`);
  return (data ?? []) as WardrobeItem[];
}

async function fetchStyleProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<StyleProfile | null> {
  const { data } = await supabase
    .from('style_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data as StyleProfile | null;
}

/**
 * Maps a free-text style description to archetype weights using Gemini.
 * Falls back to a generic balanced preset if Gemini is unavailable.
 */
async function mapDescriptionToArchetypes(
  description: string
): Promise<{ archetypes: Record<string, number>; name: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return {
      archetypes: { minimalist: 0.3, classic: 0.3, bohemian: 0.2, romantic: 0.2 },
      name: 'Custom Style',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const prompt = `Given this style description, map it to archetype weights (0-1, sum to 1.0). Available archetypes: minimalist, classic, bohemian, edgy, romantic, maximalist, glamorous, vintage, cozy, athletic.

Description: "${description}"

Respond with ONLY a JSON object (no markdown):
{
  "name": "Short 2-3 word aesthetic name",
  "archetypes": { "archetype_name": weight, ... }
}

Rules:
- Include 3-5 archetypes with non-zero weights
- Weights must sum to 1.0
- Name should be catchy and descriptive (e.g. "Soft Grunge", "Urban Romantic")`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim() ?? '';
    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as { name: string; archetypes: Record<string, number> };
    if (parsed.archetypes && typeof parsed.archetypes === 'object') {
      return parsed;
    }
  } catch {
    // Fall through to default
  }

  return {
    archetypes: { minimalist: 0.3, classic: 0.3, bohemian: 0.2, romantic: 0.2 },
    name: 'Custom Style',
  };
}

// ── GET /style-goals/presets — List aesthetic presets ────────

styleShift.get('/presets', (c) => {
  return c.json({ data: getAllPresets(), error: null });
});

// ── POST /style-goals/shift — Create a style shift goal ────

styleShift.post(
  '/shift',
  zValidator('json', createShiftSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          data: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          },
        },
        400
      );
    }
  }),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    // 1. Resolve target preset
    let targetPreset: ArchetypePreset | undefined;
    let targetArchetypes: Record<string, number>;
    let targetName: string;

    if (body.target_preset_id) {
      targetPreset = getPresetById(body.target_preset_id);
      if (!targetPreset) {
        return c.json(
          { data: null, error: { code: 'INVALID_PRESET', message: `Preset "${body.target_preset_id}" not found` } },
          400
        );
      }
      targetArchetypes = targetPreset.archetypes;
      targetName = targetPreset.name;
    } else {
      // Free-text description — map via Gemini
      const mapped = await mapDescriptionToArchetypes(body.target_description!);
      targetArchetypes = mapped.archetypes;
      targetName = mapped.name;

      // Build a synthetic preset for scoring
      // Find the closest matching real preset to use as signature basis
      const presets = getAllPresets();
      let bestMatch: ArchetypePreset | undefined;
      let bestOverlap = -1;
      for (const preset of presets) {
        let overlap = 0;
        for (const [arch, weight] of Object.entries(targetArchetypes)) {
          overlap += Math.min(weight, preset.archetypes[arch] ?? 0);
        }
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = preset;
        }
      }
      targetPreset = bestMatch ?? presets[0];
    }

    // 2. Fetch current style profile
    const styleProfile = await fetchStyleProfile(supabase, userId);
    const currentArchetypes = styleProfile?.style_archetypes ?? {};

    // 3. Fetch and classify wardrobe
    const items = await fetchWardrobeItems(supabase, userId);

    // Graceful degradation for small wardrobes
    if (items.length === 0) {
      // Still create the goal, but with minimal analysis
      const { data: goal, error: goalError } = await supabase
        .from('style_goals')
        .insert({
          user_id: userId,
          goal_type: 'aesthetic-shift',
          title: body.title ?? `${targetName} Shift`,
          description: `Exploring ${targetName} aesthetic at ${body.intensity} intensity`,
          target_state: {
            target_archetypes: targetArchetypes,
            target_preset_id: body.target_preset_id ?? null,
            target_name: targetName,
            intensity: body.intensity,
            phase_schedule: buildPhaseSchedule(body.intensity),
          },
          current_progress: 0,
          status: 'active',
        })
        .select()
        .single();

      if (goalError) {
        return c.json(
          { data: null, error: { code: 'CREATE_FAILED', message: goalError.message } },
          400
        );
      }

      return c.json({
        data: {
          goal,
          classification: { target_aligned: [], bridge: [], neutral: [], phase_out: [] },
          dimension_deltas: computeDimensionDeltas(currentArchetypes, targetArchetypes),
          phase_schedule: buildPhaseSchedule(body.intensity),
          wardrobe_item_count: 0,
          message: 'Your wardrobe is empty. Add some items to get personalized shift analysis.',
        },
        error: null,
      }, 201);
    }

    const classification = classifyWardrobe(items, targetPreset, currentArchetypes);

    // 4. Compute dimension deltas
    const dimensionDeltas = computeDimensionDeltas(currentArchetypes, targetArchetypes);

    // 5. Create style_goals row
    const { data: goal, error: goalError } = await supabase
      .from('style_goals')
      .insert({
        user_id: userId,
        goal_type: 'aesthetic-shift',
        title: body.title ?? `${targetName} Shift`,
        description: `Exploring ${targetName} aesthetic at ${body.intensity} intensity`,
        target_state: {
          target_archetypes: targetArchetypes,
          target_preset_id: body.target_preset_id ?? null,
          target_name: targetName,
          intensity: body.intensity,
          phase_schedule: buildPhaseSchedule(body.intensity),
          wardrobe_classification_summary: {
            target_aligned: classification.target_aligned.length,
            bridge: classification.bridge.length,
            neutral: classification.neutral.length,
            phase_out: classification.phase_out.length,
          },
        },
        current_progress: 0,
        status: 'active',
      })
      .select()
      .single();

    if (goalError) {
      return c.json(
        { data: null, error: { code: 'CREATE_FAILED', message: goalError.message } },
        400
      );
    }

    // 6. Build response with classified items (limit to top items per bucket)
    const MAX_ITEMS_PER_BUCKET = 20;
    const trimClassification = {
      target_aligned: classification.target_aligned.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
      bridge: classification.bridge.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
      neutral: classification.neutral.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
      phase_out: classification.phase_out.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
    };

    return c.json({
      data: {
        goal,
        classification: trimClassification,
        dimension_deltas: dimensionDeltas,
        phase_schedule: buildPhaseSchedule(body.intensity),
        wardrobe_item_count: items.length,
      },
      error: null,
    }, 201);
  }
);

// ── GET /style-goals/:id/analysis — Full shift analysis ─────

styleShift.get('/:id/analysis', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const goalId = c.req.param('id');

  // Fetch the goal
  const { data: goal, error: goalError } = await supabase
    .from('style_goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single();

  if (goalError || !goal) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Style goal not found' } },
      404
    );
  }

  const targetState = goal.target_state as Record<string, unknown>;
  const targetArchetypes = (targetState.target_archetypes ?? {}) as Record<string, number>;
  const presetId = targetState.target_preset_id as string | null;
  const intensity = (targetState.intensity ?? 'explore') as Intensity;

  // Resolve preset for scoring
  let targetPreset: ArchetypePreset | undefined;
  if (presetId) {
    targetPreset = getPresetById(presetId);
  }

  if (!targetPreset) {
    // Find closest matching preset
    const presets = getAllPresets();
    let bestMatch: ArchetypePreset | undefined;
    let bestOverlap = -1;
    for (const preset of presets) {
      let overlap = 0;
      for (const [arch, weight] of Object.entries(targetArchetypes)) {
        overlap += Math.min(weight, preset.archetypes[arch] ?? 0);
      }
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestMatch = preset;
      }
    }
    targetPreset = bestMatch ?? presets[0];
  }

  // Fetch current profile + wardrobe
  const styleProfile = await fetchStyleProfile(supabase, userId);
  const currentArchetypes = styleProfile?.style_archetypes ?? {};
  const items = await fetchWardrobeItems(supabase, userId);

  const classification = classifyWardrobe(items, targetPreset, currentArchetypes);
  const dimensionDeltas = computeDimensionDeltas(currentArchetypes, targetArchetypes);

  // Compute overall progress: % of wardrobe that aligns with target
  const totalItems = items.length;
  const alignedCount = classification.target_aligned.length + classification.bridge.length;
  const progress = totalItems > 0 ? Math.round((alignedCount / totalItems) * 100) : 0;

  // Update progress in the goal
  if (progress !== goal.current_progress) {
    await supabase
      .from('style_goals')
      .update({ current_progress: progress })
      .eq('id', goalId);
  }

  const MAX_ITEMS_PER_BUCKET = 30;

  return c.json({
    data: {
      goal: { ...goal, current_progress: progress },
      classification: {
        target_aligned: classification.target_aligned.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
        bridge: classification.bridge.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
        neutral: classification.neutral.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
        phase_out: classification.phase_out.slice(0, MAX_ITEMS_PER_BUCKET).map(serializeScoredItem),
      },
      dimension_deltas: dimensionDeltas,
      phase_schedule: buildPhaseSchedule(intensity),
      progress_pct: progress,
      wardrobe_item_count: totalItems,
    },
    error: null,
  });
});

// ── POST /style-goals/:id/bridge-outfits — Generate outfits ─

styleShift.post(
  '/:id/bridge-outfits',
  zValidator('json', bridgeOutfitsSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid request body' } },
        400
      );
    }
  }),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const goalId = c.req.param('id');
    const { count } = c.req.valid('json');

    // Fetch goal
    const { data: goal, error: goalError } = await supabase
      .from('style_goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', userId)
      .single();

    if (goalError || !goal) {
      return c.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Style goal not found' } },
        404
      );
    }

    const targetState = goal.target_state as Record<string, unknown>;
    const targetArchetypes = (targetState.target_archetypes ?? {}) as Record<string, number>;
    const presetId = targetState.target_preset_id as string | null;
    const intensity = (targetState.intensity ?? 'explore') as Intensity;
    const targetName = (targetState.target_name ?? 'Target') as string;

    // Resolve preset
    let targetPreset: ArchetypePreset | undefined;
    if (presetId) {
      targetPreset = getPresetById(presetId);
    }
    if (!targetPreset) {
      const presets = getAllPresets();
      targetPreset = presets.find((p) => {
        let overlap = 0;
        for (const [arch, weight] of Object.entries(targetArchetypes)) {
          overlap += Math.min(weight, p.archetypes[arch] ?? 0);
        }
        return overlap > 0.3;
      }) ?? presets[0];
    }

    // Fetch wardrobe and classify
    const styleProfile = await fetchStyleProfile(supabase, userId);
    const currentArchetypes = styleProfile?.style_archetypes ?? {};
    const items = await fetchWardrobeItems(supabase, userId);

    if (items.length < 3) {
      return c.json({
        data: {
          outfits: [],
          message: 'Add at least 3 items to your wardrobe to generate bridge outfits.',
        },
        error: null,
      });
    }

    const classification = classifyWardrobe(items, targetPreset, currentArchetypes);
    const blendRatio = INTENSITY_RATIOS[intensity];

    // Gather candidate items for outfit generation (target_aligned + bridge items)
    const candidateItems = [
      ...classification.target_aligned.map((s) => s.item),
      ...classification.bridge.map((s) => s.item),
      ...classification.neutral.slice(0, 5).map((s) => s.item),
    ];

    if (candidateItems.length < 2) {
      return c.json({
        data: {
          outfits: [],
          message: 'Not enough items align with the target aesthetic to build outfits yet.',
        },
        error: null,
      });
    }

    // Use Gemini to compose outfits
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      // Fallback: heuristic outfit generation
      const heuristicOutfits = generateHeuristicOutfits(candidateItems, targetPreset, count);
      return c.json({ data: { outfits: heuristicOutfits }, error: null });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const itemList = candidateItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        colors: item.colors,
        material: item.material,
        formality: item.formality_level,
        pattern: item.pattern,
      }));

      const prompt = `You are a fashion stylist creating bridge outfits for someone transitioning to a ${targetName} aesthetic.

Current style blend ratio: ${Math.round(blendRatio.current * 100)}% current / ${Math.round(blendRatio.target * 100)}% target

Available items (from their wardrobe):
${JSON.stringify(itemList, null, 2)}

Target aesthetic signature:
- Colors: ${targetPreset.signature.colors.slice(0, 6).join(', ')}
- Materials: ${targetPreset.signature.materials.slice(0, 4).join(', ')}
- Formality: ${targetPreset.signature.formality_range[0]}-${targetPreset.signature.formality_range[1]}
- Style: ${targetPreset.signature.style_tags.slice(0, 5).join(', ')}

Create ${Math.min(count, 5)} outfits. Each outfit should use 2-5 items from the list.

Respond with ONLY a JSON array (no markdown):
[
  {
    "name": "Outfit name (creative, 3-5 words)",
    "item_ids": ["id1", "id2", ...],
    "styling_note": "1-2 sentence styling tip",
    "target_score": 0.0-1.0,
    "comfort_score": 0.0-1.0
  }
]

Rules:
- Use ONLY item IDs from the provided list
- Each outfit must include at least one top/dress AND one bottom/dress
- Mix target-aligned items with bridge items for a natural transition
- Higher target_score for outfits that lean more toward ${targetName}
- Higher comfort_score for outfits the user would feel safe wearing day-one
- Styling notes should explain HOW to wear the outfit to lean into the target aesthetic`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = response.text?.trim() ?? '';
      let jsonStr = text;
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const rawOutfits = JSON.parse(jsonStr) as Array<{
        name: string;
        item_ids: string[];
        styling_note: string;
        target_score: number;
        comfort_score: number;
      }>;

      // Validate item_ids exist in our candidate pool
      const candidateIdSet = new Set(candidateItems.map((i) => i.id));
      const outfits = rawOutfits
        .filter((o) => o.item_ids.every((id) => candidateIdSet.has(id)))
        .map((o) => ({
          name: o.name,
          item_ids: o.item_ids,
          items: o.item_ids.map((id) => {
            const item = candidateItems.find((i) => i.id === id)!;
            return {
              id: item.id,
              name: item.name,
              category: item.category,
              colors: item.colors,
              image_url: item.image_url,
              image_url_clean: item.image_url_clean,
            };
          }),
          styling_note: o.styling_note,
          target_score: Math.max(0, Math.min(1, o.target_score)),
          comfort_score: Math.max(0, Math.min(1, o.comfort_score)),
        }));

      return c.json({ data: { outfits }, error: null });
    } catch (err) {
      // Fallback to heuristic
      const heuristicOutfits = generateHeuristicOutfits(candidateItems, targetPreset, count);
      return c.json({ data: { outfits: heuristicOutfits }, error: null });
    }
  }
);

// ── POST /style-goals/:id/shopping-list — Gap shopping ──────

styleShift.post(
  '/:id/shopping-list',
  zValidator('json', shoppingListSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid request body' } },
        400
      );
    }
  }),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const goalId = c.req.param('id');
    const { max_items, budget_max } = c.req.valid('json');

    // Fetch goal
    const { data: goal, error: goalError } = await supabase
      .from('style_goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', userId)
      .single();

    if (goalError || !goal) {
      return c.json(
        { data: null, error: { code: 'NOT_FOUND', message: 'Style goal not found' } },
        404
      );
    }

    const targetState = goal.target_state as Record<string, unknown>;
    const presetId = targetState.target_preset_id as string | null;
    const targetArchetypes = (targetState.target_archetypes ?? {}) as Record<string, number>;

    // Resolve preset
    let targetPreset: ArchetypePreset | undefined;
    if (presetId) {
      targetPreset = getPresetById(presetId);
    }
    if (!targetPreset) {
      const presets = getAllPresets();
      targetPreset = presets[0];
      let bestOverlap = -1;
      for (const p of presets) {
        let overlap = 0;
        for (const [arch, weight] of Object.entries(targetArchetypes)) {
          overlap += Math.min(weight, p.archetypes[arch] ?? 0);
        }
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          targetPreset = p;
        }
      }
    }

    // Classify wardrobe to find gaps
    const styleProfile = await fetchStyleProfile(supabase, userId);
    const currentArchetypes = styleProfile?.style_archetypes ?? {};
    const items = await fetchWardrobeItems(supabase, userId);
    const classification = classifyWardrobe(items, targetPreset, currentArchetypes);
    const gaps = identifyGapCategories(classification, targetPreset);

    if (gaps.length === 0) {
      return c.json({
        data: {
          shopping_list: [],
          total_investment: 0,
          message: 'Your wardrobe already covers the key categories for this aesthetic.',
        },
        error: null,
      });
    }

    // Search for products in each gap category
    const searchResults: Array<{
      category: string;
      search_terms: string;
      products: Awaited<ReturnType<typeof searchProduct>>;
    }> = [];

    // Limit concurrent searches
    const gapsToSearch = gaps.slice(0, max_items);
    for (const gap of gapsToSearch) {
      const products = await searchProduct(gap.search_terms);
      if (products.length > 0) {
        searchResults.push({
          category: gap.category,
          search_terms: gap.search_terms,
          products,
        });
      }
    }

    // Flatten and score products
    const bridgeItemCount = classification.bridge.length;
    const targetAlignedCount = classification.target_aligned.length;

    interface ScoredProduct {
      name: string;
      price: number;
      currency: string;
      source_url: string;
      image_url: string;
      retailer: string;
      category: string;
      outfit_unlock_estimate: number;
      happiness_prediction: number;
      leverage_score: number;
    }

    const scoredProducts: ScoredProduct[] = [];

    for (const result of searchResults) {
      for (const product of result.products) {
        // Outfit unlock estimate: each gap product potentially enables
        // pairings with bridge + target items
        const outfitUnlockEstimate = Math.max(1, Math.round(
          (bridgeItemCount * 0.6 + targetAlignedCount * 0.8) * 0.3
        ));

        // Deterministic happiness prediction based on attribute match count
        const matchScore = (product.name.toLowerCase().includes(result.category.toLowerCase()) ? 0.5 : 0) +
          (targetPreset.signature.colors.some(c => product.name.toLowerCase().includes(c)) ? 0.5 : 0) +
          (gaps.length > 3 ? 0.5 : 0);
        const happinessPrediction = Math.round((6 + matchScore) * 10) / 10;

        const price = product.price || 1;
        const leverageScore = Math.round(
          ((outfitUnlockEstimate * happinessPrediction) / price) * 100
        ) / 100;

        if (budget_max !== undefined && price > budget_max) continue;

        scoredProducts.push({
          name: product.name,
          price: product.price,
          currency: product.currency,
          source_url: product.source_url,
          image_url: product.image_url,
          retailer: product.retailer,
          category: result.category,
          outfit_unlock_estimate: outfitUnlockEstimate,
          happiness_prediction: Math.min(10, happinessPrediction),
          leverage_score: leverageScore,
        });
      }
    }

    // Sort by leverage score descending, take top N
    scoredProducts.sort((a, b) => b.leverage_score - a.leverage_score);
    const topProducts = scoredProducts.slice(0, max_items);

    // Store products in external_products
    if (topProducts.length > 0) {
      await storeProductMatches(
        topProducts.map((p) => ({
          name: p.name,
          price: p.price,
          currency: p.currency,
          source_url: p.source_url,
          image_url: p.image_url,
          retailer: p.retailer,
          brand: null,
        })),
        null
      );
    }

    const totalInvestment = topProducts.reduce((sum, p) => sum + p.price, 0);

    return c.json({
      data: {
        shopping_list: topProducts,
        total_investment: Math.round(totalInvestment * 100) / 100,
        gaps_identified: gaps.length,
      },
      error: null,
    });
  }
);

// ── Serialization Helper ────────────────────────────────────

function serializeScoredItem(scored: { item: WardrobeItem; score: number; reason: string }) {
  return {
    item: {
      id: scored.item.id,
      name: scored.item.name,
      category: scored.item.category,
      colors: scored.item.colors,
      material: scored.item.material,
      pattern: scored.item.pattern,
      formality_level: scored.item.formality_level,
      image_url: scored.item.image_url,
      image_url_clean: scored.item.image_url_clean,
      brand: scored.item.brand,
    },
    score: scored.score,
    reason: scored.reason,
  };
}

// ── Heuristic Outfit Generator (Gemini fallback) ────────────

function generateHeuristicOutfits(
  candidateItems: WardrobeItem[],
  targetPreset: ArchetypePreset,
  count: number
): Array<{
  name: string;
  item_ids: string[];
  items: Array<{
    id: string;
    name: string;
    category: string;
    colors: string[];
    image_url: string | null;
    image_url_clean: string | null;
  }>;
  styling_note: string;
  target_score: number;
  comfort_score: number;
}> {
  const tops = candidateItems.filter((i) =>
    ['tops', 'dresses'].includes(i.category)
  );
  const bottoms = candidateItems.filter((i) =>
    ['bottoms', 'dresses'].includes(i.category)
  );
  const layers = candidateItems.filter((i) =>
    ['outerwear', 'accessories', 'shoes', 'jewelry', 'bags'].includes(i.category)
  );

  const outfits: Array<{
    name: string;
    item_ids: string[];
    items: Array<{
      id: string;
      name: string;
      category: string;
      colors: string[];
      image_url: string | null;
      image_url_clean: string | null;
    }>;
    styling_note: string;
    target_score: number;
    comfort_score: number;
  }> = [];

  const used = new Set<string>();

  for (let i = 0; i < Math.min(count, tops.length); i++) {
    const top = tops[i];
    if (used.has(top.id)) continue;

    // Find a complementary bottom (skip if top is a dress)
    let bottom: WardrobeItem | undefined;
    if (top.category !== 'dresses') {
      bottom = bottoms.find((b) => !used.has(b.id) && b.category !== 'dresses');
    }

    // Find an optional layer
    const layer = layers.find((l) => !used.has(l.id));

    const outfitItems: WardrobeItem[] = [top];
    if (bottom) outfitItems.push(bottom);
    if (layer) outfitItems.push(layer);

    const itemIds = outfitItems.map((it) => it.id);
    itemIds.forEach((id) => used.add(id));

    const avgScore = outfitItems.reduce(
      (sum, it) => sum + scoreItemForArchetype(it, targetPreset),
      0
    ) / outfitItems.length;

    outfits.push({
      name: `${targetPreset.name} Look ${i + 1}`,
      item_ids: itemIds,
      items: outfitItems.map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        colors: it.colors,
        image_url: it.image_url,
        image_url_clean: it.image_url_clean,
      })),
      styling_note: `Combine these pieces to channel ${targetPreset.name} vibes with items you already own.`,
      target_score: Math.round(avgScore * 100) / 100,
      comfort_score: 0.7,
    });
  }

  return outfits;
}

export default styleShift;
