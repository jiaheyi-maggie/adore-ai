import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import {
  LISTING_STATUSES,
  LISTING_PLATFORMS,
  ITEM_CONDITIONS,
  SEASONS,
  type PriceSuggestion,
  type PriceFactor,
  type ItemCondition,
  type Season,
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';

const marketplace = new Hono<{ Variables: AppVariables }>();
marketplace.use('*', authMiddleware);

// ── Validation Schemas ──────────────────────────────────────

const createListingSchema = z.object({
  wardrobe_item_id: z.string().uuid(),
  platform: z.enum(LISTING_PLATFORMS),
  status: z.enum(LISTING_STATUSES).default('active'),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).default(''),
  suggested_price: z.number().min(0).nullable().optional(),
  listed_price: z.number().min(0).nullable().optional(),
  price_suggestion: z.any().nullable().optional(),
  external_listing_id: z.string().max(500).nullable().optional(),
  external_listing_url: z.string().url().nullable().optional(),
  listed_at: z.string().nullable().optional(),
});

const updateListingSchema = z.object({
  platform: z.enum(LISTING_PLATFORMS).optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  listed_price: z.number().min(0).nullable().optional(),
  external_listing_id: z.string().max(500).nullable().optional(),
  external_listing_url: z.string().url().nullable().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(LISTING_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const markSoldSchema = z.object({
  sold_price: z.number().min(0),
});

const priceSuggestSchema = z.object({
  wardrobe_item_id: z.string().uuid(),
});

const generateListingSchema = z.object({
  wardrobe_item_id: z.string().uuid(),
  platform: z.enum(LISTING_PLATFORMS),
  notes: z.string().max(1000).optional(),
});

// ── Price Suggestion Algorithm ──────────────────────────────

const CONDITION_MULTIPLIERS: Record<ItemCondition, number> = {
  'new': 0.9,
  'like-new': 0.75,
  'good': 0.55,
  'fair': 0.35,
  'worn': 0.2,
};

function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function getUpcomingSeason(): Season {
  const current = getCurrentSeason();
  const order: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % 4];
}

function computePriceSuggestion(item: {
  purchase_price: number | null;
  condition: string;
  purchase_date: string | null;
  seasons: string[];
  brand: string | null;
}): PriceSuggestion {
  const factors: PriceFactor[] = [];
  let dataPoints = 0;
  let totalDataPoints = 4; // purchase_price, condition, age, season

  // 1. Anchor on purchase price
  let basePrice: number;
  if (item.purchase_price != null && item.purchase_price > 0) {
    basePrice = item.purchase_price;
    dataPoints++;
    factors.push({
      name: 'purchase_price_anchor',
      description: `Anchored on original purchase price of $${item.purchase_price.toFixed(2)}`,
      impact: 1.0,
      applied: true,
    });
  } else {
    // No purchase price: estimate based on a conservative default
    basePrice = 30; // conservative default
    factors.push({
      name: 'purchase_price_anchor',
      description: 'No purchase price available, using conservative estimate of $30',
      impact: 1.0,
      applied: false,
    });
  }

  // 2. Condition depreciation
  const condition = item.condition as ItemCondition;
  const conditionMultiplier = CONDITION_MULTIPLIERS[condition] ?? 0.55;
  let price = basePrice * conditionMultiplier;
  dataPoints++;
  factors.push({
    name: 'condition_depreciation',
    description: `${condition} condition: ${Math.round(conditionMultiplier * 100)}% of base price`,
    impact: conditionMultiplier,
    applied: true,
  });

  // 3. Age decay: -5% per year
  if (item.purchase_date) {
    const purchaseDate = new Date(item.purchase_date);
    const now = new Date();
    const yearsOwned = (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const ageMultiplier = Math.max(0.5, 1 - 0.05 * yearsOwned); // floor at 50%
    price *= ageMultiplier;
    dataPoints++;
    factors.push({
      name: 'age_decay',
      description: `Owned for ${yearsOwned.toFixed(1)} years: ${Math.round(ageMultiplier * 100)}% retention`,
      impact: ageMultiplier,
      applied: true,
    });
  } else {
    factors.push({
      name: 'age_decay',
      description: 'No purchase date available, age decay not applied',
      impact: 1.0,
      applied: false,
    });
  }

  // 4. Seasonal boost: +10% if item matches current or upcoming season
  const currentSeason = getCurrentSeason();
  const upcomingSeason = getUpcomingSeason();
  const itemSeasons = (item.seasons ?? []) as Season[];
  const isSeasonalMatch = itemSeasons.includes(currentSeason) || itemSeasons.includes(upcomingSeason);

  if (isSeasonalMatch && itemSeasons.length > 0) {
    price *= 1.1;
    dataPoints++;
    factors.push({
      name: 'seasonal_boost',
      description: `In season (${currentSeason}/${upcomingSeason}): +10% boost`,
      impact: 1.1,
      applied: true,
    });
  } else {
    factors.push({
      name: 'seasonal_boost',
      description: itemSeasons.length === 0
        ? 'No season data available'
        : `Not in season (current: ${currentSeason}), no boost applied`,
      impact: 1.0,
      applied: itemSeasons.length > 0,
    });
  }

  // Round to nearest dollar
  const suggestedPrice = Math.max(5, Math.round(price));
  const confidence = dataPoints / totalDataPoints;

  return {
    suggested_price: suggestedPrice,
    confidence,
    factors,
    anchor_price: item.purchase_price,
  };
}

// ── Listing Generator Prompts ────────────────────────────────

function getListingPrompt(
  platform: string,
  item: Record<string, unknown>,
  notes?: string
): string {
  const platformTone: Record<string, string> = {
    depop: 'casual, trendy, use emojis sparingly, appeal to Gen Z, keep it short and punchy',
    poshmark: 'detailed and descriptive, mention measurements/sizing, professional but friendly, highlight brand value',
    ebay: 'structured and thorough, use keywords for search, mention condition clearly, factual tone',
    mercari: 'friendly and concise, good value emphasis, clear condition description',
    other: 'clear, descriptive, and appealing',
  };

  const tone = platformTone[platform] || platformTone.other;

  return `You are a resale listing copywriter. Generate a compelling listing title and description for selling this clothing item on ${platform}.

**Tone guidelines for ${platform}:** ${tone}

**Item details:**
${JSON.stringify(item, null, 2)}

${notes ? `**Seller notes:** ${notes}` : ''}

Respond with ONLY a JSON object (no markdown, no explanation) matching this schema:
{
  "title": "string (max 80 chars, optimized for ${platform} search)",
  "description": "string (compelling description with relevant details, 100-300 words)"
}

Rules:
- Title should include brand (if known), key attributes, and size
- Description should highlight condition, material, styling suggestions
- Match the expected tone for ${platform}
- Include relevant keywords buyers search for
- Never fabricate details not present in the item data`;
}

// ── POST /marketplace/listings — Create listing ─────────────

marketplace.post('/listings', zValidator('json', createListingSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // Verify the wardrobe item belongs to this user and exists
  const { data: item, error: itemError } = await supabase
    .from('wardrobe_items')
    .select('id, status')
    .eq('id', body.wardrobe_item_id)
    .single();

  if (itemError || !item) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Wardrobe item not found' } },
      404
    );
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      user_id: userId,
      ...body,
      listed_at: body.status === 'active' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: error.message } },
      400
    );
  }

  // Transition wardrobe item to 'listed' if creating an active listing
  if (body.status === 'active') {
    await supabase
      .from('wardrobe_items')
      .update({ status: 'listed' })
      .eq('id', body.wardrobe_item_id);
  }

  return c.json({ data, error: null }, 201);
});

// ── GET /marketplace/listings — List user's listings ─────────

marketplace.get('/listings', zValidator('query', listQuerySchema), async (c) => {
  const supabase = c.get('supabase');
  const { status, cursor, limit } = c.req.valid('query');

  let query = supabase
    .from('marketplace_listings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq('status', status);
  if (cursor) query = query.lt('created_at', cursor);

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

// ── GET /marketplace/listings/:id — Get single listing ──────

marketplace.get('/listings/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    return c.json(
      { data: null, error: { code: status === 404 ? 'NOT_FOUND' : 'QUERY_FAILED', message: error.message } },
      status
    );
  }

  return c.json({ data, error: null });
});

// ── PATCH /marketplace/listings/:id — Update listing ─────────

marketplace.patch('/listings/:id', zValidator('json', updateListingSchema), async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const { data, error } = await supabase
    .from('marketplace_listings')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    return c.json(
      { data: null, error: { code: status === 404 ? 'NOT_FOUND' : 'UPDATE_FAILED', message: error.message } },
      status
    );
  }

  return c.json({ data, error: null });
});

// ── POST /marketplace/listings/:id/mark-sold — Mark as sold ──

marketplace.post('/listings/:id/mark-sold', zValidator('json', markSoldSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { sold_price } = c.req.valid('json');

  // Get the listing first
  const { data: listing, error: fetchError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !listing) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Listing not found' } },
      404
    );
  }

  if (listing.status === 'sold') {
    return c.json(
      { data: null, error: { code: 'ALREADY_SOLD', message: 'Listing is already marked as sold' } },
      400
    );
  }

  // Update listing to sold
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('marketplace_listings')
    .update({
      status: 'sold',
      sold_price,
      sold_at: now,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json(
      { data: null, error: { code: 'UPDATE_FAILED', message: error.message } },
      400
    );
  }

  // Transition wardrobe item status to 'sold'
  await supabase
    .from('wardrobe_items')
    .update({ status: 'sold' })
    .eq('id', listing.wardrobe_item_id);

  // Emit 'sold' PreferenceSignal (append-only)
  await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: 'sold',
    item_id: listing.wardrobe_item_id,
    value: {
      sold_price,
      platform: listing.platform,
      listing_id: listing.id,
      listed_price: listing.listed_price,
      suggested_price: listing.suggested_price,
      days_listed: listing.listed_at
        ? Math.ceil((new Date(now).getTime() - new Date(listing.listed_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    },
  });

  return c.json({ data, error: null });
});

// ── DELETE /marketplace/listings/:id — Cancel listing ─────────

marketplace.delete('/listings/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  // Get listing to find the wardrobe item
  const { data: listing, error: fetchError } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !listing) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Listing not found' } },
      404
    );
  }

  if (listing.status === 'sold') {
    return c.json(
      { data: null, error: { code: 'CANNOT_CANCEL', message: 'Cannot cancel a sold listing' } },
      400
    );
  }

  // Update listing to cancelled
  const { data, error } = await supabase
    .from('marketplace_listings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json(
      { data: null, error: { code: 'UPDATE_FAILED', message: error.message } },
      400
    );
  }

  // Revert wardrobe item back to 'active'
  await supabase
    .from('wardrobe_items')
    .update({ status: 'active' })
    .eq('id', listing.wardrobe_item_id);

  return c.json({ data, error: null });
});

// ── POST /marketplace/price-suggest — Heuristic price suggestion ─

marketplace.post('/price-suggest', zValidator('json', priceSuggestSchema), async (c) => {
  const supabase = c.get('supabase');
  const { wardrobe_item_id } = c.req.valid('json');

  const { data: item, error } = await supabase
    .from('wardrobe_items')
    .select('purchase_price, condition, purchase_date, seasons, brand')
    .eq('id', wardrobe_item_id)
    .single();

  if (error || !item) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Wardrobe item not found' } },
      404
    );
  }

  const suggestion = computePriceSuggestion(item as {
    purchase_price: number | null;
    condition: string;
    purchase_date: string | null;
    seasons: string[];
    brand: string | null;
  });

  return c.json({ data: suggestion, error: null });
});

// ── POST /marketplace/generate-listing — AI listing generation ─

marketplace.post('/generate-listing', zValidator('json', generateListingSchema), async (c) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return c.json(
      { data: null, error: { code: 'CONFIG_ERROR', message: 'GEMINI_API_KEY not configured' } },
      500
    );
  }

  const supabase = c.get('supabase');
  const { wardrobe_item_id, platform, notes } = c.req.valid('json');

  // Fetch full item data for listing generation
  const { data: item, error: itemError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('id', wardrobe_item_id)
    .single();

  if (itemError || !item) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Wardrobe item not found' } },
      404
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  try {
    // Build relevant item attributes for the prompt (strip internal fields)
    const itemForPrompt = {
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      colors: item.colors,
      pattern: item.pattern,
      material: item.material,
      brand: item.brand,
      size: item.size,
      condition: item.condition,
      seasons: item.seasons,
      purchase_price: item.purchase_price,
    };

    const prompt = getListingPrompt(platform, itemForPrompt, notes);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('No response from Gemini');
    }

    // Parse JSON — Gemini may wrap in markdown code blocks
    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(jsonStr) as { title: string; description: string };

    if (!result.title || !result.description) {
      throw new Error('Invalid response structure from Gemini');
    }

    return c.json({
      data: {
        title: result.title,
        description: result.description,
        platform,
      },
      error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate listing';
    return c.json(
      { data: null, error: { code: 'GENERATION_FAILED', message } },
      502
    );
  }
});

export default marketplace;
