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
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import {
  buildSearchQuery,
  searchProductWithDeadline,
  type ProductSearchResult,
} from '../lib/product-search';

const rapidScan = new Hono<{ Variables: AppVariables }>();
rapidScan.use('*', authMiddleware);

// ── SSRF protection ─────────────────────────────────────────
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
const FETCH_TIMEOUT_MS = 15_000;

async function fetchImageSafe(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_IMAGE_SIZE) {
      throw new Error(
        `Image too large: ${contentLength} bytes (max ${MAX_IMAGE_SIZE})`
      );
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

const rapidScanSchema = z.object({
  image_urls: z.array(z.string().url()).min(1).max(80),
});

const singleDetectionSchema = z.object({
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
  confidence: z.number().min(0).max(1).default(0.85),
});

type DetectedItem = z.infer<typeof singleDetectionSchema>;

const rapidConfirmSchema = z.object({
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

// ── Single-item hanger scan prompt ──────────────────────────

const HANGER_SCAN_PROMPT = `You are a fashion expert analyzing a photograph of a garment hanging on a hanger in a closet. Identify the garment from its visible front.

Respond with ONLY a JSON object (no markdown, no explanation) matching this exact schema:

{
  "category": one of: ${ITEM_CATEGORIES.join(', ')},
  "subcategory": string or null (e.g. "t-shirt", "blazer", "sneakers"),
  "colors": {
    "dominant": string (fashion color name, e.g. "navy", "cream", "burgundy"),
    "secondary": string[] (other colors present),
    "hex_codes": string[] (approximate hex codes)
  },
  "pattern": one of: ${PATTERNS.join(', ')},
  "material": one of: ${MATERIALS.join(', ')} or null if unclear,
  "brand": string or null (if visible logo/tag),
  "formality_level": integer 1-5 (1=very casual, 5=black tie),
  "seasons": array of: ${SEASONS.join(', ')},
  "condition": one of: ${ITEM_CONDITIONS.join(', ')},
  "style_tags": string[] (2-5 tags like "minimalist", "streetwear"),
  "name": brief descriptive name (e.g. "Navy Cotton Crew Neck T-Shirt"),
  "confidence": number 0-1 (how confident you are in identifying this garment)
}

Rules:
- Use lowercase fashion color names (navy, cobalt, powder blue — not generic "blue")
- Be specific with subcategory (not "top" — prefer "crew neck t-shirt", "button-down shirt")
- The item is hanging on a hanger — focus on the garment, ignore the hanger and background
- If the image is blurry or shows mainly closet background with no clear garment, set confidence to 0.2 or below
- If you can't determine something with confidence, use null`;

// ── Deduplication logic ─────────────────────────────────────

interface DetectedItemWithUrl {
  item: DetectedItem;
  imageUrl: string;
  frameIndex: number;
}

/**
 * Check whether two detected items represent the same garment based on
 * category + dominant color + subcategory word overlap.
 */
function isSameGarment(a: DetectedItem, b: DetectedItem): boolean {
  if (a.category !== b.category) return false;
  if (a.colors.dominant.toLowerCase() !== b.colors.dominant.toLowerCase())
    return false;
  if (a.subcategory != null && b.subcategory != null) {
    const aWords = new Set(a.subcategory.toLowerCase().split(/\s+/));
    const bWords = new Set(b.subcategory.toLowerCase().split(/\s+/));
    const intersection = [...aWords].filter((w) => bWords.has(w));
    const unionSize = new Set([...aWords, ...bWords]).size;
    if (unionSize > 0 && intersection.length / unionSize < 0.3) return false;
  }
  return true;
}

/**
 * Simple attribute-based deduplication: if two items share the same
 * category + dominant color + similar subcategory, they are likely
 * the same garment photographed from adjacent frames. Keep the one
 * with higher confidence.
 */
function deduplicateItems(
  items: DetectedItemWithUrl[]
): DetectedItemWithUrl[] {
  const unique: DetectedItemWithUrl[] = [];

  for (const candidate of items) {
    const isDuplicate = unique.some((existing) =>
      isSameGarment(existing.item, candidate.item)
    );

    if (isDuplicate) {
      // Replace existing if candidate has higher confidence
      const existingIndex = unique.findIndex((existing) =>
        isSameGarment(existing.item, candidate.item)
      );
      if (
        existingIndex !== -1 &&
        candidate.item.confidence > unique[existingIndex].item.confidence
      ) {
        unique[existingIndex] = candidate;
      }
    } else {
      unique.push(candidate);
    }
  }

  return unique;
}

// ── POST /wardrobe/items/rapid-scan ─────────────────────────

rapidScan.post(
  '/items/rapid-scan',
  zValidator('json', rapidScanSchema),
  async (c) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return c.json(
        {
          data: null,
          error: {
            code: 'CONFIG_ERROR',
            message: 'GEMINI_API_KEY not configured',
          },
        },
        500
      );
    }

    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { image_urls } = c.req.valid('json');

    // SSRF validation on all URLs
    const invalidUrls = image_urls.filter((url) => !isAllowedImageUrl(url));
    if (invalidUrls.length > 0) {
      return c.json(
        {
          data: null,
          error: {
            code: 'INVALID_URL',
            message: `${invalidUrls.length} image URL(s) are not from a trusted source`,
          },
        },
        400
      );
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Step 1: Create wardrobe_scans record (status: processing)
    const { data: scan, error: scanError } = await supabase
      .from('wardrobe_scans')
      .insert({
        user_id: userId,
        method: 'hanger-flip',
        status: 'processing',
        items_detected: 0,
      })
      .select()
      .single();

    if (scanError || !scan) {
      return c.json(
        {
          data: null,
          error: {
            code: 'DB_ERROR',
            message: scanError?.message ?? 'Failed to create scan record',
          },
        },
        500
      );
    }

    // Step 2: Process images through Gemini in batches to avoid OOM and rate limits
    const BATCH_SIZE = 8;

    async function processFrame(url: string, index: number) {
      const { base64, mimeType } = await fetchImageSafe(url);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: HANGER_SCAN_PROMPT },
            ],
          },
        ],
      });

      const text = response.text?.trim();
      if (!text) throw new Error('No response from Gemini');

      let jsonStr = text;
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\n?/, '')
          .replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonStr);
      const validated = singleDetectionSchema.parse(parsed);

      return { item: validated, imageUrl: url, frameIndex: index };
    }

    const results: PromiseSettledResult<{
      item: DetectedItem;
      imageUrl: string;
      frameIndex: number;
    }>[] = [];

    for (let i = 0; i < image_urls.length; i += BATCH_SIZE) {
      const batch = image_urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((url, batchIndex) => processFrame(url, i + batchIndex))
      );
      results.push(...batchResults);
    }

    // Collect successful detections, skip failures
    const detectedItems: DetectedItemWithUrl[] = [];
    const processingErrors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        // Skip low-confidence detections (likely blurry/no garment)
        if (result.value.item.confidence > 0.3) {
          detectedItems.push(result.value);
        }
      } else {
        processingErrors.push(
          `Frame ${i}: ${result.reason instanceof Error ? result.reason.message : 'Unknown error'}`
        );
      }
    }

    // Step 3: Server-side deduplication
    const uniqueItems = deduplicateItems(detectedItems);

    // Step 4: Create scan_detections records
    const detectionRecords = uniqueItems.map((entry) => {
      const { confidence, name, ...attrs } = entry.item;
      return {
        scan_id: scan.id,
        crop_image_url: entry.imageUrl,
        detection_confidence: confidence,
        classification_confidence: confidence,
        auto_attributes: {
          ...attrs,
          name,
        },
        status: 'pending' as const,
        source_frame_index: entry.frameIndex,
      };
    });

    const { data: detections, error: detectionsError } = await supabase
      .from('scan_detections')
      .insert(detectionRecords)
      .select();

    if (detectionsError) {
      // Update scan to failed
      await supabase
        .from('wardrobe_scans')
        .update({ status: 'failed', error: detectionsError.message })
        .eq('id', scan.id);

      return c.json(
        {
          data: null,
          error: { code: 'DB_ERROR', message: detectionsError.message },
        },
        500
      );
    }

    // Step 5: Update scan status to 'review'
    await supabase
      .from('wardrobe_scans')
      .update({
        status: 'review',
        items_detected: uniqueItems.length,
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', scan.id);

    // Step 6: Emit preference signal
    await supabase.from('preference_signals').insert({
      user_id: userId,
      signal_type: 'photographed',
      value: {
        source: 'hanger-flip',
        frames_captured: image_urls.length,
        items_detected: uniqueItems.length,
        duplicates_removed: detectedItems.length - uniqueItems.length,
        scan_id: scan.id,
      },
    });

    // Step 7: Build response items
    const responseItems = (detections ?? []).map((detection, index) => ({
      detection_id: detection.id as string,
      name: uniqueItems[index].item.name,
      image_url: uniqueItems[index].imageUrl,
      attributes: {
        category: uniqueItems[index].item.category,
        subcategory: uniqueItems[index].item.subcategory,
        colors: uniqueItems[index].item.colors,
        pattern: uniqueItems[index].item.pattern,
        material: uniqueItems[index].item.material,
        brand: uniqueItems[index].item.brand,
        formality_level: uniqueItems[index].item.formality_level,
        seasons: uniqueItems[index].item.seasons,
        condition: uniqueItems[index].item.condition,
        style_tags: uniqueItems[index].item.style_tags,
      },
    }));

    // Step 8: Non-blocking product search for each unique item (parallel, 3s deadline each)
    const productSearchPromises = uniqueItems.map((entry) => {
      const query = buildSearchQuery({
        brand: entry.item.brand,
        colors: entry.item.colors,
        subcategory: entry.item.subcategory,
        material: entry.item.material,
        category: entry.item.category,
      });
      if (!query) return Promise.resolve([] as ProductSearchResult[]);
      return searchProductWithDeadline(query, 3_000);
    });

    const productResults = await Promise.all(productSearchPromises);

    const itemsWithProducts = responseItems.map((item, index) => ({
      ...item,
      product_matches:
        productResults[index] && productResults[index].length > 0
          ? productResults[index].slice(0, 3)
          : undefined,
    }));

    return c.json({
      data: {
        scan_id: scan.id as string,
        items_detected: uniqueItems.length,
        frames_processed: image_urls.length,
        duplicates_removed: detectedItems.length - uniqueItems.length,
        processing_errors: processingErrors.length,
        items: itemsWithProducts,
      },
      error: null,
    });
  }
);

// ── POST /wardrobe/items/rapid-confirm ──────────────────────

rapidScan.post(
  '/items/rapid-confirm',
  zValidator('json', rapidConfirmSchema),
  async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const { scan_id, items } = c.req.valid('json');

    // Verify scan belongs to user
    const { data: scan, error: scanError } = await supabase
      .from('wardrobe_scans')
      .select('id, user_id, status')
      .eq('id', scan_id)
      .single();

    if (scanError || !scan) {
      return c.json(
        {
          data: null,
          error: { code: 'NOT_FOUND', message: 'Scan not found' },
        },
        404
      );
    }

    if (scan.user_id !== userId) {
      return c.json(
        {
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Scan does not belong to this user',
          },
        },
        403
      );
    }

    if (scan.status !== 'review') {
      return c.json(
        {
          data: null,
          error: {
            code: 'ALREADY_PROCESSED',
            message: 'This scan has already been processed',
          },
        },
        409
      );
    }

    const createdItems: Array<Record<string, unknown>> = [];
    let confirmedCount = 0;
    let rejectedCount = 0;
    const warnings: string[] = [];

    for (const item of items) {
      const { data: detection, error: detectionError } = await supabase
        .from('scan_detections')
        .select('id, auto_attributes, crop_image_url')
        .eq('id', item.detection_id)
        .eq('scan_id', scan_id)
        .single();

      if (detectionError || !detection) {
        warnings.push(
          `Detection ${item.detection_id} not found, skipping`
        );
        continue;
      }

      const autoAttrs = detection.auto_attributes as Record<string, unknown>;

      if (item.confirmed) {
        const attrs = {
          ...autoAttrs,
          ...(item.attributes_override ?? {}),
        };

        const itemName =
          item.name ??
          (autoAttrs.name as string | undefined) ??
          `${(attrs.colors as Record<string, unknown>)?.dominant ?? ''} ${attrs.subcategory ?? attrs.category}`.trim();

        const colorsObj = attrs.colors as
          | { dominant: string; secondary: string[]; hex_codes?: string[] }
          | undefined;
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
            image_url: detection.crop_image_url as string,
            notes: `hanger-flip:frame-${(autoAttrs as Record<string, unknown>).source_frame_index ?? 'unknown'}`,
            source: 'hanger-flip' as const,
            status: 'active' as const,
          })
          .select()
          .single();

        if (insertError) {
          warnings.push(
            `Failed to create item for detection ${item.detection_id}: ${insertError.message}`
          );
          continue;
        }

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
        await supabase
          .from('scan_detections')
          .update({ status: 'rejected' })
          .eq('id', item.detection_id);

        rejectedCount++;
      }
    }

    // Update scan record
    const totalProcessed = confirmedCount + rejectedCount;
    const updateData: Record<string, unknown> = {
      items_confirmed: confirmedCount,
      items_rejected: rejectedCount,
    };

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

    // Emit preference signals for confirmed items
    if (createdItems.length > 0) {
      const signals = createdItems.map((wardrobeItem) => ({
        user_id: userId,
        signal_type: 'photographed' as const,
        item_id: wardrobeItem.id as string,
        value: {
          source: 'hanger-flip',
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
  }
);

export default rapidScan;
