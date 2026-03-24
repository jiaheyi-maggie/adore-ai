-- ═══════════════════════════════════════════════════════════
-- Migration 00007: Add context_archetypes to style_profiles
-- Supports Feature I: Style Modes (Per-Context Profiles)
-- Shape: { "work": { "classic": 0.4, "minimalist": 0.3 }, ... }
-- ═══════════════════════════════════════════════════════════

ALTER TABLE style_profiles ADD COLUMN IF NOT EXISTS
  context_archetypes jsonb DEFAULT '{}';
