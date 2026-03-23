-- ═══════════════════════════════════════════════════════════
-- Adore — Migration 006: Add hanger-flip scan method
-- Extends wardrobe_scans method constraint + wardrobe_items
-- source constraint to support rapid closet scanning
-- ═══════════════════════════════════════════════════════════

-- ── Extend wardrobe_scans method to include 'hanger-flip' ──
ALTER TABLE wardrobe_scans DROP CONSTRAINT IF EXISTS wardrobe_scans_method_check;
ALTER TABLE wardrobe_scans ADD CONSTRAINT wardrobe_scans_method_check
  CHECK (method IN (
    'video-closet', 'batch-photo', 'single-item', 'outfit-journal',
    'email-import', 'retailer-import', 'social-import', 'hanger-flip'
  ));

-- ── Extend wardrobe_items source to include 'hanger-flip' ──
ALTER TABLE wardrobe_items DROP CONSTRAINT IF EXISTS wardrobe_items_source_check;
ALTER TABLE wardrobe_items ADD CONSTRAINT wardrobe_items_source_check
  CHECK (source IN (
    'manual', 'email', 'outfit-journal', 'receipt-scan',
    'video-scan', 'batch-photo', 'retailer-import', 'social-import',
    'hanger-flip'
  ));
