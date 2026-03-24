// ═══════════════════════════════════════════════════════════
// Style Scoring — Item-to-Archetype affinity scoring engine
// ═══════════════════════════════════════════════════════════

import type { WardrobeItem, ItemCategory, Pattern, Material } from '@adore/shared';
import { type ArchetypePreset } from './archetype-presets';

// ── Types ───────────────────────────────────────────────────

export interface ScoredItem {
  item: WardrobeItem;
  score: number;
  reason: string;
}

export interface ClassifiedWardrobe {
  target_aligned: ScoredItem[];
  bridge: ScoredItem[];
  neutral: ScoredItem[];
  phase_out: ScoredItem[];
}

// ── Color Normalization ─────────────────────────────────────

const COLOR_FAMILIES: Record<string, string[]> = {
  white: ['white', 'ivory', 'snow', 'off-white'],
  cream: ['cream', 'oatmeal', 'eggshell', 'vanilla', 'ecru'],
  beige: ['beige', 'sand', 'tan', 'khaki', 'camel', 'fawn', 'taupe'],
  brown: ['brown', 'chocolate', 'espresso', 'coffee', 'walnut', 'mocha', 'cocoa'],
  black: ['black', 'jet', 'onyx', 'ebony'],
  grey: ['grey', 'gray', 'charcoal', 'slate', 'silver', 'gunmetal', 'ash'],
  navy: ['navy', 'dark blue', 'midnight'],
  blue: ['blue', 'cobalt', 'royal blue', 'sky blue', 'light blue', 'pale blue', 'denim blue', 'cornflower'],
  red: ['red', 'crimson', 'scarlet', 'cherry', 'dark red'],
  burgundy: ['burgundy', 'maroon', 'wine', 'oxblood', 'merlot'],
  pink: ['pink', 'blush', 'dusty rose', 'mauve', 'soft pink', 'rose', 'salmon'],
  orange: ['orange', 'burnt orange', 'terracotta', 'rust', 'coral', 'peach', 'apricot'],
  yellow: ['yellow', 'mustard', 'gold', 'saffron', 'lemon', 'amber'],
  green: ['green', 'olive', 'sage', 'forest green', 'emerald', 'muted green', 'hunter', 'moss', 'jade'],
  purple: ['purple', 'lavender', 'plum', 'violet', 'lilac', 'amethyst'],
  turquoise: ['turquoise', 'teal', 'aqua', 'cyan'],
  fuchsia: ['fuchsia', 'magenta', 'hot pink', 'neon pink'],
};

function normalizeColor(color: string): string {
  const lower = color.toLowerCase().trim();
  for (const [family, variants] of Object.entries(COLOR_FAMILIES)) {
    if (variants.includes(lower) || lower === family) return family;
  }
  return lower;
}

function colorOverlap(itemColors: string[], presetColors: string[]): number {
  if (itemColors.length === 0 || presetColors.length === 0) return 0.3; // neutral
  const normItem = itemColors.map(normalizeColor);
  const normPreset = presetColors.map(normalizeColor);
  let matches = 0;
  for (const ic of normItem) {
    if (normPreset.includes(ic)) matches++;
  }
  return Math.min(1, matches / Math.max(1, normItem.length));
}

// ── Pattern Matching ────────────────────────────────────────

function patternMatch(itemPattern: Pattern, presetPatterns: string[]): number {
  if (presetPatterns.length === 0) return 0.5;
  return presetPatterns.includes(itemPattern) ? 1.0 : 0.15;
}

// ── Material Matching ───────────────────────────────────────

function materialMatch(itemMaterial: Material | null, presetMaterials: string[]): number {
  if (!itemMaterial || presetMaterials.length === 0) return 0.3;
  return presetMaterials.includes(itemMaterial) ? 1.0 : 0.15;
}

// ── Formality Range Match ───────────────────────────────────

function formalityMatch(itemFormality: number, range: [number, number]): number {
  const [low, high] = range;
  if (itemFormality >= low && itemFormality <= high) return 1.0;
  const distance = itemFormality < low ? low - itemFormality : itemFormality - high;
  if (distance === 1) return 0.5;
  return 0.1;
}

// ── Category Affinity ───────────────────────────────────────

function categoryMatch(category: ItemCategory, favoredCategories: ItemCategory[]): number {
  if (favoredCategories.length === 0) return 0.5;
  return favoredCategories.includes(category) ? 1.0 : 0.4;
}

// ── Style Tag Overlap ───────────────────────────────────────
// WardrobeItem doesn't have style_tags directly, but subcategory and notes can carry hints

function styleTagScore(item: WardrobeItem, presetTags: string[]): number {
  if (presetTags.length === 0) return 0.3;

  const itemText = [
    item.name,
    item.subcategory,
    item.brand,
    item.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let matches = 0;
  for (const tag of presetTags) {
    if (itemText.includes(tag.toLowerCase())) matches++;
  }

  return Math.min(1, matches / Math.max(1, Math.min(presetTags.length, 4)));
}

// ── Main Scoring Function ───────────────────────────────────

const WEIGHTS = {
  color: 0.25,
  material: 0.15,
  pattern: 0.15,
  formality: 0.15,
  category: 0.15,
  styleTags: 0.15,
} as const;

/**
 * Scores a single wardrobe item against an archetype preset.
 * Returns 0-1 score.
 */
export function scoreItemForArchetype(
  item: WardrobeItem,
  preset: ArchetypePreset
): number {
  const sig = preset.signature;

  const colorScore = colorOverlap(item.colors, sig.colors);
  const matScore = materialMatch(item.material, sig.materials);
  const patScore = patternMatch(item.pattern, sig.patterns);
  const formScore = formalityMatch(item.formality_level, sig.formality_range);
  const catScore = categoryMatch(item.category, sig.favored_categories);
  const tagScore = styleTagScore(item, sig.style_tags);

  const weighted =
    WEIGHTS.color * colorScore +
    WEIGHTS.material * matScore +
    WEIGHTS.pattern * patScore +
    WEIGHTS.formality * formScore +
    WEIGHTS.category * catScore +
    WEIGHTS.styleTags * tagScore;

  return Math.round(weighted * 1000) / 1000;
}

// ── Score Reason Generator ──────────────────────────────────

function generateReason(item: WardrobeItem, preset: ArchetypePreset, score: number): string {
  const sig = preset.signature;
  const strengths: string[] = [];

  if (colorOverlap(item.colors, sig.colors) >= 0.5) {
    strengths.push('colors match');
  }
  if (item.material && sig.materials.includes(item.material)) {
    strengths.push(`${item.material} is on-aesthetic`);
  }
  if (sig.patterns.includes(item.pattern)) {
    strengths.push(`${item.pattern} pattern fits`);
  }
  if (sig.favored_categories.includes(item.category)) {
    strengths.push(`${item.category} is key for this look`);
  }
  const fl = item.formality_level;
  if (fl >= sig.formality_range[0] && fl <= sig.formality_range[1]) {
    strengths.push('formality aligns');
  }

  if (strengths.length === 0) {
    return score > 0.4
      ? 'Partially matches the aesthetic vibe'
      : 'Doesn\'t fit the target aesthetic profile';
  }

  return strengths.slice(0, 3).join(', ');
}

// ── Wardrobe Classification ─────────────────────────────────

/**
 * Classifies all wardrobe items into 4 buckets based on target + current affinity.
 *
 * Classification rules:
 * - target_aligned: target score > 0.7
 * - bridge: target score 0.4-0.7 AND current score > 0.4
 * - neutral: target score 0.3-0.5, basic wardrobe items
 * - phase_out: target score < 0.3 AND current score > 0.6
 */
export function classifyWardrobe(
  items: WardrobeItem[],
  targetPreset: ArchetypePreset,
  currentArchetypes: Record<string, number>
): ClassifiedWardrobe {
  const result: ClassifiedWardrobe = {
    target_aligned: [],
    bridge: [],
    neutral: [],
    phase_out: [],
  };

  // Build a synthetic "current" preset from the user's existing archetypes
  // to compute how well each item fits their current style
  const currentPreset = buildCurrentPreset(currentArchetypes);

  for (const item of items) {
    const targetScore = scoreItemForArchetype(item, targetPreset);
    const currentScore = currentPreset
      ? scoreItemForArchetype(item, currentPreset)
      : 0.5;
    const reason = generateReason(item, targetPreset, targetScore);

    const scored: ScoredItem = { item, score: targetScore, reason };

    if (targetScore > 0.7) {
      result.target_aligned.push(scored);
    } else if (targetScore >= 0.4 && currentScore > 0.4) {
      result.bridge.push(scored);
    } else if (targetScore >= 0.3) {
      result.neutral.push(scored);
    } else if (currentScore > 0.6) {
      result.phase_out.push(scored);
    } else {
      // Low affinity for both — still classify as neutral
      result.neutral.push(scored);
    }
  }

  // Sort each bucket by score descending
  const sortByScore = (a: ScoredItem, b: ScoredItem) => b.score - a.score;
  result.target_aligned.sort(sortByScore);
  result.bridge.sort(sortByScore);
  result.neutral.sort(sortByScore);
  result.phase_out.sort(sortByScore);

  return result;
}

// ── Base Archetype Signatures ───────────────────────────────
// Maps the 10 base archetype names (as stored in user style_archetypes)
// to their attribute signatures. These are distinct from the compound
// preset IDs (e.g. "clean-minimalist") in archetype-presets.ts.

const BASE_ARCHETYPE_SIGNATURES: Record<string, { colors: string[]; materials: string[]; patterns: string[]; formality_range: [number, number]; categories: string[]; style_tags: string[] }> = {
  minimalist: { colors: ['black', 'white', 'grey', 'beige'], materials: ['cotton', 'linen', 'wool'], patterns: ['solid'], formality_range: [2, 4], categories: ['tops', 'bottoms'], style_tags: ['clean', 'simple', 'understated'] },
  classic: { colors: ['navy', 'white', 'cream', 'camel'], materials: ['cotton', 'wool', 'cashmere'], patterns: ['solid', 'striped'], formality_range: [3, 5], categories: ['outerwear', 'tops', 'bottoms'], style_tags: ['timeless', 'polished', 'refined'] },
  bohemian: { colors: ['brown', 'rust', 'cream', 'turquoise'], materials: ['linen', 'cotton', 'suede', 'leather'], patterns: ['floral', 'abstract', 'geometric'], formality_range: [1, 3], categories: ['dresses', 'accessories', 'jewelry'], style_tags: ['free-spirited', 'earthy', 'layered'] },
  edgy: { colors: ['black', 'dark-grey', 'burgundy'], materials: ['leather', 'denim', 'synthetic'], patterns: ['solid', 'graphic'], formality_range: [1, 3], categories: ['outerwear', 'shoes', 'accessories'], style_tags: ['bold', 'rebellious', 'statement'] },
  romantic: { colors: ['blush', 'lavender', 'cream', 'dusty-rose'], materials: ['silk', 'lace', 'chiffon'], patterns: ['floral', 'solid'], formality_range: [2, 4], categories: ['dresses', 'tops', 'jewelry'], style_tags: ['feminine', 'soft', 'delicate'] },
  maximalist: { colors: ['multi', 'bright', 'saturated'], materials: ['velvet', 'silk', 'synthetic'], patterns: ['abstract', 'geometric', 'animal-print'], formality_range: [1, 4], categories: ['dresses', 'accessories', 'jewelry'], style_tags: ['bold', 'eclectic', 'layered'] },
  glamorous: { colors: ['gold', 'silver', 'black', 'red'], materials: ['silk', 'velvet', 'synthetic'], patterns: ['solid'], formality_range: [3, 5], categories: ['dresses', 'jewelry', 'shoes'], style_tags: ['luxe', 'statement', 'sparkle'] },
  vintage: { colors: ['mustard', 'burgundy', 'teal', 'rust'], materials: ['cotton', 'denim', 'wool'], patterns: ['plaid', 'polka-dot', 'floral'], formality_range: [2, 3], categories: ['dresses', 'tops', 'accessories'], style_tags: ['retro', 'nostalgic', 'character'] },
  cozy: { colors: ['cream', 'oatmeal', 'camel', 'grey'], materials: ['wool', 'cashmere', 'knit', 'cotton'], patterns: ['solid', 'striped'], formality_range: [1, 2], categories: ['tops', 'outerwear'], style_tags: ['comfortable', 'warm', 'relaxed'] },
  athletic: { colors: ['black', 'grey', 'white', 'neon'], materials: ['synthetic', 'cotton', 'nylon'], patterns: ['solid', 'graphic'], formality_range: [1, 2], categories: ['activewear', 'shoes'], style_tags: ['sporty', 'functional', 'dynamic'] },
};

// ── Current-Style Synthetic Preset ──────────────────────────

/**
 * Builds a lightweight synthetic ArchetypePreset from the user's current archetype weights.
 * Uses BASE_ARCHETYPE_SIGNATURES (keyed by base names like "minimalist", "classic")
 * instead of ARCHETYPE_PRESETS (keyed by compound IDs like "clean-minimalist").
 */
function buildCurrentPreset(
  archetypes: Record<string, number>
): ArchetypePreset | null {
  const entries = Object.entries(archetypes).filter(([, w]) => w > 0);
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  const blendedColors: string[] = [];
  const blendedMaterials: string[] = [];
  const blendedPatterns: string[] = [];
  const blendedTags: string[] = [];
  const blendedCategories: ItemCategory[] = [];
  let formalityLow = 5;
  let formalityHigh = 1;

  for (const [archName, weight] of entries) {
    const norm = weight / totalWeight;
    const sig = BASE_ARCHETYPE_SIGNATURES[archName];
    if (!sig) continue;

    // Take top N items proportional to weight
    const take = Math.max(1, Math.round(norm * 5));
    blendedColors.push(...sig.colors.slice(0, take));
    blendedMaterials.push(...sig.materials.slice(0, take));
    blendedPatterns.push(...sig.patterns.slice(0, take));
    blendedTags.push(...sig.style_tags.slice(0, take));
    blendedCategories.push(...(sig.categories.slice(0, take) as ItemCategory[]));
    formalityLow = Math.min(formalityLow, sig.formality_range[0]);
    formalityHigh = Math.max(formalityHigh, sig.formality_range[1]);
  }

  return {
    id: '__current__',
    name: 'Current Style',
    description: 'Synthetic preset from user profile',
    archetypes,
    signature: {
      colors: [...new Set(blendedColors)],
      materials: [...new Set(blendedMaterials)],
      patterns: [...new Set(blendedPatterns)],
      formality_range: [formalityLow, formalityHigh],
      style_tags: [...new Set(blendedTags)],
      favored_categories: [...new Set(blendedCategories)],
    },
  };
}

// ── Dimension Delta Computation ─────────────────────────────

/**
 * Computes dimension deltas between current and target archetype weights.
 * Returns an object showing which style dimensions would shift and by how much.
 */
export function computeDimensionDeltas(
  currentArchetypes: Record<string, number>,
  targetArchetypes: Record<string, number>
): Record<string, { current: number; target: number; delta: number }> {
  const DIMENSION_MAP: Record<string, Record<string, number>> = {
    structure: {
      minimalist: 0.7, classic: 0.85, bohemian: 0.15, edgy: 0.55, romantic: 0.25,
      maximalist: 0.35, glamorous: 0.75, vintage: 0.45, cozy: 0.1, athletic: 0.6,
    },
    complexity: {
      minimalist: 0.1, classic: 0.25, bohemian: 0.65, edgy: 0.7, romantic: 0.5,
      maximalist: 0.95, glamorous: 0.7, vintage: 0.55, cozy: 0.2, athletic: 0.15,
    },
    riskTolerance: {
      minimalist: 0.2, classic: 0.1, bohemian: 0.55, edgy: 0.9, romantic: 0.3,
      maximalist: 0.85, glamorous: 0.65, vintage: 0.45, cozy: 0.05, athletic: 0.15,
    },
    formality: {
      minimalist: 0.5, classic: 0.7, bohemian: 0.2, edgy: 0.25, romantic: 0.5,
      maximalist: 0.3, glamorous: 0.75, vintage: 0.4, cozy: 0.15, athletic: 0.15,
    },
  };

  function computeDimension(
    archetypes: Record<string, number>,
    dimMap: Record<string, number>
  ): number {
    const entries = Object.entries(archetypes);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total === 0) return 0.5;
    let result = 0;
    for (const [name, weight] of entries) {
      result += (dimMap[name] ?? 0.5) * (weight / total);
    }
    return Math.round(result * 100) / 100;
  }

  const deltas: Record<string, { current: number; target: number; delta: number }> = {};

  for (const [dim, dimMap] of Object.entries(DIMENSION_MAP)) {
    const current = computeDimension(currentArchetypes, dimMap);
    const target = computeDimension(targetArchetypes, dimMap);
    deltas[dim] = {
      current,
      target,
      delta: Math.round((target - current) * 100) / 100,
    };
  }

  return deltas;
}

// ── Gap Category Detection ──────────────────────────────────

/**
 * Identifies categories where the user lacks items that align with the target aesthetic.
 * Returns categories + search keywords for product search.
 */
export function identifyGapCategories(
  classified: ClassifiedWardrobe,
  targetPreset: ArchetypePreset
): Array<{ category: ItemCategory; search_terms: string }> {
  const favoredCategories = targetPreset.signature.favored_categories;
  const coveredCategories = new Set<string>();

  // Categories covered by target_aligned + bridge items
  for (const { item } of [...classified.target_aligned, ...classified.bridge]) {
    coveredCategories.add(item.category);
  }

  const gaps: Array<{ category: ItemCategory; search_terms: string }> = [];
  for (const cat of favoredCategories) {
    if (!coveredCategories.has(cat)) {
      // Build a search query from the preset signature
      const colorHint = targetPreset.signature.colors.slice(0, 2).join(' ');
      const materialHint = targetPreset.signature.materials[0] ?? '';
      const terms = [targetPreset.name, colorHint, materialHint, cat]
        .filter(Boolean)
        .join(' ');
      gaps.push({ category: cat, search_terms: terms });
    }
  }

  return gaps;
}
