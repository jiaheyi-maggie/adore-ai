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
