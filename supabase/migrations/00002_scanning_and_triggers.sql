-- ═══════════════════════════════════════════════════════════
-- Adore — Migration 002: Video/Batch Scanning + Triggers
-- Adds wardrobe scanning tables, auto-signup trigger,
-- extended source types, and corrected_attribute signal
-- ═══════════════════════════════════════════════════════════

-- ── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- fuzzy text search for brand matching

-- ── Extend wardrobe_items source types ─────────────────────
-- Drop and recreate the check constraint to include new scan sources
ALTER TABLE wardrobe_items DROP CONSTRAINT IF EXISTS wardrobe_items_source_check;
ALTER TABLE wardrobe_items ADD CONSTRAINT wardrobe_items_source_check
  CHECK (source IN (
    'manual', 'email', 'outfit-journal', 'receipt-scan',
    'video-scan', 'batch-photo', 'retailer-import', 'social-import'
  ));

-- ── Extend preference_signals to include corrected_attribute ─
ALTER TABLE preference_signals DROP CONSTRAINT IF EXISTS preference_signals_signal_type_check;
ALTER TABLE preference_signals ADD CONSTRAINT preference_signals_signal_type_check
  CHECK (signal_type IN (
    'wore', 'rated', 'purchased', 'returned', 'skipped',
    'wishlisted', 'sold', 'searched', 'tried-on', 'photographed',
    'corrected_attribute'
  ));

-- ── Brand fuzzy search index ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_brand_trgm
  ON wardrobe_items USING gin(brand gin_trgm_ops)
  WHERE brand IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- Wardrobe Scans (video/batch import sessions)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS wardrobe_scans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method                  text NOT NULL CHECK (method IN (
    'video-closet', 'batch-photo', 'single-item', 'outfit-journal',
    'email-import', 'retailer-import', 'social-import'
  )),
  status                  text NOT NULL DEFAULT 'processing' CHECK (status IN (
    'processing', 'review', 'confirmed', 'failed'
  )),
  source_media_url        text,
  items_detected          integer NOT NULL DEFAULT 0,
  items_confirmed         integer NOT NULL DEFAULT 0,
  items_rejected          integer NOT NULL DEFAULT 0,
  processing_started_at   timestamptz NOT NULL DEFAULT now(),
  processing_completed_at timestamptz,
  error                   text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wardrobe_scans_user ON wardrobe_scans(user_id, created_at DESC);

ALTER TABLE wardrobe_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY wardrobe_scans_select ON wardrobe_scans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wardrobe_scans_insert ON wardrobe_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wardrobe_scans_update ON wardrobe_scans
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- Scan Detections (individual items found in a scan)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scan_detections (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id                   uuid NOT NULL REFERENCES wardrobe_scans(id) ON DELETE CASCADE,
  wardrobe_item_id          uuid REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  crop_image_url            text NOT NULL,
  clean_image_url           text,
  detection_confidence      numeric NOT NULL DEFAULT 0,
  classification_confidence numeric NOT NULL DEFAULT 0,
  auto_attributes           jsonb NOT NULL DEFAULT '{}',
  user_attributes           jsonb,
  status                    text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'rejected', 'merged'
  )),
  merged_with_item_id       uuid REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  source_frame_index        integer,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_detections_scan ON scan_detections(scan_id);

ALTER TABLE scan_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY scan_detections_select ON scan_detections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wardrobe_scans ws WHERE ws.id = scan_id AND ws.user_id = auth.uid())
  );
CREATE POLICY scan_detections_insert ON scan_detections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM wardrobe_scans ws WHERE ws.id = scan_id AND ws.user_id = auth.uid())
  );
CREATE POLICY scan_detections_update ON scan_detections
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM wardrobe_scans ws WHERE ws.id = scan_id AND ws.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════
-- Auto-create user profile + weights on signup
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  );

  INSERT INTO style_profiles (user_id) VALUES (NEW.id);
  INSERT INTO happiness_weights (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END;
$$;
