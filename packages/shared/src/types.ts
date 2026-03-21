// ═══════════════════════════════════════════════════════════
// Adore — Core Domain Types
// ═══════════════════════════════════════════════════════════

// ── Enums ──────────────────────────────────────────────────

export const ITEM_CATEGORIES = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'accessories',
  'bags',
  'jewelry',
  'activewear',
  'swimwear',
  'sleepwear',
  'undergarments',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const PATTERNS = [
  'solid',
  'striped',
  'plaid',
  'floral',
  'graphic',
  'polka-dot',
  'animal-print',
  'geometric',
  'abstract',
  'other',
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const MATERIALS = [
  'cotton',
  'denim',
  'silk',
  'leather',
  'synthetic',
  'wool',
  'linen',
  'cashmere',
  'polyester',
  'nylon',
  'velvet',
  'suede',
  'knit',
  'other',
] as const;
export type Material = (typeof MATERIALS)[number];

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const ITEM_CONDITIONS = [
  'new',
  'like-new',
  'good',
  'fair',
  'worn',
] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const ITEM_STATUSES = [
  'active',
  'stored',
  'listed',
  'sold',
  'donated',
  'archived',
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_SOURCES = [
  'manual',
  'email',
  'outfit-journal',
  'receipt-scan',
] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

export const WISHLIST_PRIORITIES = ['need', 'want', 'dream'] as const;
export type WishlistPriority = (typeof WISHLIST_PRIORITIES)[number];

export const MOOD_TAGS = [
  'confident',
  'comfortable',
  'creative',
  'powerful',
  'relaxed',
  'overdressed',
  'underdressed',
  'meh',
] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

export const OCCASION_TYPES = [
  'work',
  'casual',
  'date-night',
  'formal-event',
  'workout',
  'travel',
  'interview',
  'wedding-guest',
  'brunch',
  'night-out',
  'wfh',
  'errand',
] as const;
export type OccasionType = (typeof OCCASION_TYPES)[number];

export const SIGNAL_TYPES = [
  'wore',
  'rated',
  'purchased',
  'returned',
  'skipped',
  'wishlisted',
  'sold',
  'searched',
  'tried-on',
  'photographed',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const MEMORY_TYPES = [
  'working',
  'episodic',
  'semantic',
  'procedural',
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const COLOR_SEASONS = [
  'spring-light',
  'spring-warm',
  'spring-clear',
  'summer-light',
  'summer-cool',
  'summer-soft',
  'autumn-warm',
  'autumn-deep',
  'autumn-soft',
  'winter-cool',
  'winter-deep',
  'winter-clear',
] as const;
export type ColorSeason = (typeof COLOR_SEASONS)[number];

// ── Core Entities ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  budget_monthly: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface StyleProfile {
  id: string;
  user_id: string;
  color_season: ColorSeason | null;
  skin_undertone: 'warm' | 'cool' | 'neutral' | null;
  style_archetypes: Record<string, number>; // e.g. { minimalist: 0.4, classic: 0.3 }
  color_preferences: Record<string, number>; // e.g. { navy: 0.9, black: 0.8 }
  formality_distribution: number[]; // [casual%, smart-casual%, business%, formal%, black-tie%]
  brand_affinities: Record<string, number>;
  price_range: { min: number; max: number; sweet_spot: number };
  avoided_styles: string[];
  body_metrics: Record<string, number> | null;
  taste_vector: number[] | null; // aggregated embedding
  updated_at: string;
}

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: ItemCategory;
  subcategory: string | null;
  colors: string[];
  pattern: Pattern;
  material: Material | null;
  brand: string | null;
  size: string | null;
  formality_level: number; // 1-5
  seasons: Season[];
  condition: ItemCondition;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  image_url: string | null;
  image_url_clean: string | null; // background removed
  times_worn: number;
  cost_per_wear: number | null;
  happiness_score: number | null;
  versatility_score: number | null;
  status: ItemStatus;
  source: ItemSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemEmbedding {
  id: string;
  item_id: string;
  embedding: number[]; // 512-dim FashionSigLIP
  model_version: string;
  created_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  occasion: OccasionType | null;
  weather_context: WeatherContext | null;
  source: 'generated' | 'journaled' | 'saved' | 'aspirational';
  happiness_score: number | null;
  mood_tag: MoodTag | null;
  worn_date: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  wardrobe_item_id: string | null;
  external_product_id: string | null;
  layer_position: number; // ordering within the outfit
  is_owned: boolean;
}

export interface PreferenceSignal {
  id: string;
  user_id: string;
  signal_type: SignalType;
  item_id: string | null;
  outfit_id: string | null;
  value: Record<string, unknown>; // flexible payload
  context: Record<string, unknown> | null; // weather, occasion, etc.
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  name: string;
  image_url: string | null;
  source_url: string | null;
  price: number | null;
  brand: string | null;
  category: ItemCategory | null;
  priority: WishlistPriority;
  happiness_score_prediction: number | null;
  similar_owned_count: number;
  versatility_impact: number | null;
  status: 'active' | 'purchased' | 'dismissed';
  price_alert_threshold: number | null;
  created_at: string;
  updated_at: string;
}

export interface AgentMemory {
  id: string;
  user_id: string;
  memory_type: MemoryType;
  content: string;
  embedding: number[] | null;
  importance_score: number;
  access_count: number;
  last_accessed_at: string;
  superseded_by: string | null;
  created_at: string;
}

export interface BudgetPeriod {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  budget_amount: number;
  spent_amount: number;
  happiness_per_dollar: number | null;
  impulse_buy_count: number;
  planned_buy_count: number;
}

export interface ExternalProduct {
  id: string;
  name: string;
  brand: string | null;
  category: ItemCategory | null;
  price: number;
  image_url: string;
  source_url: string;
  affiliate_url: string | null;
  retailer: string;
  attributes: Record<string, unknown>;
  embedding: number[] | null;
  last_checked_at: string;
  created_at: string;
}

export interface StyleGoal {
  id: string;
  user_id: string;
  goal_type: string; // 'capsule-wardrobe', 'build-collection', 'aesthetic-shift', etc.
  title: string;
  description: string;
  target_state: Record<string, unknown>;
  current_progress: number; // 0-100
  deadline: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  created_at: string;
  updated_at: string;
}

// ── Happiness Function ─────────────────────────────────────

export interface HappinessScore {
  overall: number; // 0-10
  breakdown: {
    wear_frequency_prediction: number;
    versatility_score: number;
    aspiration_alignment: number;
    budget_impact: number;
    uniqueness_in_wardrobe: number;
    emotional_prediction: number;
    cost_per_wear_projection: number;
    seasonal_relevance: number;
  };
  confidence: number; // 0-1, how much data backs this prediction
  reasoning: string; // human-readable explanation
  flags: HappinessFlag[];
}

export interface HappinessFlag {
  type: 'impulse-warning' | 'duplicate-alert' | 'budget-exceeded' | 'goal-aligned' | 'goal-conflict' | 'high-return-risk';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface HappinessWeights {
  user_id: string;
  w_wear_frequency: number;
  w_versatility: number;
  w_aspiration: number;
  w_budget: number;
  w_uniqueness: number;
  w_emotional: number;
  w_cost_per_wear: number;
  w_seasonal: number;
  updated_at: string;
}

// ── Weather & Context ──────────────────────────────────────

export interface WeatherContext {
  temperature_f: number;
  feels_like_f: number;
  humidity: number;
  precipitation_chance: number;
  uv_index: number;
  wind_speed_mph: number;
  condition: string; // 'sunny', 'cloudy', 'rain', etc.
}

export interface OutfitRequest {
  occasion: OccasionType;
  weather: WeatherContext | null;
  time_constraint_minutes: number | null; // null = no rush
  mood: string | null;
  specific_item_id: string | null; // "style this piece"
  include_purchasable: boolean;
  budget_remaining: number | null;
}

export interface OutfitSuggestion {
  outfit: Outfit;
  items: OutfitItem[];
  happiness_score: HappinessScore;
  styling_notes: string;
  missing_pieces: ExternalProduct[]; // items to buy
  total_new_cost: number | null;
}

// ── Email Ingestion ────────────────────────────────────────

export interface ParsedPurchase {
  retailer: string;
  order_date: string;
  items: {
    name: string;
    category: ItemCategory | null;
    color: string | null;
    size: string | null;
    price: number;
    product_url: string | null;
  }[];
  total: number;
  order_number: string | null;
  confidence: number; // 0-1
}

// ── Analytics ──────────────────────────────────────────────

export interface MonthlyHappinessReport {
  period: string; // YYYY-MM
  avg_happiness_score: number;
  best_performer: { item: WardrobeItem; score: number };
  worst_performer: { item: WardrobeItem; score: number };
  total_spent: number;
  happiness_per_dollar: number;
  impulse_buy_count: number;
  planned_buy_count: number;
  items_worn_count: number;
  items_never_worn_count: number;
  top_outfits: Outfit[];
  wardrobe_gaps: string[];
  trend_vs_last_month: {
    happiness: number; // delta
    spending: number;
    efficiency: number;
  };
}

export interface WardrobeAnalytics {
  total_items: number;
  category_breakdown: Record<ItemCategory, number>;
  color_distribution: Record<string, number>;
  avg_cost_per_wear: number;
  total_wardrobe_value: number;
  items_never_worn: number;
  items_worn_once: number;
  versatility_top_10: WardrobeItem[];
  versatility_bottom_10: WardrobeItem[];
  seasonal_readiness: Record<Season, number>; // 0-100 score
}
