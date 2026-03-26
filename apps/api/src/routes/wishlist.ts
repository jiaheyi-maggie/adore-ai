import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import {
  ITEM_CATEGORIES,
  WISHLIST_PRIORITIES,
  type ItemCategory,
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { calculateHappinessScore, countSimilarOwned } from '../lib/happiness';
import { searchProduct, storeProductMatches } from '../lib/product-search';

const wishlist = new Hono<{ Variables: AppVariables }>();
wishlist.use('*', authMiddleware);

// ── Allowed image hosts (SSRF protection) ─────────────────
const ALLOWED_IMAGE_HOSTS = new Set([
  'alisxwjeseyqxiowkalk.supabase.co',
  'localhost',
  '127.0.0.1',
]);

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// ── Validation Schemas ───────────────────────────────────────

const createItemSchema = z.object({
  name: z.string().min(1).max(300),
  image_url: z.string().url().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  category: z.enum(ITEM_CATEGORIES).nullable().optional(),
  priority: z.enum(WISHLIST_PRIORITIES).default('want'),
  status: z.literal('active').default('active'),
  price_alert_threshold: z.number().min(0).nullable().optional(),
  external_product_id: z.string().uuid().nullable().optional(),
});

const updateItemSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  image_url: z.string().url().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  category: z.enum(ITEM_CATEGORIES).nullable().optional(),
  priority: z.enum(WISHLIST_PRIORITIES).optional(),
  status: z
    .enum(['active', 'purchased', 'dismissed'] as const)
    .optional(),
  price_alert_threshold: z.number().min(0).nullable().optional(),
});

const listQuerySchema = z.object({
  status: z
    .enum(['active', 'purchased', 'dismissed'] as const)
    .optional(),
  priority: z.enum(WISHLIST_PRIORITIES).optional(),
  sort: z
    .enum(['happiness', 'priority', 'created_at', 'price'] as const)
    .default('happiness'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const scanSchema = z.object({
  image_url: z.string().url(),
});

const searchSchema = z.object({
  query: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

const checkPurchaseSchema = z.object({
  name: z.string().min(1).max(300),
  price: z.number().min(0).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  category: z.enum(ITEM_CATEGORIES).nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  external_product_id: z.string().uuid().nullable().optional(),
});

const createBudgetSchema = z.object({
  budget_amount: z.number().min(0),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

const updateBudgetSchema = z.object({
  budget_amount: z.number().min(0).optional(),
});

// ── POST /wishlist/items — Create wishlist item ──────────────

wishlist.post('/items', zValidator('json', createItemSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // Auto-detect similar owned items
  const similarCount = await countSimilarOwned(
    supabase,
    userId,
    (body.category as ItemCategory) ?? null,
    body.brand ?? null
  );

  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({
      user_id: userId,
      name: body.name,
      image_url: body.image_url ?? null,
      source_url: body.source_url ?? null,
      price: body.price ?? null,
      brand: body.brand ?? null,
      category: body.category ?? null,
      priority: body.priority,
      status: body.status,
      price_alert_threshold: body.price_alert_threshold ?? null,
      external_product_id: body.external_product_id ?? null,
      similar_owned_count: similarCount,
    })
    .select()
    .single();

  if (error) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: error.message } },
      400
    );
  }

  // Emit 'wishlisted' PreferenceSignal (append-only)
  const { error: signalError } = await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: 'wishlisted',
    value: {
      wishlist_item_id: data.id,
      name: body.name,
      brand: body.brand ?? null,
      category: body.category ?? null,
      price: body.price ?? null,
      priority: body.priority,
      similar_owned_count: similarCount,
    },
  });

  if (signalError) {
    console.error('Failed to emit wishlisted preference signal:', signalError.message);
  }

  return c.json({ data, error: null }, 201);
});

// ── GET /wishlist/items — List wishlist items ────────────────

wishlist.get('/items', zValidator('query', listQuerySchema), async (c) => {
  const supabase = c.get('supabase');
  const { status, priority, sort, cursor, limit } = c.req.valid('query');

  let query = supabase
    .from('wishlist_items')
    .select('*')
    .limit(limit + 1);

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.eq('status', 'active'); // default to active
  }

  if (priority) query = query.eq('priority', priority);

  // Sorting
  switch (sort) {
    case 'happiness':
      query = query.order('happiness_score_prediction', {
        ascending: false,
        nullsFirst: false,
      });
      // Secondary sort for items without scores
      query = query.order('created_at', { ascending: false });
      break;
    case 'priority': {
      // need > want > dream ordering handled by alphabetical coincidence inverted
      // Actually: need=1, want=2, dream=3 — we want need first
      // We'll use created_at as primary and filter by priority in the query param
      query = query.order('created_at', { ascending: false });
      break;
    }
    case 'price':
      query = query.order('price', { ascending: true, nullsFirst: false });
      query = query.order('created_at', { ascending: false });
      break;
    case 'created_at':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

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

// ── GET /wishlist/items/:id — Get single item ────────────────

wishlist.get('/items/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*')
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

// ── PATCH /wishlist/items/:id — Update item ──────────────────

wishlist.patch(
  '/items/:id',
  zValidator('json', updateItemSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    // Destructure out immutable fields (protect against caller sending them)
    const { ...updateData } = body;

    const { data, error } = await supabase
      .from('wishlist_items')
      .update(updateData)
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
  }
);

// ── DELETE /wishlist/items/:id — Remove from wishlist ────────

wishlist.delete('/items/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    return c.json(
      {
        data: null,
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'DELETE_FAILED',
          message: error.message,
        },
      },
      status
    );
  }

  return c.json({ data, error: null });
});

// ── POST /wishlist/items/scan — Extract item from screenshot ─

const SCAN_EXTRACTION_PROMPT = `You are a fashion expert analyzing a screenshot of a product page, Instagram post, or advertisement. Extract the product details from this image.

Respond with ONLY a JSON object (no markdown, no explanation) matching this exact schema:

{
  "name": "string (product name, e.g. 'Wool Blend Blazer')",
  "brand": "string or null (brand name if visible)",
  "price": number or null (price in dollars if visible, just the number),
  "category": one of: ${ITEM_CATEGORIES.join(', ')} or null,
  "colors": string[] (fashion color names, e.g. ["navy", "cream"]),
  "description": "string (brief 1-sentence description of the item)"
}

Rules:
- Extract the actual product name, not a generic category
- If price shows a range, use the lower price
- Use lowercase fashion color names (not generic "blue" — prefer "navy", "cobalt")
- If you can't determine something with confidence, use null
- For category, pick the most specific match from the allowed list
- description should be concise: material + style + notable features`;

wishlist.post('/items/scan', zValidator('json', scanSchema), async (c) => {
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

  const { image_url } = c.req.valid('json');

  // SSRF protection — only allow known image hosts
  if (!isAllowedImageUrl(image_url)) {
    return c.json(
      { data: null, error: { code: 'INVALID_URL', message: 'Image URL must be from a trusted source' } },
      400
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  try {
    // Fetch image and convert to base64
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
            { text: SCAN_EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('No text response from Gemini');
    }

    // Parse JSON — Gemini may wrap in markdown code blocks
    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const extracted = JSON.parse(jsonStr) as {
      name: string;
      brand: string | null;
      price: number | null;
      category: string | null;
      colors: string[];
      description: string;
    };

    // Validate category if present
    if (
      extracted.category &&
      !(ITEM_CATEGORIES as readonly string[]).includes(extracted.category)
    ) {
      extracted.category = null;
    }

    return c.json({ data: extracted, error: null });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to extract product details';
    return c.json(
      { data: null, error: { code: 'SCAN_FAILED', message } },
      502
    );
  }
});

// ── POST /wishlist/search — Search Google Shopping for products ──

wishlist.post('/search', zValidator('json', searchSchema), async (c) => {
  if (!process.env.SERPER_API_KEY) {
    return c.json(
      { data: null, error: { code: 'CONFIG_ERROR', message: 'Product search is not configured' } },
      500,
    );
  }

  const body = c.req.valid('json');
  const query = body.query.trim();
  const start = Date.now();

  // Search via Serper Google Shopping API (gracefully returns [] on failure)
  const results = await searchProduct(query);
  const trimmed = results.slice(0, body.limit);

  // Store results in external_products for stable IDs (best-effort)
  let ids: (string | null)[] = trimmed.map(() => null);
  try {
    ids = await storeProductMatches(trimmed, null);
  } catch (err) {
    console.error('[wishlist-search] Failed to store products:', err instanceof Error ? err.message : err);
  }

  console.log(`[wishlist-search] query="${query}" results=${results.length} stored=${ids.filter(Boolean).length} duration=${Date.now() - start}ms`);

  // Zip IDs onto results
  const enriched = trimmed.map((r, i) => ({
    ...r,
    external_product_id: ids[i] ?? null,
  }));

  return c.json({
    data: { query, results: enriched },
    error: null,
  });
});

// ── POST /wishlist/check — Check a purchase (anti-return) ─────

wishlist.post('/check', zValidator('json', checkPurchaseSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // Auto-detect similar owned items
  const similarCount = await countSimilarOwned(
    supabase,
    userId,
    (body.category as ItemCategory) ?? null,
    body.brand ?? null
  );

  // Insert into wishlist_items with priority 'want' and status 'active'
  const { data: insertedItem, error: insertError } = await supabase
    .from('wishlist_items')
    .insert({
      user_id: userId,
      name: body.name,
      image_url: body.image_url ?? null,
      source_url: body.source_url ?? null,
      price: body.price ?? null,
      brand: body.brand ?? null,
      category: body.category ?? null,
      priority: 'want',
      status: 'active',
      external_product_id: body.external_product_id ?? null,
      similar_owned_count: similarCount,
    })
    .select()
    .single();

  if (insertError || !insertedItem) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: insertError?.message ?? 'Failed to create item' } },
      400
    );
  }

  // Emit 'wishlisted' PreferenceSignal (append-only)
  const { error: signalError } = await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: 'wishlisted',
    value: {
      wishlist_item_id: insertedItem.id,
      name: body.name,
      brand: body.brand ?? null,
      category: body.category ?? null,
      price: body.price ?? null,
      priority: 'want',
      similar_owned_count: similarCount,
    },
  });

  if (signalError) {
    console.error('Failed to emit wishlisted preference signal:', signalError.message);
  }

  // Calculate happiness score (cleanup item on failure)
  let score;
  try {
    score = await calculateHappinessScore(supabase, userId, insertedItem);
  } catch (err) {
    // Clean up the orphaned item so retries don't create duplicates
    await supabase.from('wishlist_items').delete().eq('id', insertedItem.id);
    const message = err instanceof Error ? err.message : 'Failed to analyze purchase';
    console.error('[wishlist-check] Score calculation failed:', message);
    return c.json(
      { data: null, error: { code: 'SCORE_FAILED', message } },
      502,
    );
  }

  // Persist happiness_score_prediction and versatility_impact back to the item
  await supabase
    .from('wishlist_items')
    .update({
      happiness_score_prediction: score.overall,
      versatility_impact: score.breakdown.versatility_score,
    })
    .eq('id', insertedItem.id);

  // If external_product_id provided, fetch affiliate_url from external_products
  let affiliateUrl: string | null = null;
  if (body.external_product_id) {
    const { data: product } = await supabase
      .from('external_products')
      .select('affiliate_url')
      .eq('id', body.external_product_id)
      .single();

    affiliateUrl = product?.affiliate_url ?? null;
  }

  return c.json({
    data: {
      score,
      item: {
        ...insertedItem,
        happiness_score_prediction: score.overall,
        versatility_impact: score.breakdown.versatility_score,
      },
      affiliate_url: affiliateUrl,
    },
    error: null,
  });
});

// ── POST /wishlist/items/:id/happiness — Calculate score ─────

wishlist.post('/items/:id/happiness', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const id = c.req.param('id');

  // Fetch the wishlist item
  const { data: item, error: fetchError } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Wishlist item not found' } },
      404
    );
  }

  // Calculate happiness score
  const score = await calculateHappinessScore(supabase, userId, item);

  // Persist the overall score and versatility back to the wishlist item
  await supabase
    .from('wishlist_items')
    .update({
      happiness_score_prediction: score.overall,
      versatility_impact: score.breakdown.versatility_score,
    })
    .eq('id', id);

  return c.json({ data: score, error: null });
});

// ── POST /wishlist/items/:id/dismiss — Dismiss item ──────────

wishlist.post('/items/:id/dismiss', async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const id = c.req.param('id');

  // Fetch current item to get happiness data for signal
  const { data: item, error: fetchError } = await supabase
    .from('wishlist_items')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Wishlist item not found' } },
      404
    );
  }

  // Update status
  const { data, error } = await supabase
    .from('wishlist_items')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return c.json(
      { data: null, error: { code: 'UPDATE_FAILED', message: error.message } },
      400
    );
  }

  // Emit 'skipped' PreferenceSignal
  const { error: skipSignalError } = await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: 'skipped',
    value: {
      wishlist_item_id: id,
      name: item.name,
      category: item.category,
      price: item.price,
      happiness_score_prediction: item.happiness_score_prediction,
      similar_owned_count: item.similar_owned_count,
    },
  });

  if (skipSignalError) {
    console.error('Failed to emit skipped preference signal:', skipSignalError.message);
  }

  return c.json({ data, error: null });
});

// ── Budget Endpoints ─────────────────────────────────────────

// POST /wishlist/budget/periods — Create budget period
wishlist.post(
  '/budget/periods',
  zValidator('json', createBudgetSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const { data, error } = await supabase
      .from('budget_periods')
      .insert({
        user_id: userId,
        period_start: body.period_start,
        period_end: body.period_end,
        budget_amount: body.budget_amount,
      })
      .select()
      .single();

    if (error) {
      return c.json(
        { data: null, error: { code: 'INSERT_FAILED', message: error.message } },
        400
      );
    }

    return c.json({ data, error: null }, 201);
  }
);

// GET /wishlist/budget/current — Get current budget period
wishlist.get('/budget/current', async (c) => {
  const supabase = c.get('supabase');

  const today = new Date().toISOString().split('T')[0];

  const { data: period, error } = await supabase
    .from('budget_periods')
    .select('*')
    .lte('period_start', today)
    .gte('period_end', today)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  if (error || !period) {
    return c.json({
      data: null,
      error: null, // no budget set is not an error
    });
  }

  // Calculate actual spent from purchases
  const periodStart = period.period_start;
  const periodEnd = period.period_end;

  const { data: purchases } = await supabase
    .from('purchases')
    .select('total_amount')
    .gte('purchase_date', periodStart)
    .lte('purchase_date', periodEnd)
    .in('status', ['ordered', 'delivered']);

  const spentAmount = (purchases ?? []).reduce(
    (sum, p) => sum + Number(p.total_amount),
    0
  );

  const budgetAmount = Number(period.budget_amount);
  const remaining = budgetAmount - spentAmount;

  return c.json({
    data: {
      ...period,
      spent_amount: spentAmount,
      remaining_amount: remaining,
      budget_amount: budgetAmount,
      utilization_pct: budgetAmount > 0 ? Math.round((spentAmount / budgetAmount) * 100) : 0,
    },
    error: null,
  });
});

// PATCH /wishlist/budget/periods/:id — Update budget
wishlist.patch(
  '/budget/periods/:id',
  zValidator('json', updateBudgetSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const { data, error } = await supabase
      .from('budget_periods')
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
  }
);

export default wishlist;
