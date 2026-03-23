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

const scan = new Hono<{ Variables: AppVariables }>();
scan.use('*', authMiddleware);

const scanSchema = z.object({
  image_url: z.string().url(),
});

const EXTRACTION_PROMPT = `You are a fashion expert analyzing a photograph of a clothing item or accessory. Extract structured attributes from this image.

Respond with ONLY a JSON object (no markdown, no explanation) matching this exact schema:

{
  "category": one of: ${ITEM_CATEGORIES.join(', ')},
  "subcategory": string or null (e.g. "t-shirt", "blazer", "sneakers", "crossbody bag"),
  "colors": {
    "dominant": string (fashion color name, e.g. "navy", "cream", "burgundy"),
    "secondary": string[] (other colors present),
    "hex_codes": string[] (approximate hex codes for each color)
  },
  "pattern": one of: ${PATTERNS.join(', ')},
  "material": one of: ${MATERIALS.join(', ')} or null if unclear,
  "brand": string or null (if visible logo/tag),
  "formality_level": integer 1-5 (1=very casual, 3=smart casual, 5=black tie),
  "seasons": array of: ${SEASONS.join(', ')} (which seasons this item suits),
  "condition": one of: ${ITEM_CONDITIONS.join(', ')},
  "style_tags": string[] (e.g. ["minimalist", "streetwear", "vintage", "preppy"])
}

Rules:
- Use lowercase fashion color names (not generic "blue" — prefer "navy", "cobalt", "powder blue")
- Be specific with subcategory (not "top" — prefer "crew neck t-shirt", "button-down shirt")
- Estimate formality based on the item itself, not how it's styled
- Include all seasons the item could reasonably be worn in
- If you can't determine something with confidence, use null
- style_tags should be 2-5 descriptive tags`;

// ── POST /wardrobe/items/scan — Extract attributes via Gemini Vision ─

scan.post('/items/scan', zValidator('json', scanSchema), async (c) => {
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

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  let attributes: ItemAttributes;
  try {
    // Fetch the image and convert to base64 for Gemini
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
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    // Extract text from response
    const text = response.text?.trim();
    if (!text) {
      throw new Error('No text response from Gemini');
    }

    // Parse JSON — Gemini may wrap in markdown code blocks
    let jsonStr = text;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    attributes = JSON.parse(jsonStr) as ItemAttributes;

    // Validate the parsed result has required fields
    if (
      !attributes.category ||
      !(ITEM_CATEGORIES as readonly string[]).includes(attributes.category)
    ) {
      throw new Error(`Invalid category: ${attributes.category}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract attributes';
    return c.json(
      { data: null, error: { code: 'SCAN_FAILED', message } },
      502
    );
  }

  // Emit 'photographed' preference signal
  await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: 'photographed',
    value: {
      source: 'single-item',
      auto_attributes: attributes,
    },
  });

  // Non-blocking product search — race against 3s deadline.
  // If it completes in time, include results. Otherwise return without them.
  let productMatches: ProductSearchResult[] = [];
  const searchQuery = buildSearchQuery({
    brand: attributes.brand,
    colors: attributes.colors,
    subcategory: attributes.subcategory,
    material: attributes.material,
    category: attributes.category,
  });

  if (searchQuery) {
    productMatches = await searchProductWithDeadline(searchQuery, 3_000);
  }

  return c.json({
    data: {
      ...attributes,
      product_matches: productMatches.length > 0 ? productMatches.slice(0, 3) : undefined,
      product_search_query: searchQuery || undefined,
    },
    error: null,
  });
});

export default scan;
