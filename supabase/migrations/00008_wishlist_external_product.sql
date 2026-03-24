-- ═══════════════════════════════════════════════════════════
-- Migration 00008: Link wishlist items to external products
-- Supports Wishlist Universal Product Capture feature
-- ═══════════════════════════════════════════════════════════

ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS
  external_product_id uuid REFERENCES external_products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS wishlist_items_external_product_id_idx
  ON wishlist_items(external_product_id);
