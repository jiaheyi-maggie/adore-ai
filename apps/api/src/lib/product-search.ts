import { type ProductSearchResult } from '@adore/shared';
import { getAdminClient } from './supabase';

export type { ProductSearchResult };

/** Raw Serper Google Shopping API response shape */
interface SerperShoppingResponse {
  shopping?: Array<{
    title: string;
    price: number;
    currency?: string;
    link: string;
    imageUrl?: string;
    source: string;
  }>;
}

// ── Query Builder ────────────────────────────────────────────

interface ItemAttributes {
  brand?: string | null;
  colors?: { dominant: string } | null;
  subcategory?: string | null;
  material?: string | null;
  category?: string | null;
}

/**
 * Builds a Google Shopping search query from item attributes.
 * Strategy: "{brand} {dominant_color} {subcategory}".
 * Fallback (no brand): "{dominant_color} {subcategory} {material}".
 */
export function buildSearchQuery(attrs: ItemAttributes): string {
  const parts: string[] = [];

  if (attrs.brand) {
    parts.push(attrs.brand);
  }

  const dominantColor =
    typeof attrs.colors === 'object' && attrs.colors !== null
      ? attrs.colors.dominant
      : null;

  if (dominantColor) {
    parts.push(dominantColor);
  }

  if (attrs.subcategory) {
    parts.push(attrs.subcategory);
  } else if (attrs.category) {
    parts.push(attrs.category);
  }

  // If no brand, append material for better specificity
  if (!attrs.brand && attrs.material) {
    parts.push(attrs.material);
  }

  return parts.join(' ').trim();
}

// ── Serper API Call ──────────────────────────────────────────

const SERPER_TIMEOUT_MS = 5_000;
const MAX_RESULTS = 5;

/**
 * Search Google Shopping via Serper API for product matches.
 *
 * Graceful degradation:
 * - If SERPER_API_KEY is not set, returns empty array (no error).
 * - If API call fails, returns empty array (logs error, no crash).
 * - 5-second timeout on all requests.
 */
export async function searchProduct(
  query: string,
  signal?: AbortSignal
): Promise<ProductSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  if (!query.trim()) return [];

  try {
    const response = await fetch('https://google.serper.dev/shopping', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: MAX_RESULTS,
      }),
      signal: signal ?? AbortSignal.timeout(SERPER_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[product-search] Serper API error: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = (await response.json()) as SerperShoppingResponse;

    if (!data.shopping || data.shopping.length === 0) {
      return [];
    }

    return data.shopping.map((item) => ({
      name: item.title,
      price: item.price,
      currency: item.currency ?? 'USD',
      source_url: item.link,
      image_url: item.imageUrl ?? '',
      retailer: item.source,
      brand: null, // Serper doesn't return brand separately; it's in the title
    }));
  } catch (err) {
    // AbortError = timeout, everything else = unexpected failure
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    console.error(
      `[product-search] ${isTimeout ? 'Timeout' : 'Failed'} searching for "${query}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ── Storage ─────────────────────────────────────────────────

/**
 * Stores product search results in the `external_products` table.
 * Uses upsert on source_url to avoid duplicates.
 * Returns the IDs of stored products.
 *
 * Uses admin client because external_products RLS requires service_role for inserts.
 */
export async function storeProductMatches(
  results: ProductSearchResult[],
  category: string | null
): Promise<string[]> {
  if (results.length === 0) return [];

  const adminClient = getAdminClient();

  const records = results.map((r) => ({
    name: r.name,
    brand: r.brand,
    category: category,
    price: r.price,
    image_url: r.image_url || 'https://placeholder.co/400',
    source_url: r.source_url,
    retailer: r.retailer,
    attributes: {
      currency: r.currency,
      search_source: 'serper_google_shopping',
    },
  }));

  const ids: string[] = [];

  // Insert one by one to handle source_url uniqueness gracefully.
  // external_products doesn't have a unique constraint on source_url in the schema,
  // so we check for existence first.
  for (const record of records) {
    // Check if this source_url already exists
    const { data: existing } = await adminClient
      .from('external_products')
      .select('id')
      .eq('source_url', record.source_url)
      .limit(1)
      .single();

    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const { data: inserted, error } = await adminClient
      .from('external_products')
      .insert(record)
      .select('id')
      .single();

    if (error) {
      console.error('[product-search] Failed to store product:', error.message);
      continue;
    }

    if (inserted) {
      ids.push(inserted.id);
    }
  }

  return ids;
}

// ── Non-blocking search helper ──────────────────────────────

/**
 * Races a product search against a timeout. Returns results if the search
 * completes within the deadline, otherwise returns empty array.
 * Never throws.
 */
export async function searchProductWithDeadline(
  query: string,
  deadlineMs: number = 3_000
): Promise<ProductSearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    return await searchProduct(query, controller.signal);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
