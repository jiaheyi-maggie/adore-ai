import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import {
  OCCASION_TYPES,
  SEASONS,
  ITEM_CATEGORIES,
  SIGNAL_TYPES,
  type OccasionType,
  type WeatherContext,
  type WardrobeItem,
  type Season,
  type ItemCategory,
  type SignalType,
} from '@adore/shared';
import type { AppVariables } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { getWeather } from '../lib/weather';

const outfitSuggest = new Hono<{ Variables: AppVariables }>();
outfitSuggest.use('*', authMiddleware);

// ── Styling Intents ──────────────────────────────────────────

const STYLING_INTENTS = [
  'default',
  'comfort-first',
  'make-statement',
  'blend-in',
  'push-style',
  'surprise-me',
] as const;
type StylingIntent = (typeof STYLING_INTENTS)[number];

// ── Validation ────────────────────────────────────────────────

const suggestSchema = z.object({
  occasion: z.enum(OCCASION_TYPES).nullable().optional(),
  weather: z
    .object({
      temperature_f: z.number(),
      feels_like_f: z.number(),
      humidity: z.number(),
      precipitation_chance: z.number(),
      uv_index: z.number(),
      wind_speed_mph: z.number(),
      condition: z.string(),
    })
    .nullable()
    .optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  mood: z.string().max(100).nullable().optional(),
  style_shift_goal_id: z.string().uuid().nullable().optional(),
  count: z.number().int().min(1).max(10).default(3),
  intent: z.enum(STYLING_INTENTS).default('default'),
});

const swapSchema = z.object({
  keep_item_ids: z.array(z.string().uuid()).min(1),
  replace_slot: z.enum(ITEM_CATEGORIES),
  occasion: z.enum(OCCASION_TYPES).nullable().optional(),
  weather: z
    .object({
      temperature_f: z.number(),
      feels_like_f: z.number(),
      humidity: z.number(),
      precipitation_chance: z.number(),
      uv_index: z.number(),
      wind_speed_mph: z.number(),
      condition: z.string(),
    })
    .nullable()
    .optional(),
});

const signalEmitSchema = z.object({
  signal_type: z.enum(SIGNAL_TYPES),
  item_id: z.string().uuid().nullable().optional(),
  outfit_id: z.string().uuid().nullable().optional(),
  value: z.record(z.unknown()),
  context: z.record(z.unknown()).nullable().optional(),
});

const todayContextSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  tz_offset_minutes: z.coerce.number().min(-720).max(840).optional(),
});

// ── Color Harmony ─────────────────────────────────────────────

const COLOR_FAMILIES: Record<string, string[]> = {
  neutral: ['black', 'white', 'grey', 'gray', 'cream', 'beige', 'ivory', 'tan', 'khaki', 'taupe', 'oatmeal', 'charcoal'],
  warm: ['red', 'orange', 'yellow', 'gold', 'rust', 'terracotta', 'coral', 'peach', 'amber', 'burgundy', 'wine', 'maroon', 'mustard', 'camel', 'brown', 'chocolate', 'espresso', 'coffee'],
  cool: ['blue', 'navy', 'cobalt', 'teal', 'turquoise', 'green', 'sage', 'olive', 'forest', 'emerald', 'purple', 'lavender', 'plum', 'violet', 'lilac', 'mint'],
  pastel: ['blush', 'pink', 'powder blue', 'light blue', 'soft pink', 'rose', 'mauve', 'dusty rose', 'salmon'],
};

function getColorFamily(color: string): string {
  const lower = color.toLowerCase().trim();
  for (const [family, colors] of Object.entries(COLOR_FAMILIES)) {
    if (colors.some((c) => lower.includes(c) || c.includes(lower))) {
      return family;
    }
  }
  return 'neutral'; // unknown colors treated as neutral
}

function colorHarmonyScore(colorsA: string[], colorsB: string[]): number {
  if (colorsA.length === 0 || colorsB.length === 0) return 0.5;

  const familiesA = new Set(colorsA.map(getColorFamily));
  const familiesB = new Set(colorsB.map(getColorFamily));

  // Neutrals go with everything
  if (familiesA.has('neutral') || familiesB.has('neutral')) return 0.8;

  // Same family = cohesive
  let overlap = 0;
  for (const f of familiesA) {
    if (familiesB.has(f)) overlap++;
  }
  if (overlap > 0) return 0.9;

  // Warm + cool can work if one is neutral-adjacent
  if (familiesA.has('warm') && familiesB.has('cool')) return 0.4;
  if (familiesA.has('cool') && familiesB.has('warm')) return 0.4;

  return 0.5;
}

// ── Season Helpers ────────────────────────────────────────────

function getCurrentSeason(now?: Date): Season {
  const month = (now ?? new Date()).getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function itemMatchesSeason(item: WardrobeItem, season: Season): boolean {
  if (!item.seasons || item.seasons.length === 0) return true; // no season data = all seasons
  return (item.seasons as Season[]).includes(season);
}

// ── Formality Mapping ─────────────────────────────────────────

const OCCASION_FORMALITY: Record<OccasionType, [number, number]> = {
  'work': [3, 4],
  'casual': [1, 2],
  'date-night': [3, 4],
  'formal-event': [4, 5],
  'workout': [1, 1],
  'travel': [1, 3],
  'interview': [4, 5],
  'wedding-guest': [4, 5],
  'brunch': [2, 3],
  'night-out': [3, 4],
  'wfh': [1, 2],
  'errand': [1, 2],
};

function formalityMatch(itemFormality: number, occasionRange: [number, number]): number {
  const [low, high] = occasionRange;
  if (itemFormality >= low && itemFormality <= high) return 1.0;
  const distance = itemFormality < low ? low - itemFormality : itemFormality - high;
  if (distance === 1) return 0.5;
  return 0.1;
}

// ── Weather Appropriateness ───────────────────────────────────

function weatherScore(item: WardrobeItem, weather: WeatherContext): number {
  let score = 0.7; // baseline

  const temp = weather.temperature_f;

  // Temperature checks
  if (temp < 40) {
    // Cold — favor outerwear, knits, layers
    if (item.category === 'outerwear') score += 0.3;
    if (item.material === 'wool' || item.material === 'cashmere' || item.material === 'knit') score += 0.2;
    if (item.category === 'swimwear' || item.category === 'activewear') score -= 0.5;
  } else if (temp < 60) {
    // Cool — layers welcome
    if (item.category === 'outerwear') score += 0.1;
    if (item.material === 'cotton' || item.material === 'denim') score += 0.1;
  } else if (temp > 80) {
    // Hot — light fabrics
    if (item.material === 'linen' || item.material === 'cotton') score += 0.2;
    if (item.category === 'outerwear') score -= 0.3;
    if (item.material === 'wool' || item.material === 'cashmere' || item.material === 'knit') score -= 0.4;
  }

  // Rain check
  if (weather.precipitation_chance > 50) {
    if (item.material === 'suede' || item.material === 'silk') score -= 0.3;
    if (item.material === 'synthetic' || item.material === 'nylon') score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

// ── Category Pairing Rules ────────────────────────────────────

type OutfitSlot = 'top' | 'bottom' | 'outerwear' | 'shoes' | 'accessory';

const CATEGORY_TO_SLOT: Record<ItemCategory, OutfitSlot | null> = {
  tops: 'top',
  bottoms: 'bottom',
  dresses: 'top', // dresses fill both top + bottom
  outerwear: 'outerwear',
  shoes: 'shoes',
  accessories: 'accessory',
  bags: 'accessory',
  jewelry: 'accessory',
  activewear: 'top',
  swimwear: null,
  sleepwear: null,
  undergarments: null,
};

// ── Intent-Based Weight Profiles ─────────────────────────────

interface ScoringWeights {
  color: number;
  formality: number;
  occasion: number;
  pattern: number;
  recency: number;
  weather: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  color: 0.2,
  formality: 0.15,
  occasion: 0.2,
  pattern: 0.1,
  recency: 0.15,
  weather: 0.2,
};

function getIntentWeights(intent: StylingIntent): ScoringWeights {
  switch (intent) {
    case 'comfort-first':
      return { color: 0.1, formality: 0.1, occasion: 0.1, pattern: 0.1, recency: 0.2, weather: 0.4 };
    case 'make-statement':
      return { color: 0.35, formality: 0.1, occasion: 0.15, pattern: 0.15, recency: 0.05, weather: 0.2 };
    case 'blend-in':
      return { color: 0.1, formality: 0.2, occasion: 0.35, pattern: 0.15, recency: 0.1, weather: 0.1 };
    case 'push-style':
      return { color: 0.15, formality: 0.1, occasion: 0.15, pattern: 0.1, recency: 0.1, weather: 0.15 };
    case 'surprise-me':
      return { color: 0.15, formality: 0.1, occasion: 0.1, pattern: 0.15, recency: 0.05, weather: 0.15 };
    case 'default':
    default:
      return DEFAULT_WEIGHTS;
  }
}

// Intent-specific item scoring modifiers
const NEUTRAL_COLORS = new Set(['black', 'navy', 'cream', 'grey', 'gray', 'white', 'beige', 'charcoal', 'khaki', 'tan', 'taupe']);
const COMFORT_MATERIALS = new Set(['cotton', 'knit', 'cashmere', 'linen']);

function intentItemBonus(item: WardrobeItem, intent: StylingIntent, recentWornIds: Set<string>): number {
  let bonus = 0;

  switch (intent) {
    case 'comfort-first':
      if (item.material && COMFORT_MATERIALS.has(item.material)) bonus += 0.15;
      if (item.formality_level <= 2) bonus += 0.1;
      if (recentWornIds.has(item.id)) bonus += 0.05; // favorites are comforting
      break;

    case 'make-statement':
      // Prefer bold/contrasting, avoid recently worn
      if (item.colors.length > 0 && !NEUTRAL_COLORS.has(item.colors[0].toLowerCase())) bonus += 0.15;
      if (item.pattern !== 'solid') bonus += 0.1;
      if (recentWornIds.has(item.id)) bonus -= 0.2;
      break;

    case 'blend-in':
      // Prefer neutrals and solids
      if (item.colors.every((c) => NEUTRAL_COLORS.has(c.toLowerCase()))) bonus += 0.2;
      if (item.pattern === 'solid') bonus += 0.15;
      break;

    case 'push-style':
      // Bias toward items with higher versatility (they bridge styles)
      if (item.versatility_score != null && item.versatility_score >= 7) bonus += 0.15;
      break;

    case 'surprise-me':
      // Prefer least-worn items
      if (item.times_worn <= 2) bonus += 0.2;
      if (!recentWornIds.has(item.id)) bonus += 0.1;
      // Random spice
      bonus += Math.random() * 0.15;
      break;
  }

  return bonus;
}

// ── Outfit Generation (Hero Piece Heuristic) ──────────────────

interface ScoredOutfit {
  items: WardrobeItem[];
  score: number;
  hero_item_id: string;
}

function scoreOutfitCombination(
  items: WardrobeItem[],
  occasion: OccasionType | null,
  weather: WeatherContext | null,
  recentWornIds: Set<string>,
  intent: StylingIntent = 'default'
): number {
  if (items.length < 2) return 0;

  const weights = getIntentWeights(intent);

  let totalScore = 0;
  let components = 0;

  // 1. Color harmony — pairwise between all items
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      totalScore += colorHarmonyScore(items[i].colors, items[j].colors);
      components++;
    }
  }
  const colorScore = components > 0 ? totalScore / components : 0.5;

  // 2. Formality consistency
  const formalities = items.map((i) => i.formality_level);
  const avgFormality = formalities.reduce((a, b) => a + b, 0) / formalities.length;
  const formalitySpread = Math.max(...formalities) - Math.min(...formalities);
  let formalityConsistency = formalitySpread <= 1 ? 1.0 : formalitySpread <= 2 ? 0.6 : 0.2;

  // comfort-first: lower target formality by 1
  if (intent === 'comfort-first' && occasion) {
    const range = OCCASION_FORMALITY[occasion];
    const lowered: [number, number] = [Math.max(1, range[0] - 1), Math.max(1, range[1] - 1)];
    formalityConsistency = formalityMatch(Math.round(avgFormality), lowered);
  }

  // 3. Occasion formality fit
  let occasionScore = 0.7; // neutral default
  if (occasion) {
    const range = OCCASION_FORMALITY[occasion];
    if (intent === 'blend-in') {
      // Must match formality exactly
      occasionScore = Math.round(avgFormality) >= range[0] && Math.round(avgFormality) <= range[1] ? 1.0 : 0.2;
    } else {
      occasionScore = formalityMatch(Math.round(avgFormality), range);
    }
  }

  // 4. Style coherence — check if items share similar style tags via material + pattern
  const patterns = items.map((i) => i.pattern);
  const uniquePatterns = new Set(patterns);
  let patternCohesion = uniquePatterns.size <= 2 ? 1.0 : uniquePatterns.size <= 3 ? 0.6 : 0.3;
  // blend-in: prefer all solids
  if (intent === 'blend-in') {
    const allSolid = patterns.every((p) => p === 'solid');
    patternCohesion = allSolid ? 1.0 : patternCohesion * 0.5;
  }

  // 5. Recency penalty — avoid items worn in last 3 days
  const recentCount = items.filter((i) => recentWornIds.has(i.id)).length;
  let recencyPenalty = recentCount === 0 ? 1.0 : recentCount === 1 ? 0.7 : 0.3;
  // make-statement: heavily penalize recent items
  if (intent === 'make-statement' && recentCount > 0) recencyPenalty *= 0.5;

  // 6. Weather appropriateness
  let weatherAvg = 0.7;
  if (weather) {
    const scores = items.map((i) => weatherScore(i, weather));
    weatherAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // 7. Intent item bonuses
  const intentBonus = items.reduce((sum, item) => sum + intentItemBonus(item, intent, recentWornIds), 0) / items.length;

  // Composite score (weighted by intent)
  const composite =
    colorScore * weights.color +
    formalityConsistency * weights.formality +
    occasionScore * weights.occasion +
    patternCohesion * weights.pattern +
    recencyPenalty * weights.recency +
    weatherAvg * weights.weather +
    intentBonus * 0.15; // intent bonus is additive, capped at ~0.15

  return Math.round(Math.min(1, composite) * 100) / 100;
}

function generateOutfits(
  wardrobeItems: WardrobeItem[],
  occasion: OccasionType | null,
  weather: WeatherContext | null,
  recentWornIds: Set<string>,
  count: number,
  intent: StylingIntent = 'default'
): ScoredOutfit[] {
  const season = getCurrentSeason();

  // Filter by season and active status
  const eligible = wardrobeItems.filter(
    (item) =>
      item.status === 'active' &&
      itemMatchesSeason(item, season) &&
      CATEGORY_TO_SLOT[item.category] !== null
  );

  // Bucket items by slot
  const bySlot: Record<OutfitSlot, WardrobeItem[]> = {
    top: [],
    bottom: [],
    outerwear: [],
    shoes: [],
    accessory: [],
  };

  const dresses: WardrobeItem[] = [];

  for (const item of eligible) {
    if (item.category === 'dresses') {
      dresses.push(item);
      continue;
    }
    const slot = CATEGORY_TO_SLOT[item.category];
    if (slot) {
      bySlot[slot].push(item);
    }
  }

  // Filter by occasion formality if provided
  const formalityRange = occasion ? OCCASION_FORMALITY[occasion] : null;

  function formalityOk(item: WardrobeItem): boolean {
    if (!formalityRange) return true;
    const distance = item.formality_level < formalityRange[0]
      ? formalityRange[0] - item.formality_level
      : item.formality_level > formalityRange[1]
        ? item.formality_level - formalityRange[1]
        : 0;
    return distance <= 1; // allow 1 level of slack
  }

  // Score hero candidates: prefer least recently worn + highest versatility
  function heroScore(item: WardrobeItem): number {
    let s = 0;
    if (!recentWornIds.has(item.id)) s += 2;
    s += (item.versatility_score ?? 5) / 10;
    // Slight randomness for variety
    s += Math.random() * 0.3;

    // Intent-specific hero selection
    if (intent === 'surprise-me') {
      // Prefer least-worn items as hero pieces
      s += Math.max(0, (5 - item.times_worn) / 5);
      s += Math.random() * 0.5; // extra randomness
    } else if (intent === 'make-statement') {
      // Prefer bold-colored items as heroes
      if (item.colors.length > 0 && !NEUTRAL_COLORS.has(item.colors[0].toLowerCase())) s += 1;
      if (item.pattern !== 'solid') s += 0.5;
    } else if (intent === 'comfort-first') {
      if (item.material && COMFORT_MATERIALS.has(item.material)) s += 0.8;
    }

    return s;
  }

  // Pick best candidate from a slot, excluding already-used items
  function pickBest(
    candidates: WardrobeItem[],
    usedIds: Set<string>,
    heroItem: WardrobeItem
  ): WardrobeItem | null {
    const valid = candidates
      .filter((c) => !usedIds.has(c.id) && formalityOk(c))
      .map((c) => ({
        item: c,
        score:
          colorHarmonyScore(heroItem.colors, c.colors) * 0.5 +
          (Math.abs(c.formality_level - heroItem.formality_level) <= 1 ? 0.3 : 0) +
          (!recentWornIds.has(c.id) ? 0.2 : 0) +
          intentItemBonus(c, intent, recentWornIds),
      }))
      .sort((a, b) => b.score - a.score);

    return valid[0]?.item ?? null;
  }

  const results: ScoredOutfit[] = [];
  const usedHeroIds = new Set<string>();

  // Generate outfits by picking different hero pieces
  const heroPool = [
    ...bySlot.top.filter(formalityOk),
    ...dresses.filter(formalityOk),
    ...bySlot.bottom.filter(formalityOk),
  ].sort((a, b) => heroScore(b) - heroScore(a));

  for (const hero of heroPool) {
    if (results.length >= count) break;
    if (usedHeroIds.has(hero.id)) continue;

    const outfitItems: WardrobeItem[] = [hero];
    const usedIds = new Set([hero.id]);
    const isDress = hero.category === 'dresses';

    // If hero is a dress, skip top + bottom
    if (!isDress) {
      const heroSlot = CATEGORY_TO_SLOT[hero.category];

      if (heroSlot === 'top') {
        // Need a bottom
        const bottom = pickBest(bySlot.bottom, usedIds, hero);
        if (!bottom) continue; // can't make an outfit without a bottom
        outfitItems.push(bottom);
        usedIds.add(bottom.id);
      } else if (heroSlot === 'bottom') {
        // Need a top
        const top = pickBest(bySlot.top, usedIds, hero);
        if (!top) continue;
        outfitItems.push(top);
        usedIds.add(top.id);
      }
    }

    // Optional: outerwear (if weather is cold or cool)
    if (weather && weather.temperature_f < 65 && bySlot.outerwear.length > 0) {
      const outer = pickBest(bySlot.outerwear, usedIds, hero);
      if (outer) {
        outfitItems.push(outer);
        usedIds.add(outer.id);
      }
    }

    // Optional: shoes
    if (bySlot.shoes.length > 0) {
      const shoes = pickBest(bySlot.shoes, usedIds, hero);
      if (shoes) {
        outfitItems.push(shoes);
        usedIds.add(shoes.id);
      }
    }

    // Optional: one accessory
    if (bySlot.accessory.length > 0) {
      const acc = pickBest(bySlot.accessory, usedIds, hero);
      if (acc) {
        outfitItems.push(acc);
        usedIds.add(acc.id);
      }
    }

    // Score the full combination
    const score = scoreOutfitCombination(outfitItems, occasion, weather, recentWornIds, intent);

    results.push({ items: outfitItems, score, hero_item_id: hero.id });
    usedHeroIds.add(hero.id);
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, count);
}

// ── Styling Note Generation (Gemini) ──────────────────────────

async function generateStylingNote(
  items: WardrobeItem[],
  occasion: OccasionType | null,
  weather: WeatherContext | null
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return generateTemplateStylingNote(items, occasion);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const itemList = items
      .map((i) => `${i.name} (${i.category}, ${i.colors.join('/')})`)
      .join(', ');

    const prompt = `You are a concise fashion stylist. Write a 1-2 sentence styling note for this outfit: ${itemList}.${occasion ? ` Occasion: ${occasion}.` : ''}${weather ? ` Weather: ${weather.temperature_f}°F, ${weather.condition}.` : ''} Be specific about why these pieces work together. No markdown, plain text only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim();
    if (text && text.length > 10) return text;
  } catch {
    // Fall through to template
  }

  return generateTemplateStylingNote(items, occasion);
}

function generateTemplateStylingNote(
  items: WardrobeItem[],
  occasion: OccasionType | null
): string {
  const colors = [...new Set(items.flatMap((i) => i.colors))].slice(0, 3);
  const colorStr = colors.length > 0 ? colors.join(' and ') : 'complementary';
  const occasionStr = occasion ? ` for ${occasion.replace('-', ' ')}` : '';
  return `A cohesive look with ${colorStr} tones${occasionStr}. The pieces share a consistent formality level for a polished result.`;
}

// ── Outfit Name Generator ─────────────────────────────────────

function generateOutfitName(items: WardrobeItem[], occasion: OccasionType | null): string {
  const heroItem = items[0];
  const primaryColor = heroItem.colors[0] ?? '';
  const heroName = heroItem.name.split(' ').slice(0, 2).join(' ');

  if (occasion) {
    const occasionLabel = occasion.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return `${occasionLabel}: ${primaryColor ? primaryColor.charAt(0).toUpperCase() + primaryColor.slice(1) + ' ' : ''}${heroName}`;
  }

  return `${primaryColor ? primaryColor.charAt(0).toUpperCase() + primaryColor.slice(1) + ' ' : ''}${heroName} Look`;
}

// ── POST /outfits/suggest ─────────────────────────────────────

outfitSuggest.post('/suggest', zValidator('json', suggestSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // 1. Fetch wardrobe items
  const { data: wardrobeItems, error: wardrobeError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('status', 'active')
    .limit(500);

  if (wardrobeError) {
    return c.json(
      { data: null, error: { code: 'QUERY_FAILED', message: wardrobeError.message } },
      400
    );
  }

  const items = (wardrobeItems ?? []) as WardrobeItem[];

  if (items.length === 0) {
    return c.json({
      data: [],
      error: null,
      message: 'No wardrobe items found. Add items to get outfit suggestions.',
    });
  }

  // 2. Fetch style profile
  const { data: styleProfile } = await supabase
    .from('style_profiles')
    .select('style_archetypes, color_preferences, formality_distribution')
    .eq('user_id', userId)
    .single();

  // 3. Resolve weather
  let weather = body.weather ?? null;
  if (!weather && body.lat != null && body.lon != null) {
    weather = await getWeather(body.lat, body.lon);
  }

  // 4. Get recently worn items (last 3 days)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

  const { data: recentOutfits } = await supabase
    .from('outfits')
    .select('outfit_items(wardrobe_item_id)')
    .gte('worn_date', threeDaysAgoStr);

  const recentWornIds = new Set<string>();
  if (recentOutfits) {
    for (const outfit of recentOutfits) {
      const outfitItems = (outfit as Record<string, unknown>).outfit_items as Array<{
        wardrobe_item_id: string | null;
      }> | null;
      if (outfitItems) {
        for (const oi of outfitItems) {
          if (oi.wardrobe_item_id) recentWornIds.add(oi.wardrobe_item_id);
        }
      }
    }
  }

  // 5. Generate outfits using hero-piece heuristic
  const outfits = generateOutfits(
    items,
    body.occasion ?? null,
    weather,
    recentWornIds,
    body.count,
    body.intent
  );

  if (outfits.length === 0) {
    return c.json({
      data: [],
      error: null,
      message: 'Could not generate outfit combinations. You may need more variety in your wardrobe (tops + bottoms).',
    });
  }

  // 6. Generate styling notes in parallel (with timeout)
  const suggestions = await Promise.all(
    outfits.map(async (outfit) => {
      const stylingNote = await Promise.race([
        generateStylingNote(outfit.items, body.occasion ?? null, weather),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve(generateTemplateStylingNote(outfit.items, body.occasion ?? null)), 5000)
        ),
      ]);

      // Compute a simplified happiness score for the outfit
      const avgFormality = outfit.items.reduce((s, i) => s + i.formality_level, 0) / outfit.items.length;
      const happinessEstimate = Math.round(outfit.score * 10 * 10) / 10; // scale 0-1 to 0-10

      return {
        id: crypto.randomUUID(),
        name: generateOutfitName(outfit.items, body.occasion ?? null),
        items: outfit.items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          colors: item.colors,
          image_url: item.image_url,
          image_url_clean: item.image_url_clean,
          formality_level: item.formality_level,
          brand: item.brand,
        })),
        score: outfit.score,
        happiness_estimate: Math.min(10, Math.max(0, happinessEstimate)),
        styling_note: stylingNote,
        hero_item_id: outfit.hero_item_id,
        occasion: body.occasion ?? null,
        weather: weather,
        intent: body.intent,
      };
    })
  );

  return c.json({ data: suggestions, error: null });
});

// ── GET /outfits/today-context ────────────────────────────────

outfitSuggest.get('/today-context', zValidator('query', todayContextSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const query = c.req.valid('query');

  // 1. Weather (if location provided)
  let weather: WeatherContext | null = null;
  if (query.lat != null && query.lon != null) {
    weather = await getWeather(query.lat, query.lon);
  }

  // 2. Time-based context (offset to user's local timezone)
  const tzOffset = query.tz_offset_minutes ?? 0;
  const now = new Date(Date.now() - tzOffset * 60 * 1000);
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let timeOfDay: 'morning' | 'afternoon' | 'evening';
  if (hour < 12) timeOfDay = 'morning';
  else if (hour < 17) timeOfDay = 'afternoon';
  else timeOfDay = 'evening';

  // Infer occasion from time + day
  let inferredOccasion: OccasionType;
  if (isWeekend) {
    if (hour < 10) inferredOccasion = 'casual';
    else if (hour < 14) inferredOccasion = 'brunch';
    else if (hour < 18) inferredOccasion = 'casual';
    else inferredOccasion = 'night-out';
  } else {
    if (hour < 9) inferredOccasion = 'work';
    else if (hour < 17) inferredOccasion = 'work';
    else if (hour < 20) inferredOccasion = 'casual';
    else inferredOccasion = 'night-out';
  }

  // 3. User's name
  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single();

  // 4. Active style shift goal
  const { data: activeGoal } = await supabase
    .from('style_goals')
    .select('id, title, description, current_progress')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 5. Wardrobe item count (for empty state detection)
  const { count: wardrobeCount } = await supabase
    .from('wardrobe_items')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active');

  return c.json({
    data: {
      user_name: user?.name ?? null,
      weather,
      time_of_day: timeOfDay,
      is_weekend: isWeekend,
      inferred_occasion: inferredOccasion,
      active_style_goal: activeGoal ?? null,
      wardrobe_item_count: wardrobeCount ?? 0,
      date: now.toISOString().split('T')[0],
    },
    error: null,
  });
});

// ── POST /outfits/suggest/swap ────────────────────────────────

outfitSuggest.post('/suggest/swap', zValidator('json', swapSchema), async (c) => {
  const supabase = c.get('supabase');
  const body = c.req.valid('json');

  // 1. Fetch the kept items to compute compatibility against
  const { data: keptItems, error: keptError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .in('id', body.keep_item_ids);

  if (keptError) {
    return c.json(
      { data: null, error: { code: 'QUERY_FAILED', message: keptError.message } },
      400
    );
  }

  const kept = (keptItems ?? []) as WardrobeItem[];
  if (kept.length === 0) {
    return c.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'No matching kept items found' } },
      404
    );
  }

  // 2. Fetch user's wardrobe items in the replace_slot category
  const { data: candidates, error: candidatesError } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('category', body.replace_slot)
    .eq('status', 'active')
    .limit(200);

  if (candidatesError) {
    return c.json(
      { data: null, error: { code: 'QUERY_FAILED', message: candidatesError.message } },
      400
    );
  }

  const candidateItems = (candidates ?? []) as WardrobeItem[];

  if (candidateItems.length === 0) {
    return c.json({
      data: [],
      error: null,
      message: `No items found in category "${body.replace_slot}".`,
    });
  }

  // 3. Exclude items already in the outfit
  const keepIds = new Set(body.keep_item_ids);
  const available = candidateItems.filter((item) => !keepIds.has(item.id));

  if (available.length === 0) {
    return c.json({
      data: [],
      error: null,
      message: 'No alternative items available in this category.',
    });
  }

  // 4. Score each candidate against kept items
  const weather = body.weather ?? null;
  const occasion = body.occasion ?? null;

  const scored = available.map((candidate) => {
    // Average color harmony against all kept items
    let totalColorHarmony = 0;
    for (const keptItem of kept) {
      totalColorHarmony += colorHarmonyScore(keptItem.colors, candidate.colors);
    }
    const avgColorHarmony = kept.length > 0 ? totalColorHarmony / kept.length : 0.5;

    // Formality consistency with kept items
    const keptFormalities = kept.map((k) => k.formality_level);
    const avgKeptFormality = keptFormalities.reduce((a, b) => a + b, 0) / keptFormalities.length;
    const formalityDiff = Math.abs(candidate.formality_level - avgKeptFormality);
    const formalityScore = formalityDiff <= 1 ? 1.0 : formalityDiff <= 2 ? 0.5 : 0.1;

    // Occasion fit
    let occasionFit = 0.7;
    if (occasion) {
      const range = OCCASION_FORMALITY[occasion];
      occasionFit = formalityMatch(candidate.formality_level, range);
    }

    // Weather score
    const wScore = weather ? weatherScore(candidate, weather) : 0.7;

    // Pattern compatibility
    const keptPatterns = new Set(kept.map((k) => k.pattern));
    const patternFit = keptPatterns.has(candidate.pattern) || keptPatterns.size <= 1 ? 1.0 : 0.6;

    const compatibility =
      avgColorHarmony * 0.3 +
      formalityScore * 0.25 +
      occasionFit * 0.2 +
      wScore * 0.15 +
      patternFit * 0.1;

    return {
      id: candidate.id,
      name: candidate.name,
      category: candidate.category,
      colors: candidate.colors,
      image_url: candidate.image_url,
      image_url_clean: candidate.image_url_clean,
      formality_level: candidate.formality_level,
      brand: candidate.brand,
      compatibility_score: Math.round(compatibility * 100) / 100,
    };
  });

  // 5. Sort by compatibility score, return top 8
  scored.sort((a, b) => b.compatibility_score - a.compatibility_score);
  const topAlternatives = scored.slice(0, 8);

  return c.json({ data: topAlternatives, error: null });
});

// ── POST /signals/emit ───────────────────────────────────────

outfitSuggest.post('/signals/emit', zValidator('json', signalEmitSchema), async (c) => {
  const supabase = c.get('supabase');
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const { error } = await supabase.from('preference_signals').insert({
    user_id: userId,
    signal_type: body.signal_type,
    item_id: body.item_id ?? null,
    outfit_id: body.outfit_id ?? null,
    value: body.value,
    context: body.context ?? null,
  });

  if (error) {
    return c.json(
      { data: null, error: { code: 'INSERT_FAILED', message: error.message } },
      400
    );
  }

  return c.json({ data: { success: true }, error: null });
});

export default outfitSuggest;
