import { Hono } from 'hono';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import {
  buildSearchQuery,
  searchProduct,
  storeProductMatches,
  type ProductSearchResult,
} from '../lib/product-search';

const productMatch = new Hono<{ Variables: AppVariables }>();
productMatch.use('*', authMiddleware);

// ── POST /wardrobe/items/:id/find-product ────────────────────
//
// Searches Google Shopping for a wardrobe item's product match.
// 1. Fetches the wardrobe item (verify ownership via RLS)
// 2. Builds search query from item attributes
// 3. Calls Serper Google Shopping API
// 4. Stores top results in external_products table
// 5. Returns matches to caller

productMatch.post('/items/:id/find-product', async (c) => {
  const supabase = c.get('supabase');
  const id = c.req.param('id');

  // Step 1: Fetch the wardrobe item (RLS ensures ownership)
  const { data: item, error: itemError } = await supabase
    .from('wardrobe_items')
    .select('id, name, category, subcategory, colors, pattern, material, brand')
    .eq('id', id)
    .single();

  if (itemError || !item) {
    const status = itemError?.code === 'PGRST116' ? 404 : 400;
    return c.json(
      {
        data: null,
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'QUERY_FAILED',
          message: itemError?.message ?? 'Item not found',
        },
      },
      status
    );
  }

  // Step 2: Build search query from attributes
  // wardrobe_items stores colors as text[] — extract dominant (first element)
  const colorsArray = item.colors as string[] | null;
  const dominantColor = colorsArray && colorsArray.length > 0 ? colorsArray[0] : null;

  const query = buildSearchQuery({
    brand: item.brand,
    colors: dominantColor ? { dominant: dominantColor } : null,
    subcategory: item.subcategory,
    material: item.material,
    category: item.category,
  });

  if (!query) {
    return c.json({
      data: { matches: [], query: '', stored_ids: [] },
      error: null,
    });
  }

  // Step 3: Search Google Shopping
  const results = await searchProduct(query);

  // Step 4: Store top 3 in external_products
  const topResults = results.slice(0, 3);
  const storedIds = await storeProductMatches(topResults, item.category);

  // Step 5: Return matches
  const matches: Array<ProductSearchResult & { external_product_id: string | null }> =
    topResults.map((result, index) => ({
      ...result,
      external_product_id: storedIds[index] ?? null,
    }));

  return c.json({
    data: {
      matches,
      query,
      stored_ids: storedIds,
    },
    error: null,
  });
});

export default productMatch;
