-- ═══════════════════════════════════════════════════════════
-- Adore — Initial Schema Migration
-- Creates all Phase 1+ tables with RLS, indexes, triggers
-- ═══════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Utility: auto-update updated_at trigger ─────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 1. users
-- Extends Supabase auth.users with profile data
-- ═══════════════════════════════════════════════════════════

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  budget_monthly numeric(10, 2),
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update ON users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_delete ON users
  FOR DELETE USING (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════
-- 2. style_profiles (1:1 with users)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  color_season text CHECK (color_season IN (
    'spring-light', 'spring-warm', 'spring-clear',
    'summer-light', 'summer-cool', 'summer-soft',
    'autumn-warm', 'autumn-deep', 'autumn-soft',
    'winter-cool', 'winter-deep', 'winter-clear'
  )),
  skin_undertone text CHECK (skin_undertone IN ('warm', 'cool', 'neutral')),
  style_archetypes jsonb NOT NULL DEFAULT '{}',
  color_preferences jsonb NOT NULL DEFAULT '{}',
  formality_distribution jsonb NOT NULL DEFAULT '{"casual": 0, "smart_casual": 0, "business": 0, "formal": 0, "black_tie": 0}',
  brand_affinities jsonb NOT NULL DEFAULT '{}',
  price_range jsonb NOT NULL DEFAULT '{"min": 0, "max": 0, "sweet_spot": 0}',
  avoided_styles text[] NOT NULL DEFAULT '{}',
  body_metrics jsonb,
  taste_vector vector(512),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX style_profiles_user_id_idx ON style_profiles(user_id);

CREATE TRIGGER style_profiles_updated_at
  BEFORE UPDATE ON style_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY style_profiles_select ON style_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY style_profiles_insert ON style_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY style_profiles_update ON style_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY style_profiles_delete ON style_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 3. wardrobe_items
-- ═══════════════════════════════════════════════════════════

CREATE TABLE wardrobe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'tops', 'bottoms', 'dresses', 'outerwear', 'shoes',
    'accessories', 'bags', 'jewelry', 'activewear',
    'swimwear', 'sleepwear', 'undergarments'
  )),
  subcategory text,
  colors text[] NOT NULL DEFAULT '{}',
  pattern text NOT NULL DEFAULT 'solid' CHECK (pattern IN (
    'solid', 'striped', 'plaid', 'floral', 'graphic',
    'polka-dot', 'animal-print', 'geometric', 'abstract', 'other'
  )),
  material text CHECK (material IN (
    'cotton', 'denim', 'silk', 'leather', 'synthetic', 'wool',
    'linen', 'cashmere', 'polyester', 'nylon', 'velvet', 'suede', 'knit', 'other'
  )),
  brand text,
  size text,
  formality_level integer NOT NULL DEFAULT 3 CHECK (formality_level >= 1 AND formality_level <= 5),
  seasons text[] NOT NULL DEFAULT '{}',
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN (
    'new', 'like-new', 'good', 'fair', 'worn'
  )),
  purchase_price numeric(10, 2),
  purchase_date date,
  purchase_source text,
  image_url text,
  image_url_clean text,
  times_worn integer NOT NULL DEFAULT 0,
  cost_per_wear numeric(10, 2),
  happiness_score numeric(4, 2),
  versatility_score numeric(4, 2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'stored', 'listed', 'sold', 'donated', 'archived'
  )),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  CONSTRAINT wardrobe_items_source_check CHECK (source IN (
    'manual', 'email', 'outfit-journal', 'receipt-scan'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wardrobe_items_user_id_idx ON wardrobe_items(user_id);
CREATE INDEX wardrobe_items_user_status_idx ON wardrobe_items(user_id, status);
CREATE INDEX wardrobe_items_user_category_idx ON wardrobe_items(user_id, category);

CREATE TRIGGER wardrobe_items_updated_at
  BEFORE UPDATE ON wardrobe_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY wardrobe_items_select ON wardrobe_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wardrobe_items_insert ON wardrobe_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wardrobe_items_update ON wardrobe_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY wardrobe_items_delete ON wardrobe_items
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 4. item_embeddings
-- ═══════════════════════════════════════════════════════════

CREATE TABLE item_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  embedding vector(512) NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, model_version)
);

CREATE INDEX item_embeddings_item_id_idx ON item_embeddings(item_id);
CREATE INDEX item_embeddings_embedding_hnsw_idx ON item_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE item_embeddings ENABLE ROW LEVEL SECURITY;

-- item_embeddings doesn't have user_id directly; policy checks via wardrobe_items
CREATE POLICY item_embeddings_select ON item_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wardrobe_items
      WHERE wardrobe_items.id = item_embeddings.item_id
        AND wardrobe_items.user_id = auth.uid()
    )
  );
CREATE POLICY item_embeddings_insert ON item_embeddings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wardrobe_items
      WHERE wardrobe_items.id = item_embeddings.item_id
        AND wardrobe_items.user_id = auth.uid()
    )
  );
CREATE POLICY item_embeddings_update ON item_embeddings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wardrobe_items
      WHERE wardrobe_items.id = item_embeddings.item_id
        AND wardrobe_items.user_id = auth.uid()
    )
  );
CREATE POLICY item_embeddings_delete ON item_embeddings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM wardrobe_items
      WHERE wardrobe_items.id = item_embeddings.item_id
        AND wardrobe_items.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 5. external_products
-- (Before outfits, since outfit_items references it)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE external_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  category text CHECK (category IN (
    'tops', 'bottoms', 'dresses', 'outerwear', 'shoes',
    'accessories', 'bags', 'jewelry', 'activewear',
    'swimwear', 'sleepwear', 'undergarments'
  )),
  price numeric(10, 2) NOT NULL,
  image_url text NOT NULL,
  source_url text NOT NULL,
  affiliate_url text,
  retailer text NOT NULL,
  attributes jsonb NOT NULL DEFAULT '{}',
  embedding vector(512),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX external_products_embedding_hnsw_idx ON external_products
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- external_products are shared across users (product catalog), so RLS is more permissive
ALTER TABLE external_products ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read products
CREATE POLICY external_products_select ON external_products
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service_role can insert/update/delete (background jobs populate this)
CREATE POLICY external_products_insert ON external_products
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY external_products_update ON external_products
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY external_products_delete ON external_products
  FOR DELETE USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════
-- 6. outfits
-- ═══════════════════════════════════════════════════════════

CREATE TABLE outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occasion text CHECK (occasion IN (
    'work', 'casual', 'date-night', 'formal-event', 'workout',
    'travel', 'interview', 'wedding-guest', 'brunch', 'night-out',
    'wfh', 'errand'
  )),
  weather_context jsonb,
  source text NOT NULL DEFAULT 'journaled' CHECK (source IN (
    'generated', 'journaled', 'saved', 'aspirational'
  )),
  happiness_score numeric(4, 2),
  mood_tag text CHECK (mood_tag IN (
    'confident', 'comfortable', 'creative', 'powerful',
    'relaxed', 'overdressed', 'underdressed', 'meh'
  )),
  worn_date date,
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outfits_user_id_idx ON outfits(user_id);
CREATE INDEX outfits_user_worn_date_idx ON outfits(user_id, worn_date DESC);

CREATE TRIGGER outfits_updated_at
  BEFORE UPDATE ON outfits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY outfits_select ON outfits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY outfits_insert ON outfits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY outfits_update ON outfits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY outfits_delete ON outfits
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 7. outfit_items
-- ═══════════════════════════════════════════════════════════

CREATE TABLE outfit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  wardrobe_item_id uuid REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  external_product_id uuid REFERENCES external_products(id) ON DELETE SET NULL,
  layer_position integer NOT NULL DEFAULT 0,
  is_owned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- At least one of wardrobe_item_id or external_product_id must be set
  CONSTRAINT outfit_items_has_reference CHECK (
    wardrobe_item_id IS NOT NULL OR external_product_id IS NOT NULL
  )
);

CREATE INDEX outfit_items_outfit_id_idx ON outfit_items(outfit_id);
CREATE INDEX outfit_items_wardrobe_item_id_idx ON outfit_items(wardrobe_item_id);

ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;

-- RLS via parent outfit
CREATE POLICY outfit_items_select ON outfit_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM outfits
      WHERE outfits.id = outfit_items.outfit_id
        AND outfits.user_id = auth.uid()
    )
  );
CREATE POLICY outfit_items_insert ON outfit_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM outfits
      WHERE outfits.id = outfit_items.outfit_id
        AND outfits.user_id = auth.uid()
    )
  );
CREATE POLICY outfit_items_update ON outfit_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM outfits
      WHERE outfits.id = outfit_items.outfit_id
        AND outfits.user_id = auth.uid()
    )
  );
CREATE POLICY outfit_items_delete ON outfit_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM outfits
      WHERE outfits.id = outfit_items.outfit_id
        AND outfits.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 8. preference_signals (APPEND-ONLY)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE preference_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  CONSTRAINT preference_signals_signal_type_check CHECK (signal_type IN (
    'wore', 'rated', 'purchased', 'returned', 'skipped',
    'wishlisted', 'sold', 'searched', 'tried-on', 'photographed'
  )),
  item_id uuid REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  outfit_id uuid REFERENCES outfits(id) ON DELETE SET NULL,
  value jsonb NOT NULL DEFAULT '{}',
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX preference_signals_user_id_idx ON preference_signals(user_id);
CREATE INDEX preference_signals_user_created_idx ON preference_signals(user_id, created_at DESC);
CREATE INDEX preference_signals_user_type_idx ON preference_signals(user_id, signal_type);

ALTER TABLE preference_signals ENABLE ROW LEVEL SECURITY;

-- APPEND-ONLY: SELECT and INSERT only, no UPDATE or DELETE
CREATE POLICY preference_signals_select ON preference_signals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY preference_signals_insert ON preference_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 9. wishlist_items
-- ═══════════════════════════════════════════════════════════

CREATE TABLE wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  source_url text,
  price numeric(10, 2),
  brand text,
  category text CHECK (category IN (
    'tops', 'bottoms', 'dresses', 'outerwear', 'shoes',
    'accessories', 'bags', 'jewelry', 'activewear',
    'swimwear', 'sleepwear', 'undergarments'
  )),
  priority text NOT NULL DEFAULT 'want' CHECK (priority IN ('need', 'want', 'dream')),
  happiness_score_prediction numeric(4, 2),
  similar_owned_count integer NOT NULL DEFAULT 0,
  versatility_impact numeric(4, 2),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'purchased', 'dismissed')),
  price_alert_threshold numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX wishlist_items_user_id_idx ON wishlist_items(user_id);
CREATE INDEX wishlist_items_user_status_idx ON wishlist_items(user_id, status);

CREATE TRIGGER wishlist_items_updated_at
  BEFORE UPDATE ON wishlist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY wishlist_items_select ON wishlist_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY wishlist_items_insert ON wishlist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY wishlist_items_update ON wishlist_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY wishlist_items_delete ON wishlist_items
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 10. agent_memories
-- Uses supersession chains — never delete, use superseded_by
-- ═══════════════════════════════════════════════════════════

CREATE TABLE agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN (
    'working', 'episodic', 'semantic', 'procedural'
  )),
  content text NOT NULL,
  embedding vector(512),
  importance_score numeric(4, 2) NOT NULL DEFAULT 5.0,
  access_count integer NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid REFERENCES agent_memories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_memories_user_id_idx ON agent_memories(user_id);
CREATE INDEX agent_memories_user_type_idx ON agent_memories(user_id, memory_type);
CREATE INDEX agent_memories_embedding_hnsw_idx ON agent_memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_memories_select ON agent_memories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY agent_memories_insert ON agent_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY agent_memories_update ON agent_memories
  FOR UPDATE USING (auth.uid() = user_id);
-- No delete policy — supersession only. Service role can clean up if needed.

-- ═══════════════════════════════════════════════════════════
-- 11. budget_periods
-- ═══════════════════════════════════════════════════════════

CREATE TABLE budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  budget_amount numeric(10, 2) NOT NULL,
  spent_amount numeric(10, 2) NOT NULL DEFAULT 0,
  happiness_per_dollar numeric(6, 4),
  impulse_buy_count integer NOT NULL DEFAULT 0,
  planned_buy_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_periods_dates_valid CHECK (period_end > period_start)
);

CREATE INDEX budget_periods_user_id_idx ON budget_periods(user_id);
CREATE INDEX budget_periods_user_dates_idx ON budget_periods(user_id, period_start DESC);

CREATE TRIGGER budget_periods_updated_at
  BEFORE UPDATE ON budget_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE budget_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_periods_select ON budget_periods
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY budget_periods_insert ON budget_periods
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY budget_periods_update ON budget_periods
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY budget_periods_delete ON budget_periods
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 12. style_goals
-- ═══════════════════════════════════════════════════════════

CREATE TABLE style_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_state jsonb NOT NULL DEFAULT '{}',
  current_progress integer NOT NULL DEFAULT 0 CHECK (current_progress >= 0 AND current_progress <= 100),
  deadline date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'paused', 'abandoned'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX style_goals_user_id_idx ON style_goals(user_id);
CREATE INDEX style_goals_user_status_idx ON style_goals(user_id, status);

CREATE TRIGGER style_goals_updated_at
  BEFORE UPDATE ON style_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE style_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY style_goals_select ON style_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY style_goals_insert ON style_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY style_goals_update ON style_goals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY style_goals_delete ON style_goals
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 13. purchases (NEW — not in original types)
-- Tracks purchase lifecycle from order to delivery/return
-- ═══════════════════════════════════════════════════════════

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wardrobe_item_id uuid REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  retailer text NOT NULL,
  order_number text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  items_data jsonb NOT NULL DEFAULT '[]',
  total_amount numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN (
    'ordered', 'delivered', 'returned', 'partial_return'
  )),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'email', 'receipt_scan'
  )),
  email_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchases_user_id_idx ON purchases(user_id);
CREATE INDEX purchases_user_date_idx ON purchases(user_id, purchase_date DESC);
CREATE INDEX purchases_user_status_idx ON purchases(user_id, status);

CREATE TRIGGER purchases_updated_at
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select ON purchases
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY purchases_insert ON purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY purchases_update ON purchases
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY purchases_delete ON purchases
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 14. conversations (NEW — chat history)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX conversations_user_id_idx ON conversations(user_id);
CREATE INDEX conversations_user_updated_idx ON conversations(user_id, updated_at DESC);

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select ON conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY conversations_insert ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY conversations_update ON conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY conversations_delete ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 15. messages (NEW — individual chat messages)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  tool_calls jsonb,
  token_usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX messages_conversation_created_idx ON messages(conversation_id, created_at ASC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS via parent conversation
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
-- Messages are generally immutable once created, but allow update for token_usage backfill
CREATE POLICY messages_update ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );
CREATE POLICY messages_delete ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 16. happiness_weights (per-user tuning of the Happiness Function)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE happiness_weights (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  w_wear_frequency numeric(4, 3) NOT NULL DEFAULT 0.200,
  w_versatility numeric(4, 3) NOT NULL DEFAULT 0.150,
  w_aspiration numeric(4, 3) NOT NULL DEFAULT 0.125,
  w_budget numeric(4, 3) NOT NULL DEFAULT 0.125,
  w_uniqueness numeric(4, 3) NOT NULL DEFAULT 0.100,
  w_emotional numeric(4, 3) NOT NULL DEFAULT 0.125,
  w_cost_per_wear numeric(4, 3) NOT NULL DEFAULT 0.100,
  w_seasonal numeric(4, 3) NOT NULL DEFAULT 0.075,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER happiness_weights_updated_at
  BEFORE UPDATE ON happiness_weights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE happiness_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY happiness_weights_select ON happiness_weights
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY happiness_weights_insert ON happiness_weights
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY happiness_weights_update ON happiness_weights
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY happiness_weights_delete ON happiness_weights
  FOR DELETE USING (auth.uid() = user_id);
