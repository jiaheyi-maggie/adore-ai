-- ═══════════════════════════════════════════════════════════
-- Adore — Marketplace Listings
-- One-Tap Sell: AI-generated listings for resale platforms
-- ═══════════════════════════════════════════════════════════

CREATE TABLE marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wardrobe_item_id uuid NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,

  -- Platform & status
  platform text NOT NULL CHECK (platform IN ('depop', 'poshmark', 'ebay', 'mercari', 'other')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'pending_sale', 'sold', 'cancelled', 'expired')),

  -- Listing content
  title text NOT NULL,
  description text NOT NULL DEFAULT '',

  -- Pricing
  suggested_price numeric(10, 2),
  listed_price numeric(10, 2),
  sold_price numeric(10, 2),
  price_suggestion jsonb, -- full PriceSuggestion breakdown

  -- External platform link
  external_listing_id text,
  external_listing_url text,

  -- Lifecycle timestamps
  listed_at timestamptz,
  sold_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX marketplace_listings_user_id_idx ON marketplace_listings(user_id);
CREATE INDEX marketplace_listings_status_idx ON marketplace_listings(status);
CREATE INDEX marketplace_listings_wardrobe_item_id_idx ON marketplace_listings(wardrobe_item_id);
CREATE INDEX marketplace_listings_user_status_idx ON marketplace_listings(user_id, status);

-- Auto-update updated_at
CREATE TRIGGER marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_listings_select ON marketplace_listings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY marketplace_listings_insert ON marketplace_listings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY marketplace_listings_update ON marketplace_listings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY marketplace_listings_delete ON marketplace_listings
  FOR DELETE USING (auth.uid() = user_id);
