import { createClient } from '@supabase/supabase-js';
import type {
  WardrobeItem,
  ItemAttributes,
  Outfit,
  OutfitItem,
  WeatherContext,
  PaginatedResponse,
  ApiResponse,
  ApiError,
  OccasionType,
  MoodTag,
  ItemCategory,
  Pattern,
  Material,
  Season,
  ItemCondition,
  Conversation,
  Message,
  MarketplaceListing,
  PriceSuggestion,
  ListingStatus,
  ListingPlatform,
  WishlistItem,
  WishlistPriority,
  HappinessScore,
  BudgetPeriod,
  ColorSeason,
  User,
  StyleProfile,
  ProductSearchResult,
} from '@adore/shared';

// ── Supabase client (for auth only in mobile) ──────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── API base URL ────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ── Helpers ─────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    const err = json.error ?? { code: 'UNKNOWN', message: `Request failed: ${res.status}` };
    throw new Error(err.message);
  }

  return json as T;
}

// ── Wardrobe Items API ──────────────────────────────────────

export interface ListItemsParams {
  category?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export async function listItems(
  params: ListItemsParams = {}
): Promise<PaginatedResponse<WardrobeItem>> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.status) searchParams.set('status', params.status);
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<WardrobeItem>>(
    `/wardrobe/items${qs ? `?${qs}` : ''}`
  );
}

export async function getItem(id: string): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>(`/wardrobe/items/${id}`);
}

export async function createItem(
  item: Record<string, unknown>
): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>('/wardrobe/items', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function updateItem(
  id: string,
  updates: Record<string, unknown>
): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>(`/wardrobe/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteItem(id: string): Promise<ApiResponse<WardrobeItem>> {
  return apiFetch<ApiResponse<WardrobeItem>>(`/wardrobe/items/${id}`, {
    method: 'DELETE',
  });
}

// ── Upload API ──────────────────────────────────────────────

export async function uploadImage(
  imageUri: string
): Promise<{ path: string; public_url: string }> {
  const authHeaders = await getAuthHeaders();

  // Read the file as a blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const formData = new FormData();
  // React Native's FormData accepts { uri, type, name } objects
  formData.append('image', {
    uri: imageUri,
    type: blob.type || 'image/jpeg',
    name: `photo-${Date.now()}.jpg`,
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/wardrobe/items/upload`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      // Don't set Content-Type — let FormData set the multipart boundary
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? 'Upload failed');
  }
  return json.data;
}

// ── Background Removal API ──────────────────────────────────

export async function removeBackground(
  imageUrl: string
): Promise<{ original_url: string; clean_url: string }> {
  const result = await apiFetch<
    ApiResponse<{ original_url: string; clean_url: string }>
  >('/wardrobe/items/remove-background', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl }),
  });
  return result.data;
}

// ── Scan API ────────────────────────────────────────────────

export async function scanItem(
  imageUrl: string
): Promise<ItemAttributes> {
  const result = await apiFetch<ApiResponse<ItemAttributes>>(
    '/wardrobe/items/scan',
    {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  return result.data;
}

// ── Batch Scan API ──────────────────────────────────────────

export interface BatchScanItem {
  detection_id: string;
  name: string;
  box_2d: [number, number, number, number];
  attributes: ItemAttributes;
  product_matches?: ProductSearchResult[];
}

export interface BatchScanResult {
  scan_id: string;
  items_detected: number;
  items: BatchScanItem[];
}

export async function batchScan(
  imageUrl: string
): Promise<BatchScanResult> {
  const result = await apiFetch<ApiResponse<BatchScanResult>>(
    '/wardrobe/items/batch-scan',
    {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  return result.data;
}

export interface BatchConfirmItem {
  detection_id: string;
  confirmed: boolean;
  attributes_override?: Partial<ItemAttributes>;
  name?: string;
}

export interface BatchConfirmResult {
  created_items: WardrobeItem[];
  confirmed_count: number;
  rejected_count: number;
}

export async function batchConfirm(
  scanId: string,
  items: BatchConfirmItem[]
): Promise<BatchConfirmResult> {
  const result = await apiFetch<ApiResponse<BatchConfirmResult>>(
    '/wardrobe/items/batch-confirm',
    {
      method: 'POST',
      body: JSON.stringify({ scan_id: scanId, items }),
    }
  );
  return result.data;
}

// ── Product Matching API ────────────────────────────────────

export interface FindProductResult {
  matches: Array<ProductSearchResult & { external_product_id: string | null }>;
  query: string;
  stored_ids: string[];
}

export async function findProduct(
  itemId: string
): Promise<FindProductResult> {
  const result = await apiFetch<ApiResponse<FindProductResult>>(
    `/wardrobe/items/${itemId}/find-product`,
    { method: 'POST' }
  );
  return result.data;
}

// ── Rapid Scan (Hanger Flip) API ────────────────────────────

export interface RapidScanItem {
  detection_id: string;
  name: string;
  image_url: string;
  attributes: ItemAttributes;
  product_matches?: ProductSearchResult[];
}

export interface RapidScanResult {
  scan_id: string;
  items_detected: number;
  frames_processed: number;
  duplicates_removed: number;
  processing_errors: number;
  items: RapidScanItem[];
}

export async function rapidScan(
  imageUrls: string[]
): Promise<RapidScanResult> {
  const result = await apiFetch<ApiResponse<RapidScanResult>>(
    '/wardrobe/items/rapid-scan',
    {
      method: 'POST',
      body: JSON.stringify({ image_urls: imageUrls }),
    }
  );
  return result.data;
}

export interface RapidConfirmItem {
  detection_id: string;
  confirmed: boolean;
  attributes_override?: Partial<ItemAttributes>;
  name?: string;
}

export interface RapidConfirmResult {
  created_items: WardrobeItem[];
  confirmed_count: number;
  rejected_count: number;
}

export async function rapidConfirm(
  scanId: string,
  items: RapidConfirmItem[]
): Promise<RapidConfirmResult> {
  const result = await apiFetch<ApiResponse<RapidConfirmResult>>(
    '/wardrobe/items/rapid-confirm',
    {
      method: 'POST',
      body: JSON.stringify({ scan_id: scanId, items }),
    }
  );
  return result.data;
}

// ── Outfits API ─────────────────────────────────────────────

/** Outfit with joined items from the API */
export interface OutfitWithItems extends Outfit {
  outfit_items: Array<
    OutfitItem & {
      wardrobe_item: Pick<
        WardrobeItem,
        'id' | 'name' | 'category' | 'colors' | 'image_url' | 'image_url_clean'
      > | null;
    }
  >;
}

export interface ListOutfitsParams {
  cursor?: string;
  limit?: number;
}

export async function listOutfits(
  params: ListOutfitsParams = {}
): Promise<PaginatedResponse<OutfitWithItems>> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<OutfitWithItems>>(
    `/outfits${qs ? `?${qs}` : ''}`
  );
}

export async function getOutfit(
  id: string
): Promise<ApiResponse<OutfitWithItems>> {
  return apiFetch<ApiResponse<OutfitWithItems>>(`/outfits/${id}`);
}

export interface CreateOutfitPayload {
  photo_url?: string | null;
  occasion?: OccasionType | null;
  mood_tag?: MoodTag | null;
  worn_date?: string | null;
  notes?: string | null;
  happiness_score?: number | null;
  weather_context?: WeatherContext | null;
  item_ids?: string[];
  new_items?: Array<{
    name: string;
    category: ItemCategory;
    subcategory?: string | null;
    colors?: string[];
    pattern?: Pattern;
    material?: Material | null;
    brand?: string | null;
    formality_level?: number;
    seasons?: Season[];
    condition?: ItemCondition;
    image_url?: string | null;
    image_url_clean?: string | null;
  }>;
}

export async function createOutfit(
  data: CreateOutfitPayload
): Promise<ApiResponse<OutfitWithItems>> {
  return apiFetch<ApiResponse<OutfitWithItems>>('/outfits', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOutfit(
  id: string,
  updates: Record<string, unknown>
): Promise<ApiResponse<OutfitWithItems>> {
  return apiFetch<ApiResponse<OutfitWithItems>>(`/outfits/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** Decompose result for a single detected item */
export interface DecomposedItem {
  detected_item: ItemAttributes & { description: string };
  match: {
    wardrobe_item_id: string;
    confidence: number;
    wardrobe_item: Pick<
      WardrobeItem,
      'id' | 'name' | 'category' | 'colors' | 'image_url' | 'image_url_clean'
    > | null;
  } | null;
}

export async function decomposeOutfit(
  imageUrl: string
): Promise<DecomposedItem[]> {
  const result = await apiFetch<ApiResponse<DecomposedItem[]>>(
    '/outfits/decompose',
    {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
  return result.data;
}

export async function getWeatherForLocation(
  lat: number,
  lon: number
): Promise<WeatherContext | null> {
  try {
    const result = await apiFetch<ApiResponse<WeatherContext>>(
      `/outfits/weather?lat=${lat}&lon=${lon}`
    );
    return result.data;
  } catch {
    // Weather is optional — never block on it
    return null;
  }
}

// ── Outfit Suggestions API ──────────────────────────────────

// ── Styling Intents ──────────────────────────────────────────

export const STYLING_INTENTS = [
  'default',
  'comfort-first',
  'make-statement',
  'blend-in',
  'push-style',
  'surprise-me',
] as const;
export type StylingIntent = (typeof STYLING_INTENTS)[number];

export const INTENT_DISPLAY: Record<StylingIntent, { label: string; icon: string; description: string }> = {
  'default': { label: 'Polished', icon: 'sparkles-outline', description: 'Balanced and put-together' },
  'comfort-first': { label: 'Comfort First', icon: 'bed-outline', description: 'Soft fabrics, relaxed fit' },
  'make-statement': { label: 'Make a Statement', icon: 'flame-outline', description: 'Bold colors, standout pieces' },
  'blend-in': { label: 'Blend In', icon: 'eye-off-outline', description: 'Neutrals, clean lines' },
  'push-style': { label: 'Push My Style', icon: 'trending-up-outline', description: 'Move toward your style goal' },
  'surprise-me': { label: 'Surprise Me', icon: 'dice-outline', description: 'Fresh combos, least-worn items' },
};

export interface SuggestOutfitsParams {
  occasion?: OccasionType | null;
  weather?: WeatherContext | null;
  lat?: number;
  lon?: number;
  mood?: MoodTag | null;
  style_shift_goal_id?: string | null;
  count?: number;
  intent?: StylingIntent;
}

export interface SuggestedOutfitItem {
  id: string;
  name: string;
  category: string;
  colors: string[];
  image_url: string | null;
  image_url_clean: string | null;
  formality_level: number;
  brand: string | null;
}

export interface SuggestedOutfit {
  id: string;
  name: string;
  items: SuggestedOutfitItem[];
  score: number;
  happiness_estimate: number;
  styling_note: string;
  hero_item_id: string;
  occasion: OccasionType | null;
  weather: WeatherContext | null;
  intent?: StylingIntent;
}

export interface SuggestOutfitsResponse {
  data: SuggestedOutfit[];
  error: null;
  message?: string;
}

export async function suggestOutfits(
  params: SuggestOutfitsParams
): Promise<SuggestOutfitsResponse> {
  return apiFetch<SuggestOutfitsResponse>('/outfits/suggest', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Swap Outfit Item API ─────────────────────────────────────

export interface SwapAlternative {
  id: string;
  name: string;
  category: string;
  colors: string[];
  image_url: string | null;
  image_url_clean: string | null;
  formality_level: number;
  brand: string | null;
  compatibility_score: number;
}

export interface SwapOutfitItemParams {
  keep_item_ids: string[];
  replace_slot: string;
  occasion?: OccasionType | null;
  weather?: WeatherContext | null;
}

export async function swapOutfitItem(
  params: SwapOutfitItemParams
): Promise<ApiResponse<SwapAlternative[]>> {
  return apiFetch<ApiResponse<SwapAlternative[]>>('/outfits/suggest/swap', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Preference Signal API ────────────────────────────────────

export interface EmitSignalParams {
  signal_type: string;
  item_id?: string | null;
  outfit_id?: string | null;
  value: Record<string, unknown>;
  context?: Record<string, unknown> | null;
}

export async function emitPreferenceSignal(
  signal: EmitSignalParams
): Promise<ApiResponse<{ success: boolean }>> {
  return apiFetch<ApiResponse<{ success: boolean }>>('/outfits/signals/emit', {
    method: 'POST',
    body: JSON.stringify(signal),
  });
}

// ── Dismiss Reasons ──────────────────────────────────────────

export const DISMISS_REASONS = [
  { key: 'too_formal', label: 'Too formal' },
  { key: 'too_casual', label: 'Too casual' },
  { key: 'wrong_colors', label: 'Wrong colors' },
  { key: 'not_my_style', label: 'Not my style' },
  { key: 'just_skip', label: 'Just skip' },
] as const;
export type DismissReason = (typeof DISMISS_REASONS)[number]['key'];

export interface TodayContext {
  user_name: string | null;
  weather: WeatherContext | null;
  time_of_day: 'morning' | 'afternoon' | 'evening';
  is_weekend: boolean;
  inferred_occasion: OccasionType;
  active_style_goal: {
    id: string;
    title: string;
    description: string;
    current_progress: number;
  } | null;
  wardrobe_item_count: number;
  date: string;
}

export async function getTodayContext(
  lat?: number,
  lon?: number,
  tzOffsetMinutes?: number
): Promise<ApiResponse<TodayContext>> {
  const params = new URLSearchParams();
  if (lat != null) params.set('lat', String(lat));
  if (lon != null) params.set('lon', String(lon));
  if (tzOffsetMinutes != null) params.set('tz_offset_minutes', String(tzOffsetMinutes));
  const qs = params.toString();
  return apiFetch<ApiResponse<TodayContext>>(
    `/outfits/today-context${qs ? `?${qs}` : ''}`
  );
}

// ── Marketplace API ─────────────────────────────────────────

export interface ListListingsParams {
  status?: ListingStatus;
  cursor?: string;
  limit?: number;
}

export async function listListings(
  params: ListListingsParams = {}
): Promise<PaginatedResponse<MarketplaceListing>> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<MarketplaceListing>>(
    `/marketplace/listings${qs ? `?${qs}` : ''}`
  );
}

export async function getListing(
  id: string
): Promise<ApiResponse<MarketplaceListing>> {
  return apiFetch<ApiResponse<MarketplaceListing>>(`/marketplace/listings/${id}`);
}

export async function createListing(
  listing: Record<string, unknown>
): Promise<ApiResponse<MarketplaceListing>> {
  return apiFetch<ApiResponse<MarketplaceListing>>('/marketplace/listings', {
    method: 'POST',
    body: JSON.stringify(listing),
  });
}

export async function updateListing(
  id: string,
  updates: Record<string, unknown>
): Promise<ApiResponse<MarketplaceListing>> {
  return apiFetch<ApiResponse<MarketplaceListing>>(`/marketplace/listings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function markListingSold(
  id: string,
  soldPrice: number
): Promise<ApiResponse<MarketplaceListing>> {
  return apiFetch<ApiResponse<MarketplaceListing>>(
    `/marketplace/listings/${id}/mark-sold`,
    {
      method: 'POST',
      body: JSON.stringify({ sold_price: soldPrice }),
    }
  );
}

export async function cancelListing(
  id: string
): Promise<ApiResponse<MarketplaceListing>> {
  return apiFetch<ApiResponse<MarketplaceListing>>(`/marketplace/listings/${id}`, {
    method: 'DELETE',
  });
}

export async function suggestPrice(
  wardrobeItemId: string
): Promise<ApiResponse<PriceSuggestion>> {
  return apiFetch<ApiResponse<PriceSuggestion>>('/marketplace/price-suggest', {
    method: 'POST',
    body: JSON.stringify({ wardrobe_item_id: wardrobeItemId }),
  });
}

export interface GeneratedListing {
  title: string;
  description: string;
  platform: string;
}

export async function generateListing(
  wardrobeItemId: string,
  platform: ListingPlatform,
  notes?: string
): Promise<ApiResponse<GeneratedListing>> {
  return apiFetch<ApiResponse<GeneratedListing>>('/marketplace/generate-listing', {
    method: 'POST',
    body: JSON.stringify({
      wardrobe_item_id: wardrobeItemId,
      platform,
      notes,
    }),
  });
}

// ── Stylist Chat API ────────────────────────────────────────

export interface ChatResponse {
  message: Message;
  conversation: Conversation;
}

export async function sendMessage(
  message: string,
  conversationId?: string
): Promise<ApiResponse<ChatResponse>> {
  return apiFetch<ApiResponse<ChatResponse>>('/stylist/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });
}

export async function listConversations(
  params: { cursor?: string; limit?: number } = {}
): Promise<PaginatedResponse<Conversation>> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<Conversation>>(
    `/stylist/conversations${qs ? `?${qs}` : ''}`
  );
}

export async function getMessages(
  conversationId: string,
  params: { cursor?: string; limit?: number } = {}
): Promise<PaginatedResponse<Message>> {
  const searchParams = new URLSearchParams();
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<Message>>(
    `/stylist/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`
  );
}

export async function deleteConversation(
  id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiFetch<ApiResponse<{ deleted: boolean }>>(
    `/stylist/conversations/${id}`,
    { method: 'DELETE' }
  );
}

// ── Wishlist API ──────────────────────────────────────────────

export interface ListWishlistItemsParams {
  status?: 'active' | 'purchased' | 'dismissed';
  priority?: WishlistPriority;
  sort?: 'happiness' | 'priority' | 'created_at' | 'price';
  cursor?: string;
  limit?: number;
}

export async function listWishlistItems(
  params: ListWishlistItemsParams = {}
): Promise<PaginatedResponse<WishlistItem>> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.sort) searchParams.set('sort', params.sort);
  if (params.cursor) searchParams.set('cursor', params.cursor);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  return apiFetch<PaginatedResponse<WishlistItem>>(
    `/wishlist/items${qs ? `?${qs}` : ''}`
  );
}

export async function getWishlistItem(
  id: string
): Promise<ApiResponse<WishlistItem>> {
  return apiFetch<ApiResponse<WishlistItem>>(`/wishlist/items/${id}`);
}

export interface CreateWishlistItemPayload {
  name: string;
  image_url?: string | null;
  source_url?: string | null;
  external_product_id?: string | null;
  price?: number | null;
  brand?: string | null;
  category?: ItemCategory | null;
  priority?: WishlistPriority;
  price_alert_threshold?: number | null;
}

export async function createWishlistItem(
  data: CreateWishlistItemPayload
): Promise<ApiResponse<WishlistItem>> {
  return apiFetch<ApiResponse<WishlistItem>>('/wishlist/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWishlistItem(
  id: string,
  updates: Partial<CreateWishlistItemPayload> & { status?: 'active' | 'purchased' | 'dismissed' }
): Promise<ApiResponse<WishlistItem>> {
  return apiFetch<ApiResponse<WishlistItem>>(`/wishlist/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteWishlistItem(
  id: string
): Promise<ApiResponse<WishlistItem>> {
  return apiFetch<ApiResponse<WishlistItem>>(`/wishlist/items/${id}`, {
    method: 'DELETE',
  });
}

export interface ScannedWishlistItem {
  name: string;
  brand: string | null;
  price: number | null;
  category: string | null;
  colors: string[];
  description: string;
}

export async function scanWishlistItem(
  imageUrl: string
): Promise<ApiResponse<ScannedWishlistItem>> {
  return apiFetch<ApiResponse<ScannedWishlistItem>>('/wishlist/items/scan', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl }),
  });
}

export async function getHappinessScore(
  itemId: string
): Promise<ApiResponse<HappinessScore>> {
  return apiFetch<ApiResponse<HappinessScore>>(
    `/wishlist/items/${itemId}/happiness`,
    { method: 'POST' }
  );
}

export async function dismissWishlistItem(
  id: string
): Promise<ApiResponse<WishlistItem>> {
  return apiFetch<ApiResponse<WishlistItem>>(
    `/wishlist/items/${id}/dismiss`,
    { method: 'POST' }
  );
}

// ── Wishlist Product Search ────────────────────────────────────

export interface WishlistSearchResponse {
  query: string;
  results: ProductSearchResult[];
}

export async function searchWishlistProducts(
  query: string,
  limit?: number
): Promise<ApiResponse<WishlistSearchResponse>> {
  return apiFetch<ApiResponse<WishlistSearchResponse>>('/wishlist/search', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  });
}

// ── Check a Purchase (Anti-Return) ────────────────────────────

export interface CheckPurchasePayload {
  name: string;
  price?: number | null;
  brand?: string | null;
  category?: ItemCategory | null;
  source_url?: string | null;
  image_url?: string | null;
  external_product_id?: string | null;
}

export interface PurchaseContext {
  recent_similar_checks: Array<{ name: string; brand: string | null; checked_at: string }>;
  dormant_similar_items: Array<{ name: string; brand: string | null; days_since_worn: number; times_worn: number }>;
  budget: { percent_spent: number; days_remaining: number; this_purchase_pushes_to: number } | null;
  style_shift: { goal_name: string; fills_gap: boolean; gap_category: string | null } | null;
}

export interface CheckPurchaseResponse {
  score: HappinessScore;
  item: WishlistItem;
  affiliate_url: string | null;
  context: PurchaseContext;
}

export async function checkPurchase(
  data: CheckPurchasePayload
): Promise<ApiResponse<CheckPurchaseResponse>> {
  return apiFetch<ApiResponse<CheckPurchaseResponse>>('/wishlist/check', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Budget API ────────────────────────────────────────────────

export interface BudgetCurrentResponse extends BudgetPeriod {
  remaining_amount: number;
  utilization_pct: number;
}

export async function getCurrentBudget(): Promise<
  ApiResponse<BudgetCurrentResponse | null>
> {
  return apiFetch<ApiResponse<BudgetCurrentResponse | null>>(
    '/wishlist/budget/current'
  );
}

export interface SetBudgetPayload {
  budget_amount: number;
  period_start: string;
  period_end: string;
}

export async function setBudget(
  data: SetBudgetPayload
): Promise<ApiResponse<BudgetPeriod>> {
  return apiFetch<ApiResponse<BudgetPeriod>>('/wishlist/budget/periods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateBudget(
  id: string,
  budgetAmount: number
): Promise<ApiResponse<BudgetPeriod>> {
  return apiFetch<ApiResponse<BudgetPeriod>>(
    `/wishlist/budget/periods/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ budget_amount: budgetAmount }),
    }
  );
}

// ── Onboarding / Auth Profile API ───────────────────────────

export interface UserProfile {
  user: User;
  style_profile: StyleProfile | null;
}

export async function getUserProfile(): Promise<ApiResponse<UserProfile>> {
  return apiFetch<ApiResponse<UserProfile>>('/auth/profile');
}

export interface CompleteOnboardingPayload {
  name: string;
  occasions?: string[];
  liked_styles?: string[];
  disliked_styles?: string[];
  color_season?: ColorSeason | null;
  skin_undertone?: 'warm' | 'cool' | 'neutral' | null;
  /** @deprecated Use occasions + liked_styles + disliked_styles instead */
  style_archetypes?: Record<string, number>;
}

export async function completeOnboarding(
  data: CompleteOnboardingPayload
): Promise<ApiResponse<{ onboarding_completed: boolean }>> {
  return apiFetch<ApiResponse<{ onboarding_completed: boolean }>>(
    '/auth/profile/onboarding',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export interface ColorAnalysisResult {
  color_season: ColorSeason;
  skin_undertone: 'warm' | 'cool' | 'neutral';
  best_colors: string[];
  color_swatches: string[];
  reasoning: string;
  confidence: number;
}

export async function analyzeColors(
  imageUrl: string
): Promise<ApiResponse<ColorAnalysisResult>> {
  return apiFetch<ApiResponse<ColorAnalysisResult>>(
    '/auth/profile/color-analysis',
    {
      method: 'POST',
      body: JSON.stringify({ image_url: imageUrl }),
    }
  );
}

// ── Style Dimensions API ────────────────────────────────────

export interface StyleDimensionsResponse {
  colorTemp: number;
  saturation: number;
  structure: number;
  complexity: number;
  formality: number;
  riskTolerance: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  archetypeName: string;
  traits: string[];
}

export async function getStyleDimensions(): Promise<ApiResponse<StyleDimensionsResponse>> {
  return apiFetch<ApiResponse<StyleDimensionsResponse>>('/auth/profile/style-dimensions');
}

// ── Style Shifting API ────────────────────────────────────────

export interface ArchetypePresetResponse {
  id: string;
  name: string;
  description: string;
  archetypes: Record<string, number>;
  signature: {
    colors: string[];
    materials: string[];
    patterns: string[];
    formality_range: [number, number];
    style_tags: string[];
    favored_categories: string[];
  };
}

export interface ClassifiedItem {
  item: {
    id: string;
    name: string;
    category: string;
    colors: string[];
    material: string | null;
    pattern: string;
    formality_level: number;
    image_url: string | null;
    image_url_clean: string | null;
    brand: string | null;
  };
  score: number;
  reason: string;
}

export interface ClassifiedWardrobe {
  target_aligned: ClassifiedItem[];
  bridge: ClassifiedItem[];
  neutral: ClassifiedItem[];
  phase_out: ClassifiedItem[];
}

export interface DimensionDelta {
  current: number;
  target: number;
  delta: number;
}

export interface PhaseScheduleItem {
  phase: number;
  label: string;
  weeks: string;
  blend_ratio: { current: number; target: number };
}

export interface StyleShiftGoal {
  id: string;
  user_id: string;
  goal_type: string;
  title: string;
  description: string;
  target_state: Record<string, unknown>;
  current_progress: number;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShiftResponse {
  goal: StyleShiftGoal;
  classification: ClassifiedWardrobe;
  dimension_deltas: Record<string, DimensionDelta>;
  phase_schedule: PhaseScheduleItem[];
  wardrobe_item_count: number;
  message?: string;
}

export interface ShiftAnalysisResponse {
  goal: StyleShiftGoal;
  classification: ClassifiedWardrobe;
  dimension_deltas: Record<string, DimensionDelta>;
  phase_schedule: PhaseScheduleItem[];
  progress_pct: number;
  wardrobe_item_count: number;
}

export interface BridgeOutfit {
  name: string;
  item_ids: string[];
  items: Array<{
    id: string;
    name: string;
    category: string;
    colors: string[];
    image_url: string | null;
    image_url_clean: string | null;
  }>;
  styling_note: string;
  target_score: number;
  comfort_score: number;
}

export interface ShoppingListItem {
  name: string;
  price: number;
  currency: string;
  source_url: string;
  image_url: string;
  retailer: string;
  category: string;
  outfit_unlock_estimate: number;
  happiness_prediction: number;
  leverage_score: number;
}

export interface ShoppingListResponse {
  shopping_list: ShoppingListItem[];
  total_investment: number;
  gaps_identified?: number;
  message?: string;
}

export async function getStylePresets(): Promise<ApiResponse<ArchetypePresetResponse[]>> {
  return apiFetch<ApiResponse<ArchetypePresetResponse[]>>('/style-goals/presets');
}

export async function createStyleShift(data: {
  target_preset_id?: string;
  target_description?: string;
  intensity: 'taste' | 'explore' | 'transform';
  title?: string;
}): Promise<ApiResponse<CreateShiftResponse>> {
  return apiFetch<ApiResponse<CreateShiftResponse>>('/style-goals/shift', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getShiftAnalysis(
  goalId: string
): Promise<ApiResponse<ShiftAnalysisResponse>> {
  return apiFetch<ApiResponse<ShiftAnalysisResponse>>(`/style-goals/${goalId}/analysis`);
}

export async function getBridgeOutfits(
  goalId: string,
  count: number = 5
): Promise<ApiResponse<{ outfits: BridgeOutfit[]; message?: string }>> {
  return apiFetch<ApiResponse<{ outfits: BridgeOutfit[]; message?: string }>>(
    `/style-goals/${goalId}/bridge-outfits`,
    {
      method: 'POST',
      body: JSON.stringify({ count }),
    }
  );
}

export async function getShiftShoppingList(
  goalId: string,
  maxItems: number = 5,
  budgetMax?: number
): Promise<ApiResponse<ShoppingListResponse>> {
  return apiFetch<ApiResponse<ShoppingListResponse>>(
    `/style-goals/${goalId}/shopping-list`,
    {
      method: 'POST',
      body: JSON.stringify({ max_items: maxItems, budget_max: budgetMax }),
    }
  );
}

// ── Aspiration Gap API ────────────────────────────────────────

export interface AspirationGapItem {
  archetype: string;
  actual: number;
  aspirational: number;
  delta: number;
  insight: string;
}

export interface AspirationGapResponse {
  actual_archetypes: Record<string, number>;
  aspirational_archetypes: Record<string, number>;
  gaps: AspirationGapItem[];
  summary: string;
  wardrobe_item_count: number;
}

export async function getAspirationGap(): Promise<ApiResponse<AspirationGapResponse>> {
  return apiFetch<ApiResponse<AspirationGapResponse>>('/auth/profile/aspiration-gap');
}

// ── Style Modes API ──────────────────────────────────────────

export interface StyleModesResponse {
  modes: Record<string, Record<string, number>>;
  source: 'stored' | 'computed' | 'empty';
}

export async function getStyleModes(): Promise<ApiResponse<StyleModesResponse>> {
  return apiFetch<ApiResponse<StyleModesResponse>>('/auth/profile/style-modes');
}

export async function updateStyleModes(
  modes: Record<string, Record<string, number>>
): Promise<ApiResponse<{ updated: boolean }>> {
  return apiFetch<ApiResponse<{ updated: boolean }>>('/auth/profile/style-modes', {
    method: 'PUT',
    body: JSON.stringify({ modes }),
  });
}

// ── Selectable Moods (subset of MoodTag for proactive selection UI) ──

export const SELECTABLE_MOODS = [
  'confident',
  'comfortable',
  'creative',
  'powerful',
  'relaxed',
] as const satisfies readonly MoodTag[];
export type MoodTagOption = (typeof SELECTABLE_MOODS)[number];

export const MOOD_DISPLAY: Record<MoodTagOption, { label: string; icon: string; color: string }> = {
  confident: { label: 'Confident', icon: 'shield-checkmark-outline', color: '#8B3A3A' },
  comfortable: { label: 'Comfy', icon: 'leaf-outline', color: '#6B8F71' },
  creative: { label: 'Creative', icon: 'color-palette-outline', color: '#B5783B' },
  powerful: { label: 'Powerful', icon: 'flash-outline', color: '#4A6FA5' },
  relaxed: { label: 'Relaxed', icon: 'water-outline', color: '#7B9EC4' },
};
