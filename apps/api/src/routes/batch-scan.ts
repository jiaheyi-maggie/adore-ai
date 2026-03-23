import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import {
  ITEM_CATEGORIES,
  PATTERNS,
  MATERIALS,
  SEASONS,
  ITEM_CONDITIONS,
  type ItemAttributes,
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import {
  buildSearchQuery,
  searchProductWithDeadline,
  type ProductSearchResult,
} from '../lib/product-search';

const batchScan = new Hono<{ Variables: AppVariables }>();
batchScan.use('*', authMiddleware);

// ── SSRF protection (same pattern as outfits.ts) ───────────
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

// ── Image fetch with timeout + size limit ───────────────────
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 15_000; // 15s (batch photos can be larger)

async function fetchImageSafe(url: string): Promise<{ base64: string; mimeType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${contentLength} bytes (max ${MAX_IMAGE_SIZE})`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${buffer.byteLength} bytes`);
    }

    return {
      base64: Buffer.from(buffer).toString('base64'),
      mimeType: response.headers.get('content-type') || 'image/jpeg',
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Zod schemas ─────────────────────────────────────────────

const batchScanSchema = z.object({
  image_url: z.string().url(),
});

const batchDetectionSchema = z.object({
  box_2d: z.array(z.number()).length(4),
  category: z.enum(ITEM_CATEGORIES).catch('accessories'),
  subcategory: z.string().nullable().optional().default(null),
  colors: z.object({
    dominant: z.string(),
    secondary: z.array(z.string()).default([]),
    hex_codes: z.array(z.string()).default([]),
  }),
  pattern: z.enum(PATTERNS).catch('solid'),
  material: z.enum(MATERIALS).nullable().catch(null),
  brand: z.string().nullable().optional().default(null),
  formality_level: z.number().int().min(1).max(5).default(3),
  seasons: z.array(z.enum(SEASONS)).catch([]),
  condition: z.enum(ITEM_CONDITIONS).catch('good'),
  style_tags: z.array(z.string()).default([]),
  name: z.string().default('Clothing item'),
});

const batchConfirmSchema = z.object({
  scan_id: z.string().uuid(),
  items: z.array(
    z.object({
      detection_id: z.string().uuid(),
      confirmed: z.boolean(),
      attributes_override: z
        .object({
          category: z.enum(ITEM_CATEGORIES).optional(),
          subcategory: z.string().max(100).nullable().optional(),
          colors: z
            .object({
              dominant: z.string(),
              secondary: z.array(z.string()).default([]),
              hex_codes: z.array(z.string()).default([]),
            })
            .optional(),
          pattern: z.enum(PATTERNS).optional(),
          material: z.enum(MATERIALS).nullable().optional(),
          brand: z.string().max(200).nullable().optional(),
          formality_level: z.number().int().min(1).max(5).optional(),
          seasons: z.array(z.enum(SEASONS)).optional(),
          condition: z.enum(ITEM_CONDITIONS).optional(),
          style_tags: z.array(z.string()).optional(),
        })
        .optional(),
      name: z.string().min(1).max(200).optional(),
    })
  ),
});

// ── Batch scan prompt ───────────────────────────────────────

const BATCH_SCAN_PROMPT = `You are analyzing an overhead photograph of multiple clothing items laid flat on a surface.
Detect EVERY individual clothing item visible in the image.

For each item, return a JSON object with:
- "box_2d": [y_min, x_min, y_max, x_max] normalized to 0-1000 (Gemini's bounding box format)
- "category": one of: ${ITEM_CATEGORIES.join(', ')}
- "subcategory": specific type (e.g. "crew neck t-shirt", "slim jeans", "chelsea boots")
- "colors": { "dominant": string, "secondary": string[], "hex_codes": string[] }
- "pattern": one of: ${PATTERNS.join(', ')}
- "material": one of: ${MATERIALS.join(', ')} or null if unclear
- "brand": string or null
- "formality_level": 1-5
- "seasons": array of spring/summer/fall/winter
- "condition": one of: ${ITEM_CONDITIONS.join(', ')}
- "style_tags": string[]
- "name": brief descriptive name (e.g. "Navy Cotton Crew Neck T-Shirt")

Rules:
- Detect ALL items, even partially visible ones
- Items should NOT overlap significantly in their bounding boxes
- Use fashion-specific color names (navy, cream, burgundy, not just "blue")
- Be specific with subcategory
- Return a JSON array. No markdown, no explanation.`;

// ── POST /wardrobe/items/batch-scan ─────────────────────────

batchScan.post('/items/batch-scan', zValidator('json', batchScanSchema), async (c) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return c.json(
      { data: null, error: { code: 'CONFIG_ERROR', message: 'GEMINI_API_KEY not configured' } },
      500
    );
  }

  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const { image_url } = c.req.valid('json');

  // SSRF protection
  if (!isAllowedImageUrl(image_url)) {
    return c.json(
      { data: null, error: { code: 'INVALID_URL', message: 'Image URL must be from a trusted source' } },
      400
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Step 1: Fetch image and send to Gemini
  let detectedItems: Array<z.infer<typeof batchDetectionSchema>>;
  try {
    const { base64, mimeType } = await fetchImageSafe(image_url);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: BATCH_SCAN_PROMPT },
          ],
        },
      ],
    });

    const text = response.text?.trim();
    if (!text) throw new Error('No response from Gemini');

    // Strip markdown code blocks if present
    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Gemini returned empty or invalid item array');
    }

    // Validate each detected item with Zod
    detectedItems = parsed.map((item: unknown, index: number) => {
      const validated = batchDetectionSchema.safeParse(item);
      if (!validated.success) {
        console.error(`Detection ${index} validation failed:`, validated.error.issues);
        // Fallback with safe defaults
        const raw = item as Record<string, unknown>;
        return {
          box_2d: Array.isArray(raw.box_2d) ? (raw.box_2d as number[]).slice(0, 4) : [0, 0, 500, 500],
          category: 'accessories',
          subcategory: null,
          colors: { dominant: 'unknown', secondary: [], hex_codes: [] },
          pattern: 'solid',
          material: null,
          brand: null,
          formality_level: 3,
          seasons: ['spring', 'summer', 'fall', 'winter'],
          condition: 'good',
          style_tags: [],
          name: `Item ${index + 1}`,
        } as z.infer<typeof batchDetectionSchema>;
      }
      return validated.data;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to analyze batch photo';
    return c.json(
      { data: null, error: { code: 'SCAN_FAILED', message } },
      502
    );
  }

  // Step 2: Create wardrobe_scans record
  const { data: scan, error: scanError } = await supabase
    .from('wardrobe_scans')
    .insert({
      user_id: userId,
      method: 'batch-photo',
      status: 'review',
      source_media_url: image_url,
      items_detected: detectedItems.length,
      processing_completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (scanError || !scan) {
    return c.json(
      { data: null, error: { code: 'DB_ERROR', message: scanError?.message ?? 'Failed to create scan record' } },
      500
    );
  }

  // Step 3: Create scan_detections records
  const detectionRecords = detectedItems.map((item) => {
    const { box_2d, name, ...attrs } = item;
    return {
      scan_id: scan.id,
      crop_image_url: image_url, // original image; bounding box is in auto_attributes
      detection_confidence: 0.9,
      classification_confidence: 0.85,
      auto_attributes: {
        ...attrs,
        box_2d,
        name,
      },
      status: 'pending' as const,
    };
  });

  const { data: detections, error: detectionsError } = await supabase
    .from('scan_detections')
    .insert(detectionRecords)
    .select();

  if (detectionsError) {
    return c.json(
      { data: null, error: { code: 'DB_ERROR', message: detectionsError.message } },
      500
    );
  }

  // Step 4: Emit preference signal
  await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: 'photographed',
    value: {
      source: 'batch-photo',
      items_detected: detectedItems.length,
      scan_id: scan.id,
    },
  });

  // Step 5: Build response items
  const responseItems = (detections ?? []).map((detection, index) => ({
    detection_id: detection.id,
    name: detectedItems[index].name,
    box_2d: detectedItems[index].box_2d,
    attributes: {
      category: detectedItems[index].category,
      subcategory: detectedItems[index].subcategory,
      colors: detectedItems[index].colors,
      pattern: detectedItems[index].pattern,
      material: detectedItems[index].material,
      brand: detectedItems[index].brand,
      formality_level: detectedItems[index].formality_level,
      seasons: detectedItems[index].seasons,
      condition: detectedItems[index].condition,
      style_tags: detectedItems[index].style_tags,
    },
  }));

  // Step 6: Non-blocking product search for each detected item.
  // Batched to avoid overwhelming Serper API with concurrent requests.
  // If SERPER_API_KEY is not set, all resolve to empty arrays immediately.
  const SEARCH_BATCH_SIZE = 5;
  const productResults: ProductSearchResult[][] = new Array(detectedItems.length).fill([]);

  for (let i = 0; i < detectedItems.length; i += SEARCH_BATCH_SIZE) {
    const batch = detectedItems.slice(i, i + SEARCH_BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((item) => {
        const query = buildSearchQuery({
          brand: item.brand,
          colors: item.colors,
          subcategory: item.subcategory,
          material: item.material,
          category: item.category,
        });
        if (!query) return Promise.resolve([] as ProductSearchResult[]);
        return searchProductWithDeadline(query, 3_000);
      })
    );
    batchResults.forEach((result, batchIndex) => {
      productResults[i + batchIndex] =
        result.status === 'fulfilled' ? result.value : [];
    });
  }

  // Attach product matches to each response item (top 3 per item)
  const itemsWithProducts = responseItems.map((item, index) => ({
    ...item,
    product_matches:
      productResults[index] && productResults[index].length > 0
        ? productResults[index].slice(0, 3)
        : undefined,
  }));

  return c.json({
    data: {
      scan_id: scan.id,
      items_detected: detectedItems.length,
      items: itemsWithProducts,
    },
    error: null,
  });
});

// ── POST /wardrobe/items/batch-confirm ──────────────────────

batchScan.post('/items/batch-confirm', zValidator('json', batchConfirmSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const { scan_id, items } = c.req.valid('json');

  // Verify scan belongs to user
  const { data: scan, error: scanError } = await supabase
    .from('wardrobe_scans')
    .select('id, user_id, status, source_media_url')
    .eq('id', scan_id)
    .single();

  if (scanError || !scan) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Scan not found' } },
      404
    );
  }

  if (scan.user_id !== userId) {
    return c.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Scan does not belong to this user' } },
      403
    );
  }

  if (scan.status !== 'review') {
    return c.json(
      { data: null, error: { code: 'ALREADY_PROCESSED', message: 'This scan has already been processed' } },
      409
    );
  }

  const createdItems: Array<Record<string, unknown>> = [];
  let confirmedCount = 0;
  let rejectedCount = 0;
  const warnings: string[] = [];

  for (const item of items) {
    // Fetch the detection to get auto_attributes
    const { data: detection, error: detectionError } = await supabase
      .from('scan_detections')
      .select('id, auto_attributes')
      .eq('id', item.detection_id)
      .eq('scan_id', scan_id)
      .single();

    if (detectionError || !detection) {
      warnings.push(`Detection ${item.detection_id} not found, skipping`);
      continue;
    }

    const autoAttrs = detection.auto_attributes as Record<string, unknown>;

    if (item.confirmed) {
      // Merge auto_attributes with any overrides
      const attrs = {
        ...autoAttrs,
        ...(item.attributes_override ?? {}),
      };

      const itemName =
        item.name ??
        (autoAttrs.name as string | undefined) ??
        `${(attrs.colors as Record<string, unknown>)?.dominant ?? ''} ${attrs.subcategory ?? attrs.category}`.trim();

      const colorsObj = attrs.colors as { dominant: string; secondary: string[]; hex_codes?: string[] } | undefined;
      const colorArray = colorsObj
        ? [colorsObj.dominant, ...colorsObj.secondary]
        : [];

      const { data: wardrobeItem, error: insertError } = await supabase
        .from('wardrobe_items')
        .insert({
          user_id: userId,
          name: itemName,
          category: attrs.category as string,
          subcategory: (attrs.subcategory as string | null) ?? null,
          colors: colorArray,
          pattern: (attrs.pattern as string) ?? 'solid',
          material: (attrs.material as string | null) ?? null,
          brand: (attrs.brand as string | null) ?? null,
          formality_level: (attrs.formality_level as number) ?? 3,
          seasons: (attrs.seasons as string[]) ?? [],
          condition: (attrs.condition as string) ?? 'good',
          image_url: scan.source_media_url,
          notes: `batch-scan:${JSON.stringify(detection.auto_attributes?.box_2d || [])}`,
          source: 'batch-photo' as const,
          status: 'active' as const,
        })
        .select()
        .single();

      if (insertError) {
        warnings.push(`Failed to create item for detection ${item.detection_id}: ${insertError.message}`);
        continue;
      }

      // Update detection status to confirmed, link to wardrobe item
      await supabase
        .from('scan_detections')
        .update({
          status: 'confirmed',
          wardrobe_item_id: wardrobeItem.id,
          user_attributes: item.attributes_override ?? null,
        })
        .eq('id', item.detection_id);

      createdItems.push(wardrobeItem);
      confirmedCount++;
    } else {
      // Mark as rejected
      await supabase
        .from('scan_detections')
        .update({ status: 'rejected' })
        .eq('id', item.detection_id);

      rejectedCount++;
    }
  }

  // Update scan counts and potentially mark as confirmed
  const totalProcessed = confirmedCount + rejectedCount;
  const updateData: Record<string, unknown> = {
    items_confirmed: confirmedCount,
    items_rejected: rejectedCount,
  };

  // Fetch current scan to check if all items are processed
  const { data: currentScan } = await supabase
    .from('wardrobe_scans')
    .select('items_detected')
    .eq('id', scan_id)
    .single();

  if (currentScan && totalProcessed >= currentScan.items_detected) {
    updateData.status = 'confirmed';
  }

  await supabase
    .from('wardrobe_scans')
    .update(updateData)
    .eq('id', scan_id);

  // Emit photographed signals for confirmed items
  if (createdItems.length > 0) {
    const signals = createdItems.map((wardrobeItem) => ({
      user_id: userId,
      signal_type: 'photographed' as const,
      item_id: wardrobeItem.id as string,
      value: {
        source: 'batch-photo',
        scan_id,
      },
    }));

    await supabase.from('preference_signals').insert(signals);
  }

  const response: Record<string, unknown> = {
    data: {
      created_items: createdItems,
      confirmed_count: confirmedCount,
      rejected_count: rejectedCount,
    },
    error: null,
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  return c.json(response, 201);
});

export default batchScan;
