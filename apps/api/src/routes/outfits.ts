import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import {
  OCCASION_TYPES,
  MOOD_TAGS,
  ITEM_CATEGORIES,
  PATTERNS,
  MATERIALS,
  SEASONS,
  ITEM_CONDITIONS,
  type ItemAttributes,
  type WeatherContext,
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { getWeather } from '../lib/weather';

const outfits = new Hono<{ Variables: AppVariables }>();
outfits.use('*', authMiddleware);

// ── Validation Schemas ──────────────────────────────────────

const createOutfitSchema = z.object({
  photo_url: z.string().url().nullable().optional(),
  occasion: z.enum(OCCASION_TYPES).nullable().optional(),
  mood_tag: z.enum(MOOD_TAGS).nullable().optional(),
  worn_date: z.string().nullable().optional(), // YYYY-MM-DD
  notes: z.string().max(2000).nullable().optional(),
  happiness_score: z.number().min(0).max(10).nullable().optional(),
  weather_context: z
    .object({
      temperature_f: z.number(),
      feels_like_f: z.number(),
      humidity: z.number(),
      precipitation_chance: z.number(),
      uv_index: z.number(),
      wind_speed_mph: z.number(),
      condition: z.string(),
    })
    .nullable()
    .optional(),
  /** Array of wardrobe_item_ids to link to this outfit */
  item_ids: z.array(z.string().uuid()).optional(),
  /** Array of new items to create in wardrobe and link */
  new_items: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        category: z.enum(ITEM_CATEGORIES),
        subcategory: z.string().max(100).nullable().optional(),
        colors: z.array(z.string().max(50)).default([]),
        pattern: z.enum(PATTERNS).default('solid'),
        material: z.enum(MATERIALS).nullable().optional(),
        brand: z.string().max(200).nullable().optional(),
        formality_level: z.number().int().min(1).max(5).default(3),
        seasons: z.array(z.enum(SEASONS)).default([]),
        condition: z.enum(ITEM_CONDITIONS).default('good'),
        image_url: z.string().url().nullable().optional(),
        image_url_clean: z.string().url().nullable().optional(),
      })
    )
    .optional(),
});

const updateOutfitSchema = z.object({
  mood_tag: z.enum(MOOD_TAGS).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  happiness_score: z.number().min(0).max(10).nullable().optional(),
  occasion: z.enum(OCCASION_TYPES).nullable().optional(),
});

const listOutfitsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const decomposeSchema = z.object({
  image_url: z.string().url(),
});

const weatherSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// ── POST /outfits — Create outfit journal entry ─────────────

outfits.post('/', zValidator('json', createOutfitSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const { item_ids, new_items, ...outfitData } = body;

  // 1. Create the outfit record
  const { data: outfit, error: outfitError } = await supabase
    .from('outfits')
    .insert({
      user_id: userId,
      occasion: outfitData.occasion ?? null,
      weather_context: outfitData.weather_context ?? null,
      source: 'journaled',
      happiness_score: outfitData.happiness_score ?? null,
      mood_tag: outfitData.mood_tag ?? null,
      worn_date: outfitData.worn_date ?? new Date().toISOString().split('T')[0],
      photo_url: outfitData.photo_url ?? null,
      notes: outfitData.notes ?? null,
    })
    .select()
    .single();

  if (outfitError) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: outfitError.message } },
      400
    );
  }

  const outfitId = outfit.id;
  const allLinkedItemIds: string[] = [];

  // 2. Create any new wardrobe items that the user opted to add
  if (new_items && new_items.length > 0) {
    const newItemRecords = new_items.map((item) => ({
      user_id: userId,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory ?? null,
      colors: item.colors,
      pattern: item.pattern,
      material: item.material ?? null,
      brand: item.brand ?? null,
      formality_level: item.formality_level,
      seasons: item.seasons,
      condition: item.condition,
      image_url: item.image_url ?? null,
      image_url_clean: item.image_url_clean ?? null,
      source: 'outfit-journal' as const,
      status: 'active' as const,
    }));

    const { data: createdItems, error: createError } = await supabase
      .from('wardrobe_items')
      .insert(newItemRecords)
      .select('id');

    if (createError) {
      // Non-fatal: outfit was created, but new items failed
      console.error('Failed to create new wardrobe items:', createError.message);
    } else if (createdItems) {
      for (const item of createdItems) {
        allLinkedItemIds.push(item.id);
      }
    }
  }

  // 3. Add existing wardrobe item IDs
  if (item_ids && item_ids.length > 0) {
    for (const id of item_ids) {
      allLinkedItemIds.push(id);
    }
  }

  // 4. Create outfit_items bridge records
  if (allLinkedItemIds.length > 0) {
    const outfitItemRecords = allLinkedItemIds.map((wardrobeItemId, index) => ({
      outfit_id: outfitId,
      wardrobe_item_id: wardrobeItemId,
      layer_position: index,
      is_owned: true,
    }));

    const { error: bridgeError } = await supabase
      .from('outfit_items')
      .insert(outfitItemRecords);

    if (bridgeError) {
      console.error('Failed to create outfit_items:', bridgeError.message);
    }
  }

  // 5. Emit 'wore' preference signals for each item + increment times_worn
  if (allLinkedItemIds.length > 0) {
    const signals = allLinkedItemIds.map((itemId) => ({
      user_id: userId,
      signal_type: 'wore' as const,
      item_id: itemId,
      outfit_id: outfitId,
      value: {
        occasion: outfitData.occasion ?? null,
        mood_tag: outfitData.mood_tag ?? null,
        worn_date: outfitData.worn_date ?? new Date().toISOString().split('T')[0],
      },
      context: outfitData.weather_context
        ? { weather: outfitData.weather_context }
        : null,
    }));

    const { error: signalError } = await supabase
      .from('preference_signals')
      .insert(signals);

    if (signalError) {
      console.error('Failed to emit preference signals:', signalError.message);
    }

    // Increment times_worn for each wardrobe item
    // Supabase JS client doesn't support SET col = col + 1 directly,
    // so we read-then-write per item. Acceptable at journal scale (3-8 items).
    for (const itemId of allLinkedItemIds) {
      const { data: currentItem } = await supabase
        .from('wardrobe_items')
        .select('times_worn')
        .eq('id', itemId)
        .single();

      if (currentItem) {
        await supabase
          .from('wardrobe_items')
          .update({ times_worn: (currentItem.times_worn ?? 0) + 1 })
          .eq('id', itemId);
      }
    }
  }

  // 6. Return the full outfit with items
  const { data: fullOutfit } = await supabase
    .from('outfits')
    .select(
      `
      *,
      outfit_items (
        *,
        wardrobe_item:wardrobe_items (*)
      )
    `
    )
    .eq('id', outfitId)
    .single();

  return c.json({ data: fullOutfit ?? outfit, error: null }, 201);
});

// ── GET /outfits — List outfits with pagination ─────────────

outfits.get('/', zValidator('query', listOutfitsSchema), async (c) => {
  const supabase = c.get('supabase');
  const { cursor, limit } = c.req.valid('query');

  let query = supabase
    .from('outfits')
    .select(
      `
      *,
      outfit_items (
        *,
        wardrobe_item:wardrobe_items (id, name, category, colors, image_url, image_url_clean)
      )
    `
    )
    .order('worn_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
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
});

// ── GET /outfits/weather — Fetch weather for location ────────
// Must be defined BEFORE /:id to avoid "weather" being captured as an ID param

outfits.get('/weather', zValidator('query', weatherSchema), async (c) => {
  const { lat, lon } = c.req.valid('query');

  const weather = await getWeather(lat, lon);

  if (!weather) {
    return c.json(
      {
        data: null,
        error: {
          code: 'WEATHER_UNAVAILABLE',
          message: 'Weather data unavailable. OPENWEATHER_API_KEY may not be configured.',
        },
      },
      503
    );
  }

  return c.json({ data: weather, error: null });
});

// ── GET /outfits/:id — Get single outfit with items ─────────

outfits.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('outfits')
    .select(
      `
      *,
      outfit_items (
        *,
        wardrobe_item:wardrobe_items (*)
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    return c.json(
      {
        data: null,
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'QUERY_FAILED',
          message: error.message,
        },
      },
      status
    );
  }

  return c.json({ data, error: null });
});

// ── PATCH /outfits/:id — Update outfit ──────────────────────

outfits.patch('/:id', zValidator('json', updateOutfitSchema), async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const { data, error } = await supabase
    .from('outfits')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    return c.json(
      {
        data: null,
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'UPDATE_FAILED',
          message: error.message,
        },
      },
      status
    );
  }

  return c.json({ data, error: null });
});

// ── POST /outfits/decompose — AI outfit decomposition ───────

const DECOMPOSITION_PROMPT = `You are a fashion expert analyzing a full-body outfit photograph. Your job is to identify EVERY individual clothing item and accessory visible in the photo.

Respond with ONLY a JSON array (no markdown, no explanation). Each element represents one detected item:

[
  {
    "category": one of: ${ITEM_CATEGORIES.join(', ')},
    "subcategory": string (e.g. "crew neck t-shirt", "slim jeans", "chelsea boots", "crossbody bag"),
    "colors": {
      "dominant": string (fashion color name, e.g. "navy", "cream", "burgundy"),
      "secondary": string[],
      "hex_codes": string[]
    },
    "pattern": one of: ${PATTERNS.join(', ')},
    "material": one of: ${MATERIALS.join(', ')} or null if unclear,
    "brand": string or null (if visible logo/tag),
    "formality_level": integer 1-5 (1=very casual, 5=black tie),
    "seasons": array of: ${SEASONS.join(', ')},
    "condition": one of: ${ITEM_CONDITIONS.join(', ')},
    "style_tags": string[],
    "description": string (brief 5-10 word description of the specific item)
  }
]

Rules:
- Identify ALL visible items: tops, bottoms, shoes, outerwear, bags, jewelry, hats, scarves, belts, sunglasses, watches
- Be smart about layering: if a jacket is open, detect BOTH the jacket AND the shirt/top underneath
- Use lowercase fashion color names (not generic "blue" — prefer "navy", "cobalt", "powder blue")
- Be specific with subcategory (not "top" — prefer "crew neck t-shirt", "button-down shirt", "cable knit sweater")
- description should be unique enough to distinguish this item from similar ones (e.g. "cropped black leather moto jacket" not just "jacket")
- If you can see it, include it. Missing items is worse than extra items.
- Minimum 1 item, typical outfits have 3-8 items`;

const MATCHING_PROMPT_TEMPLATE = (
  detectedItems: Array<{ description: string; category: string; colors: { dominant: string; secondary: string[] } }>,
  wardrobeItems: Array<{ id: string; name: string; category: string; colors: string[]; subcategory: string | null }>
) => `You are matching detected outfit items against a user's existing wardrobe.

DETECTED ITEMS (from outfit photo):
${detectedItems
  .map(
    (item, i) =>
      `${i + 1}. [${item.category}] ${item.description} — colors: ${item.colors.dominant}${item.colors.secondary.length > 0 ? ', ' + item.colors.secondary.join(', ') : ''}`
  )
  .join('\n')}

WARDROBE (user's existing items):
${wardrobeItems
  .map(
    (item) =>
      `- ID: ${item.id} | ${item.name} [${item.category}${item.subcategory ? '/' + item.subcategory : ''}] colors: ${item.colors.join(', ')}`
  )
  .join('\n')}

For each detected item, find the best matching wardrobe item. Respond with ONLY a JSON array:

[
  {
    "detected_index": number (0-based index of the detected item),
    "wardrobe_item_id": string or null (ID of the best matching wardrobe item, or null if no good match),
    "confidence": number 0.0-1.0 (how confident you are in this match)
  }
]

Rules:
- Match based on category, colors, and description similarity
- A good match means the detected item IS the same physical item in the wardrobe
- confidence > 0.8: very likely the same item
- confidence 0.6-0.8: probably the same item
- confidence < 0.6: probably NOT the same item — set wardrobe_item_id to null
- If no wardrobe items match at all, set wardrobe_item_id to null and confidence to 0.0
- Each wardrobe item can only be matched once (pick the best match if multiple detected items could match)`;

outfits.post('/decompose', zValidator('json', decomposeSchema), async (c) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return c.json(
      {
        data: null,
        error: { code: 'CONFIG_ERROR', message: 'GEMINI_API_KEY not configured' },
      },
      500
    );
  }

  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const { image_url } = c.req.valid('json');

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Step 1: Detect items in the outfit photo
  let detectedItems: Array<ItemAttributes & { description: string }>;
  try {
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
            { text: DECOMPOSITION_PROMPT },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('No response from Gemini');
    }

    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    detectedItems = JSON.parse(jsonStr);

    if (!Array.isArray(detectedItems) || detectedItems.length === 0) {
      throw new Error('Gemini returned empty or invalid item array');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to decompose outfit';
    return c.json(
      { data: null, error: { code: 'DECOMPOSE_FAILED', message } },
      502
    );
  }

  // Step 2: Fetch user's wardrobe items for matching
  const { data: wardrobeItems } = await supabase
    .from('wardrobe_items')
    .select('id, name, category, subcategory, colors, image_url, image_url_clean')
    .neq('status', 'archived')
    .limit(500);

  const wardrobe = wardrobeItems ?? [];

  // Step 3: Match detected items against wardrobe via Gemini
  let matches: Array<{
    detected_index: number;
    wardrobe_item_id: string | null;
    confidence: number;
  }> = [];

  if (wardrobe.length > 0) {
    try {
      const matchingPrompt = MATCHING_PROMPT_TEMPLATE(
        detectedItems.map((item) => ({
          description: item.description,
          category: item.category,
          colors: item.colors,
        })),
        wardrobe.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          colors: item.colors ?? [],
          subcategory: item.subcategory,
        }))
      );

      const matchResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: matchingPrompt }] }],
      });

      const matchText = matchResponse.text?.trim();
      if (matchText) {
        let matchJson = matchText;
        if (matchJson.startsWith('```')) {
          matchJson = matchJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        matches = JSON.parse(matchJson);
      }
    } catch (err) {
      // Matching failed — treat all items as unmatched
      console.error('Wardrobe matching failed:', err);
    }
  }

  // Step 4: Build response combining detected items with match info
  const result = detectedItems.map((detected, index) => {
    const matchInfo = matches.find((m) => m.detected_index === index);
    const isMatch = matchInfo && matchInfo.wardrobe_item_id && matchInfo.confidence >= 0.6;

    return {
      detected_item: {
        category: detected.category,
        subcategory: detected.subcategory,
        colors: detected.colors,
        pattern: detected.pattern,
        material: detected.material,
        brand: detected.brand,
        formality_level: detected.formality_level,
        seasons: detected.seasons,
        condition: detected.condition,
        style_tags: detected.style_tags,
        description: detected.description,
      },
      match: isMatch
        ? {
            wardrobe_item_id: matchInfo!.wardrobe_item_id!,
            confidence: matchInfo!.confidence,
            wardrobe_item: wardrobe.find((w) => w.id === matchInfo!.wardrobe_item_id) ?? null,
          }
        : null,
    };
  });

  return c.json({ data: result, error: null });
});

export default outfits;
