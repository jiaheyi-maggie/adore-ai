// ═══════════════════════════════════════════════════════════
// Style Dimensions — Maps StyleProfile to visual aura parameters
// ═══════════════════════════════════════════════════════════

import type { StyleProfile, ColorSeason, FormalityLevel } from '@adore/shared';

// ── Types ───────────────────────────────────────────────────

export interface StyleDimensions {
  /** 0 = cool, 1 = warm */
  colorTemp: number;
  /** 0 = muted, 1 = vivid */
  saturation: number;
  /** 0 = organic/flowing, 1 = geometric/structured */
  structure: number;
  /** 0 = simple, 1 = complex */
  complexity: number;
  /** 0 = casual, 1 = formal */
  formality: number;
  /** 0 = safe/classic, 1 = experimental/edgy */
  riskTolerance: number;
  /** Primary gradient color (hex) */
  primaryColor: string;
  /** Secondary gradient color (hex) */
  secondaryColor: string;
  /** Accent gradient color (hex) */
  accentColor: string;
  /** Computed archetype name, e.g. "Warm Minimalist" */
  archetypeName: string;
  /** Top 3-4 distinctive style traits as pill labels */
  traits: string[];
}

// ── Color Season Palettes ───────────────────────────────────
// Each season maps to a curated 3-color gradient palette.

const SEASON_PALETTES: Record<ColorSeason, [string, string, string]> = {
  'spring-light': ['#F5C882', '#F7A8B8', '#B8D4A8'],
  'spring-warm': ['#E8A44A', '#D4764E', '#7BAA6E'],
  'spring-clear': ['#FF8C42', '#FF6B6B', '#FFD93D'],
  'summer-light': ['#A8C5D6', '#C4A8C9', '#D6C4A8'],
  'summer-cool': ['#7B9EC4', '#9B7BB5', '#B8C9D4'],
  'summer-soft': ['#B5A3C4', '#C9A8B5', '#A3B5C4'],
  'autumn-warm': ['#C47B3F', '#8B5E3C', '#6B7B3F'],
  'autumn-deep': ['#8B3A3A', '#5C3D2E', '#3D5C4E'],
  'autumn-soft': ['#B59B7A', '#8B7B6B', '#7B8B6B'],
  'winter-cool': ['#4A6FA5', '#6B4F8A', '#2D4A5E'],
  'winter-deep': ['#2D1B4E', '#4A0E2E', '#0E2E4A'],
  'winter-clear': ['#E60012', '#0039A6', '#FFFFFF'],
};

// Fallback warm bronze gradient from theme
const FALLBACK_PALETTE: [string, string, string] = ['#C4956A', '#B3845A', '#E8D5C4'];

// ── Color temperature by season ─────────────────────────────

const SEASON_WARMTH: Record<string, number> = {
  spring: 0.85,
  summer: 0.25,
  autumn: 0.9,
  winter: 0.15,
};

// Sub-season modifiers: "warm" pushes warmer, "cool" pushes cooler
const MODIFIER_WARMTH: Record<string, number> = {
  warm: 0.15,
  light: 0.05,
  clear: 0.0,
  cool: -0.15,
  soft: -0.05,
  deep: -0.05,
};

// ── Archetype Dimension Mappings ────────────────────────────

/** How much each archetype contributes to structure (0=organic, 1=geometric) */
const ARCHETYPE_STRUCTURE: Record<string, number> = {
  minimalist: 0.7,
  classic: 0.85,
  bohemian: 0.15,
  edgy: 0.55,
  romantic: 0.25,
  maximalist: 0.35,
  glamorous: 0.75,
  vintage: 0.45,
  cozy: 0.1,
  athletic: 0.6,
};

/** How much each archetype contributes to complexity */
const ARCHETYPE_COMPLEXITY: Record<string, number> = {
  minimalist: 0.1,
  classic: 0.25,
  bohemian: 0.65,
  edgy: 0.7,
  romantic: 0.5,
  maximalist: 0.95,
  glamorous: 0.7,
  vintage: 0.55,
  cozy: 0.2,
  athletic: 0.15,
};

/** Risk tolerance by archetype */
const ARCHETYPE_RISK: Record<string, number> = {
  minimalist: 0.2,
  classic: 0.1,
  bohemian: 0.55,
  edgy: 0.9,
  romantic: 0.3,
  maximalist: 0.85,
  glamorous: 0.65,
  vintage: 0.45,
  cozy: 0.05,
  athletic: 0.15,
};

// ── Color adjectives for archetype name ─────────────────────

function getColorAdjective(colorTemp: number, season: ColorSeason | null): string {
  if (season) {
    const base = season.split('-')[0];
    if (base === 'spring') return 'Warm';
    if (base === 'summer') return 'Cool';
    if (base === 'autumn') return 'Rich';
    if (base === 'winter') return 'Bold';
  }
  if (colorTemp > 0.65) return 'Warm';
  if (colorTemp < 0.35) return 'Cool';
  return 'Balanced';
}

// ── Archetype display labels ────────────────────────────────

const ARCHETYPE_LABELS: Record<string, string> = {
  minimalist: 'Minimalist',
  classic: 'Classic',
  bohemian: 'Bohemian',
  edgy: 'Edgy',
  romantic: 'Romantic',
  maximalist: 'Maximalist',
  glamorous: 'Glamorous',
  vintage: 'Vintage',
  cozy: 'Cozy',
  athletic: 'Athletic',
};

// ── Trait derivation ────────────────────────────────────────

const TRAIT_MAP: Record<string, string[]> = {
  minimalist: ['Clean Lines', 'Less Is More', 'Intentional'],
  classic: ['Timeless', 'Polished', 'Tailored'],
  bohemian: ['Free-Spirited', 'Textured', 'Earthy'],
  edgy: ['Statement-Making', 'Rule-Breaking', 'Fearless'],
  romantic: ['Soft', 'Feminine', 'Graceful'],
  maximalist: ['Bold Prints', 'Color-Fearless', 'Layered'],
  glamorous: ['Luxe', 'Commanding', 'Refined'],
  vintage: ['Retro', 'Nostalgic', 'Curated'],
  cozy: ['Comfort-First', 'Layered', 'Relaxed'],
  athletic: ['Functional', 'Sporty', 'Dynamic'],
};

const FORMALITY_TRAITS: Record<string, string> = {
  high_formality: 'Event-Ready',
  low_formality: 'Effortlessly Casual',
  balanced_formality: 'Versatile',
};

// ── Main Computation ────────────────────────────────────────

export function computeStyleDimensions(profile: StyleProfile): StyleDimensions {
  const { color_season, style_archetypes, formality_distribution, color_preferences } = profile;

  // 1. Color temperature from color_season
  let colorTemp = 0.5; // neutral default
  if (color_season) {
    const [baseSeason, modifier] = color_season.split('-') as [string, string];
    const baseWarmth = SEASON_WARMTH[baseSeason] ?? 0.5;
    const modifierDelta = MODIFIER_WARMTH[modifier] ?? 0;
    colorTemp = Math.max(0, Math.min(1, baseWarmth + modifierDelta));
  }

  // 2. Saturation from color_preferences
  let saturation = 0.5;
  if (color_preferences && Object.keys(color_preferences).length > 0) {
    const vividColors = [
      'red', 'fuchsia', 'cobalt', 'electric', 'neon', 'bright', 'vivid',
      'turquoise', 'coral', 'magenta', 'crimson', 'emerald', 'sapphire',
      'gold', 'orange', 'yellow', 'lime',
    ];
    const mutedColors = [
      'beige', 'cream', 'tan', 'taupe', 'oatmeal', 'sage', 'dusty',
      'muted', 'soft', 'pastel', 'mauve', 'nude', 'stone', 'mushroom',
      'fog', 'ash', 'khaki',
    ];
    const neutralColors = ['black', 'white', 'grey', 'gray', 'charcoal', 'ivory'];

    let vividWeight = 0;
    let mutedWeight = 0;
    let totalWeight = 0;

    for (const [colorName, weight] of Object.entries(color_preferences)) {
      const lower = colorName.toLowerCase();
      totalWeight += weight;
      if (vividColors.some((v) => lower.includes(v))) {
        vividWeight += weight;
      } else if (mutedColors.some((m) => lower.includes(m))) {
        mutedWeight += weight;
      } else if (!neutralColors.some((n) => lower.includes(n))) {
        // Named colors like "navy", "burgundy" are moderately saturated
        vividWeight += weight * 0.4;
        mutedWeight += weight * 0.3;
      }
    }

    if (totalWeight > 0) {
      saturation = Math.max(0, Math.min(1,
        0.5 + (vividWeight - mutedWeight) / (totalWeight * 2),
      ));
    }
  }

  // 3. Structure, complexity, risk from archetypes (weighted average)
  let structure = 0.5;
  let complexity = 0.3;
  let riskTolerance = 0.3;
  const archetypeEntries = Object.entries(style_archetypes);

  if (archetypeEntries.length > 0) {
    const total = archetypeEntries.reduce((sum, [, w]) => sum + w, 0);
    if (total > 0) {
      structure = 0;
      complexity = 0;
      riskTolerance = 0;
      for (const [archetype, weight] of archetypeEntries) {
        const norm = weight / total;
        structure += (ARCHETYPE_STRUCTURE[archetype] ?? 0.5) * norm;
        complexity += (ARCHETYPE_COMPLEXITY[archetype] ?? 0.5) * norm;
        riskTolerance += (ARCHETYPE_RISK[archetype] ?? 0.3) * norm;
      }
    }
  }

  // 4. Formality from formality_distribution
  let formality = 0.35; // default slightly casual
  if (formality_distribution) {
    const formalityWeights: Record<FormalityLevel, number> = {
      casual: 0.1,
      smart_casual: 0.3,
      business: 0.6,
      formal: 0.8,
      black_tie: 1.0,
    };

    let weightedSum = 0;
    let totalDist = 0;
    for (const [level, dist] of Object.entries(formality_distribution)) {
      const formalityValue = formalityWeights[level as FormalityLevel] ?? 0.5;
      weightedSum += formalityValue * dist;
      totalDist += dist;
    }

    if (totalDist > 0) {
      formality = weightedSum / totalDist;
    }
  }

  // 5. Colors from season palette
  let [primaryColor, secondaryColor, accentColor] = FALLBACK_PALETTE;
  if (color_season && SEASON_PALETTES[color_season]) {
    [primaryColor, secondaryColor, accentColor] = SEASON_PALETTES[color_season];
  }

  // 6. Archetype name: "{Color Adjective} {Top Archetype}"
  const sortedArchetypes = archetypeEntries.sort((a, b) => b[1] - a[1]);
  const topArchetype = sortedArchetypes[0]?.[0] ?? 'classic';
  const topLabel = ARCHETYPE_LABELS[topArchetype] ?? 'Classic';
  const colorAdj = getColorAdjective(colorTemp, color_season);
  const archetypeName = `${colorAdj} ${topLabel}`;

  // 7. Traits: top 3-4 traits from highest-weighted archetypes + formality
  const traits: string[] = [];
  const usedTraits = new Set<string>();

  for (const [archetype] of sortedArchetypes) {
    const archetypeTraits = TRAIT_MAP[archetype];
    if (archetypeTraits) {
      for (const trait of archetypeTraits) {
        if (!usedTraits.has(trait) && traits.length < 3) {
          traits.push(trait);
          usedTraits.add(trait);
        }
      }
    }
    if (traits.length >= 3) break;
  }

  // Add a formality trait if we have room
  if (traits.length < 4) {
    if (formality >= 0.6) {
      traits.push(FORMALITY_TRAITS.high_formality);
    } else if (formality <= 0.25) {
      traits.push(FORMALITY_TRAITS.low_formality);
    } else {
      traits.push(FORMALITY_TRAITS.balanced_formality);
    }
  }

  return {
    colorTemp,
    saturation,
    structure,
    complexity,
    formality,
    riskTolerance,
    primaryColor,
    secondaryColor,
    accentColor,
    archetypeName,
    traits,
  };
}

// ── Default dimensions for fallback ─────────────────────────

export const DEFAULT_DIMENSIONS: StyleDimensions = {
  colorTemp: 0.6,
  saturation: 0.5,
  structure: 0.5,
  complexity: 0.35,
  formality: 0.35,
  riskTolerance: 0.3,
  primaryColor: FALLBACK_PALETTE[0],
  secondaryColor: FALLBACK_PALETTE[1],
  accentColor: FALLBACK_PALETTE[2],
  archetypeName: 'Your Style',
  traits: ['Unique', 'Expressive', 'Authentic'],
};
