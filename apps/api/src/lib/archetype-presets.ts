// ═══════════════════════════════════════════════════════════
// Archetype Presets — Aesthetic direction definitions for Style Shifting
// ═══════════════════════════════════════════════════════════

import type { ItemCategory, Pattern, Material } from '@adore/shared';

// ── Types ───────────────────────────────────────────────────

export interface ArchetypePreset {
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
    /** Categories that this aesthetic favors heavily */
    favored_categories: ItemCategory[];
  };
}

// ── Preset Definitions ──────────────────────────────────────

export const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  {
    id: 'bohemian',
    name: 'Bohemian',
    description: 'Free-spirited layers, earthy tones, and global-inspired textures',
    archetypes: { bohemian: 0.6, romantic: 0.15, vintage: 0.15, maximalist: 0.1 },
    signature: {
      colors: ['terracotta', 'sage', 'cream', 'mustard', 'burnt orange', 'olive', 'rust', 'sand'],
      materials: ['linen', 'cotton', 'suede', 'knit', 'leather'],
      patterns: ['floral', 'geometric', 'abstract', 'other'],
      formality_range: [1, 3],
      style_tags: ['boho', 'layered', 'earthy', 'flowy', 'textured', 'fringe', 'macrame', 'crochet'],
      favored_categories: ['dresses', 'accessories', 'jewelry', 'tops', 'outerwear'],
    },
  },
  {
    id: 'clean-minimalist',
    name: 'Clean Minimalist',
    description: 'Pared-back silhouettes, neutral palette, intentional wardrobe',
    archetypes: { minimalist: 0.7, classic: 0.2, athletic: 0.1 },
    signature: {
      colors: ['white', 'black', 'grey', 'beige', 'navy', 'cream', 'charcoal', 'oatmeal'],
      materials: ['cotton', 'wool', 'cashmere', 'silk', 'linen'],
      patterns: ['solid'],
      formality_range: [2, 4],
      style_tags: ['minimal', 'clean', 'simple', 'structured', 'capsule', 'monochrome', 'sleek'],
      favored_categories: ['tops', 'bottoms', 'outerwear', 'shoes'],
    },
  },
  {
    id: 'dark-academia',
    name: 'Dark Academia',
    description: 'Scholarly elegance with tweed, earth tones, and literary charm',
    archetypes: { classic: 0.35, vintage: 0.3, romantic: 0.15, edgy: 0.1, glamorous: 0.1 },
    signature: {
      colors: ['brown', 'burgundy', 'forest green', 'charcoal', 'cream', 'navy', 'tan', 'espresso'],
      materials: ['wool', 'cotton', 'leather', 'knit', 'velvet', 'suede'],
      patterns: ['plaid', 'striped', 'solid'],
      formality_range: [2, 4],
      style_tags: ['tweed', 'blazer', 'oxford', 'layered', 'scholarly', 'intellectual', 'heritage'],
      favored_categories: ['outerwear', 'tops', 'bottoms', 'accessories', 'bags'],
    },
  },
  {
    id: 'coastal-grandmother',
    name: 'Coastal Grandmother',
    description: 'Relaxed elegance inspired by seaside living and Nancy Meyers films',
    archetypes: { classic: 0.35, minimalist: 0.25, cozy: 0.2, romantic: 0.1, bohemian: 0.1 },
    signature: {
      colors: ['white', 'cream', 'light blue', 'navy', 'sand', 'oatmeal', 'sage', 'khaki'],
      materials: ['linen', 'cotton', 'cashmere', 'knit', 'silk'],
      patterns: ['solid', 'striped'],
      formality_range: [1, 3],
      style_tags: ['breezy', 'relaxed', 'coastal', 'linen', 'effortless', 'natural', 'refined-casual'],
      favored_categories: ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'],
    },
  },
  {
    id: 'streetwear',
    name: 'Streetwear',
    description: 'Urban cool with oversized silhouettes, sneakers, and graphic edge',
    archetypes: { edgy: 0.35, athletic: 0.25, maximalist: 0.15, minimalist: 0.15, cozy: 0.1 },
    signature: {
      colors: ['black', 'white', 'grey', 'olive', 'neon green', 'red', 'navy', 'cream'],
      materials: ['cotton', 'denim', 'nylon', 'synthetic', 'leather', 'knit'],
      patterns: ['graphic', 'solid', 'abstract'],
      formality_range: [1, 2],
      style_tags: ['oversized', 'sneakers', 'graphic', 'urban', 'hypebeast', 'logo', 'drop-shoulder'],
      favored_categories: ['tops', 'shoes', 'outerwear', 'accessories', 'bags'],
    },
  },
  {
    id: 'classic-preppy',
    name: 'Classic Preppy',
    description: 'Collegiate polish with clean lines, plaids, and timeless Americana',
    archetypes: { classic: 0.5, minimalist: 0.2, glamorous: 0.15, vintage: 0.15 },
    signature: {
      colors: ['navy', 'white', 'red', 'green', 'khaki', 'pink', 'cream', 'gold'],
      materials: ['cotton', 'wool', 'cashmere', 'leather', 'silk'],
      patterns: ['striped', 'plaid', 'solid', 'polka-dot'],
      formality_range: [2, 4],
      style_tags: ['collegiate', 'polo', 'blazer', 'cable-knit', 'preppy', 'tailored', 'country-club'],
      favored_categories: ['tops', 'bottoms', 'outerwear', 'shoes', 'accessories'],
    },
  },
  {
    id: 'romantic-feminine',
    name: 'Romantic Feminine',
    description: 'Soft silhouettes, florals, and delicate details with a dreamy quality',
    archetypes: { romantic: 0.55, glamorous: 0.15, vintage: 0.15, bohemian: 0.1, classic: 0.05 },
    signature: {
      colors: ['blush', 'lavender', 'cream', 'dusty rose', 'ivory', 'mauve', 'soft pink', 'sage'],
      materials: ['silk', 'linen', 'cotton', 'velvet', 'cashmere', 'knit'],
      patterns: ['floral', 'polka-dot', 'solid', 'abstract'],
      formality_range: [2, 4],
      style_tags: ['feminine', 'soft', 'ruffles', 'lace', 'flowy', 'delicate', 'romantic', 'ethereal'],
      favored_categories: ['dresses', 'tops', 'jewelry', 'accessories', 'shoes'],
    },
  },
  {
    id: 'edgy-rock',
    name: 'Edgy Rock',
    description: 'Leather, studs, and attitude with a rebellious energy',
    archetypes: { edgy: 0.6, glamorous: 0.15, minimalist: 0.1, vintage: 0.1, maximalist: 0.05 },
    signature: {
      colors: ['black', 'charcoal', 'silver', 'dark red', 'white', 'gunmetal', 'burgundy'],
      materials: ['leather', 'denim', 'synthetic', 'suede', 'velvet', 'cotton'],
      patterns: ['solid', 'graphic', 'animal-print', 'striped'],
      formality_range: [1, 3],
      style_tags: ['leather', 'studs', 'band-tee', 'moto', 'grunge', 'punk', 'chains', 'combat-boots'],
      favored_categories: ['outerwear', 'shoes', 'tops', 'accessories', 'jewelry'],
    },
  },
  {
    id: 'athleisure-chic',
    name: 'Athleisure Chic',
    description: 'Elevated sportswear that goes from gym to brunch effortlessly',
    archetypes: { athletic: 0.45, minimalist: 0.25, cozy: 0.15, edgy: 0.1, classic: 0.05 },
    signature: {
      colors: ['black', 'white', 'grey', 'olive', 'blush', 'navy', 'cream', 'sage'],
      materials: ['synthetic', 'nylon', 'cotton', 'knit', 'polyester'],
      patterns: ['solid', 'geometric'],
      formality_range: [1, 2],
      style_tags: ['sporty', 'athleisure', 'leggings', 'sneakers', 'performance', 'zip-up', 'sleek'],
      favored_categories: ['activewear', 'shoes', 'tops', 'outerwear', 'accessories'],
    },
  },
  {
    id: 'old-money-quiet-luxury',
    name: 'Old Money / Quiet Luxury',
    description: 'Understated opulence with impeccable fabrics and zero logos',
    archetypes: { classic: 0.35, glamorous: 0.25, minimalist: 0.25, romantic: 0.1, vintage: 0.05 },
    signature: {
      colors: ['cream', 'navy', 'camel', 'white', 'grey', 'black', 'chocolate', 'ivory'],
      materials: ['cashmere', 'silk', 'wool', 'leather', 'cotton', 'linen'],
      patterns: ['solid', 'striped'],
      formality_range: [3, 5],
      style_tags: ['quiet-luxury', 'understated', 'logoless', 'tailored', 'investment', 'timeless', 'refined'],
      favored_categories: ['outerwear', 'tops', 'bottoms', 'bags', 'shoes'],
    },
  },
  {
    id: 'scandinavian-minimal',
    name: 'Scandinavian Minimal',
    description: 'Functional simplicity with cozy textures and a muted Nordic palette',
    archetypes: { minimalist: 0.4, cozy: 0.25, classic: 0.2, athletic: 0.1, bohemian: 0.05 },
    signature: {
      colors: ['white', 'grey', 'black', 'cream', 'oatmeal', 'pale blue', 'sand', 'muted green'],
      materials: ['wool', 'cotton', 'knit', 'leather', 'linen', 'cashmere'],
      patterns: ['solid', 'striped'],
      formality_range: [1, 3],
      style_tags: ['hygge', 'functional', 'cozy', 'layered', 'nordic', 'organic', 'simple', 'clean'],
      favored_categories: ['outerwear', 'tops', 'bottoms', 'shoes', 'accessories'],
    },
  },
  {
    id: 'maximalist-eclectic',
    name: 'Maximalist Eclectic',
    description: 'Bold patterns, vibrant color mixing, and joyful self-expression',
    archetypes: { maximalist: 0.5, bohemian: 0.15, glamorous: 0.15, edgy: 0.1, vintage: 0.1 },
    signature: {
      colors: ['fuchsia', 'cobalt', 'emerald', 'gold', 'orange', 'turquoise', 'red', 'purple'],
      materials: ['silk', 'velvet', 'cotton', 'synthetic', 'knit', 'leather'],
      patterns: ['floral', 'geometric', 'animal-print', 'abstract', 'graphic', 'striped'],
      formality_range: [1, 4],
      style_tags: ['bold', 'colorful', 'mixed-prints', 'statement', 'eclectic', 'layered', 'expressive'],
      favored_categories: ['dresses', 'tops', 'accessories', 'jewelry', 'bags'],
    },
  },
];

// ── Lookup Helpers ──────────────────────────────────────────

const PRESET_MAP = new Map(ARCHETYPE_PRESETS.map((p) => [p.id, p]));

export function getPresetById(id: string): ArchetypePreset | undefined {
  return PRESET_MAP.get(id);
}

export function getAllPresets(): ArchetypePreset[] {
  return ARCHETYPE_PRESETS;
}
