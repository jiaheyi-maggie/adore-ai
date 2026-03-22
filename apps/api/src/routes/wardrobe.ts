import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  ITEM_CATEGORIES,
  PATTERNS,
  MATERIALS,
  SEASONS,
  ITEM_CONDITIONS,
  ITEM_STATUSES,
  ITEM_SOURCES,
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';

const wardrobe = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
wardrobe.use('*', authMiddleware);

// ── Validation Schemas ──────────────────────────────────────

const createItemSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(ITEM_CATEGORIES),
  subcategory: z.string().max(100).nullable().optional(),
  colors: z.array(z.string().max(50)).default([]),
  pattern: z.enum(PATTERNS).default('solid'),
  material: z.enum(MATERIALS).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  formality_level: z.number().int().min(1).max(5).default(3),
  seasons: z.array(z.enum(SEASONS)).default([]),
  condition: z.enum(ITEM_CONDITIONS).default('good'),
  purchase_price: z.number().min(0).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  purchase_source: z.string().max(200).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  image_url_clean: z.string().url().nullable().optional(),
  status: z.enum(ITEM_STATUSES).default('active'),
  source: z.enum(ITEM_SOURCES).default('manual'),
  notes: z.string().max(2000).nullable().optional(),
});

const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  subcategory: z.string().max(100).nullable().optional(),
  colors: z.array(z.string().max(50)).optional(),
  pattern: z.enum(PATTERNS).optional(),
  material: z.enum(MATERIALS).nullable().optional(),
  brand: z.string().max(200).nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  formality_level: z.number().int().min(1).max(5).optional(),
  seasons: z.array(z.enum(SEASONS)).optional(),
  condition: z.enum(ITEM_CONDITIONS).optional(),
  purchase_price: z.number().min(0).nullable().optional(),
  purchase_date: z.string().nullable().optional(),
  purchase_source: z.string().max(200).nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  image_url_clean: z.string().url().nullable().optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const listQuerySchema = z.object({
  category: z.enum(ITEM_CATEGORIES).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── POST /wardrobe/items — Create item ──────────────────────

wardrobe.post('/items', zValidator('json', createItemSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const { data, error } = await supabase
    .from('wardrobe_items')
    .insert({
      user_id: userId,
      ...body,
    })
    .select()
    .single();

  if (error) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: error.message } },
      400
    );
  }

  // Emit 'photographed' preference signal if the item has an image
  if (body.image_url || body.image_url_clean) {
    await supabase.from('preference_signals').insert({
      user_id: userId,
      signal_type: 'photographed',
      item_id: data.id,
      value: { source: body.source },
    });
  }

  return c.json({ data, error: null }, 201);
});

// ── GET /wardrobe/items — List items (cursor-based pagination) ─

wardrobe.get('/items', zValidator('query', listQuerySchema), async (c) => {
  const supabase = c.get('supabase');
  const { category, status, cursor, limit } = c.req.valid('query');

  let query = supabase
    .from('wardrobe_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit + 1); // fetch one extra to determine has_more

  if (category) query = query.eq('category', category);
  if (status) query = query.eq('status', status);
  else query = query.neq('status', 'archived'); // exclude archived by default

  if (cursor) {
    // cursor is the created_at of the last item on the previous page
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

// ── GET /wardrobe/items/:id — Get single item ───────────────

wardrobe.get('/items/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('wardrobe_items')
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

// ── PATCH /wardrobe/items/:id — Update item ─────────────────

wardrobe.patch('/items/:id', zValidator('json', updateItemSchema), async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const { data, error } = await supabase
    .from('wardrobe_items')
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

// ── DELETE /wardrobe/items/:id — Soft-delete (archive) ──────

wardrobe.delete('/items/:id', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('wardrobe_items')
    .update({ status: 'archived' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    return c.json(
      { data: null, error: { code: status === 404 ? 'NOT_FOUND' : 'DELETE_FAILED', message: error.message } },
      status
    );
  }

  return c.json({ data, error: null });
});

export default wardrobe;
