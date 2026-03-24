// ═══════════════════════════════════════════════════════════
// Style Modes — Per-Context Style Profiles
// Returns archetype distributions per occasion (work, casual, etc.)
// ═══════════════════════════════════════════════════════════

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { WardrobeItem } from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { scoreItemForArchetype, BASE_ARCHETYPES, buildSyntheticPresetFromBase } from '../lib/style-scoring';

const styleModes = new Hono<{ Variables: AppVariables }>();
styleModes.use('*', authMiddleware);

// ── Compute archetype distribution for a set of items ─────────

function computeArchetypeDistribution(
  items: WardrobeItem[],
): Record<string, number> {
  if (items.length === 0) return {};

  const scoreSums: Record<string, number> = {};
  for (const archetypeName of BASE_ARCHETYPES) {
    const preset = buildSyntheticPresetFromBase(archetypeName);
    if (!preset) continue;

    let total = 0;
    for (const item of items) {
      total += scoreItemForArchetype(item, preset);
    }
    scoreSums[archetypeName] = total;
  }

  const grandTotal = Object.values(scoreSums).reduce((s, v) => s + v, 0);
  const distribution: Record<string, number> = {};
  if (grandTotal > 0) {
    for (const [name, score] of Object.entries(scoreSums)) {
      const normalized = Math.round((score / grandTotal) * 100) / 100;
      if (normalized >= 0.03) { // filter noise
        distribution[name] = normalized;
      }
    }
  }

  return distribution;
}

// ── GET /auth/profile/style-modes ─────────────────────────────

styleModes.get('/profile/style-modes', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');

  // 1. Fetch style profile for stored context_archetypes
  const { data: styleProfile } = await supabase
    .from('style_profiles')
    .select('context_archetypes')
    .eq('user_id', userId)
    .single();

  const storedModes = (styleProfile?.context_archetypes ?? {}) as Record<
    string,
    Record<string, number>
  >;

  // If we have stored modes, return them directly
  if (Object.keys(storedModes).length > 0) {
    return c.json({
      data: {
        modes: storedModes,
        source: 'stored' as const,
      },
      error: null,
    });
  }

  // 2. Otherwise, compute from outfit journal data
  const { data: outfits, error: outfitError } = await supabase
    .from('outfits')
    .select(`
      id,
      occasion,
      outfit_items(
        wardrobe_item_id
      )
    `)
    .eq('user_id', userId)
    .not('occasion', 'is', null)
    .limit(200);

  if (outfitError) {
    return c.json(
      { data: null, error: { code: 'QUERY_FAILED', message: outfitError.message } },
      400,
    );
  }

  if (!outfits || outfits.length === 0) {
    return c.json({
      data: {
        modes: {},
        source: 'empty' as const,
      },
      error: null,
    });
  }

  // 3. Collect wardrobe item IDs per occasion
  const occasionItemIds: Record<string, Set<string>> = {};
  for (const outfit of outfits) {
    const occasion = (outfit as any).occasion as string | null;
    if (!occasion) continue;

    if (!occasionItemIds[occasion]) {
      occasionItemIds[occasion] = new Set();
    }
    const outfitItems = (outfit as any).outfit_items as Array<{ wardrobe_item_id: string | null }> | null;
    if (outfitItems) {
      for (const oi of outfitItems) {
        if (oi.wardrobe_item_id) {
          occasionItemIds[occasion].add(oi.wardrobe_item_id);
        }
      }
    }
  }

  // 4. Fetch all referenced wardrobe items
  const allItemIds = new Set<string>();
  for (const ids of Object.values(occasionItemIds)) {
    for (const id of ids) allItemIds.add(id);
  }

  if (allItemIds.size === 0) {
    return c.json({
      data: { modes: {}, source: 'empty' as const },
      error: null,
    });
  }

  const { data: wardrobeItems } = await supabase
    .from('wardrobe_items')
    .select('*')
    .in('id', [...allItemIds]);

  const itemMap = new Map<string, WardrobeItem>();
  if (wardrobeItems) {
    for (const item of wardrobeItems as WardrobeItem[]) {
      itemMap.set(item.id, item);
    }
  }

  // 5. Compute archetype distribution per occasion
  const computedModes: Record<string, Record<string, number>> = {};

  for (const [occasion, itemIds] of Object.entries(occasionItemIds)) {
    const items: WardrobeItem[] = [];
    for (const id of itemIds) {
      const item = itemMap.get(id);
      if (item) items.push(item);
    }
    if (items.length >= 2) { // Need at least 2 items for meaningful distribution
      computedModes[occasion] = computeArchetypeDistribution(items);
    }
  }

  // 6. Store computed modes for future use (best-effort)
  if (Object.keys(computedModes).length > 0) {
    const { error: cacheError } = await supabase
      .from('style_profiles')
      .update({ context_archetypes: computedModes })
      .eq('user_id', userId);
    if (cacheError) {
      console.warn('[style-modes] Failed to cache computed modes:', cacheError.message);
    }
  }

  return c.json({
    data: {
      modes: computedModes,
      source: 'computed' as const,
    },
    error: null,
  });
});

// ── PUT /auth/profile/style-modes — Update context archetypes manually ──

const updateModesSchema = z.object({
  modes: z.record(
    z.string(),
    z.record(z.string(), z.number()),
  ),
});

styleModes.put(
  '/profile/style-modes',
  zValidator('json', updateModesSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { data: null, error: { code: 'VALIDATION_FAILED', message: 'Invalid modes data' } },
        400,
      );
    }
  }),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { modes } = c.req.valid('json');

    const { error } = await supabase
      .from('style_profiles')
      .update({ context_archetypes: modes })
      .eq('user_id', userId);

    if (error) {
      return c.json(
        { data: null, error: { code: 'UPDATE_FAILED', message: error.message } },
        400,
      );
    }

    return c.json({ data: { updated: true }, error: null });
  },
);

export default styleModes;
