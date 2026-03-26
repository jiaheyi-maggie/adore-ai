# Adore Feature Roadmap

> Definitive feature planning reference. Synthesized from two rounds of brainstorming.
> Last updated: 2026-03-26

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| SHIPPED | In the codebase and working |
| NEXT | Queued for current sprint cycle |
| PLANNED | Scoped and designed, not yet started |
| HORIZON | Designed but deferred (month 2-3) |
| MOONSHOT | High-conviction long-term bets (month 3-6) |
| BACKLOG | Tracked, not yet prioritized |

---

## What's Shipped

These features are live in the codebase. Reference only -- do not re-scope or re-build.

| Feature | Description |
|---------|-------------|
| Style DNA Spectrum | 6-axis radar chart + AI-generated style summary |
| Aspiration Gap | Delta visualization between actual vs aspirational style on profile |
| Style Modes | Per-occasion archetype profiles (work, weekend, date night, etc.) |
| Mood-First Selection | 5 mood chips affecting outfit scoring weights |
| Today Tab + Outfit Engine | Hero-piece heuristic, 6 scoring dimensions, full generation pipeline |
| Tap-to-Swap | Swap individual items in generated outfits |
| Dismiss with Reason | Dismiss outfit items with reason feedback (emits preference signals) |
| Intent Picker | Pre-outfit context selection (occasion, formality, etc.) |
| Wishlist Universal Capture | Search-first flow, WishlistButton, ProductCard components |
| Check with Adore | Anti-return purchase advisor: happiness score + cross-signal context |
| Style Shifting | 12 presets, bridge outfits, gap-filling shopping list |
| Navigation (Stack > Tabs) | Detail screens pushed onto Stack over Tabs; router.back() works correctly |

---

## Sprint Roadmap

### Sprint 1.5: Infrastructure

> **Effort:** 2-3 hours | **Status:** NEXT
> **Why now:** Unblocks Discovery Feed, Seasonal Audit, and Stylist Chat -- three features that all need the same context layer.

| Task | Detail |
|------|--------|
| Context Layer extraction | Extract inline context queries from `/wishlist/check` into shared `user-context.ts` with composable slice functions. 5 consumers: Check Purchase, Discovery Feed, Seasonal Audit, Stylist Chat, Notifications. |
| Search signal emission | Emit `searched` preference signals from `POST /wishlist/search` and `POST /wishlist/items/scan`. Signal type already exists in DB schema, just never emitted. |

**Architectural decisions:**
- Context Layer uses Option B (composable slices, no caching until 10K+ DAU)
- Search signals go into existing `preference_signals` table; defer `behavior_events` table to Sprint 4

---

### Sprint 2: Seasonal Wardrobe Audit

> **Effort:** 2 days | **Status:** NEXT
> **Why now:** High user value, builds on Context Layer, drives re-engagement every season change.

**Core experience:** "Summer is 6 weeks away. Your readiness: 72%"

| Component | Detail |
|-----------|--------|
| Readiness score | Compare current wardrobe against seasonal needs based on weather data + outfit history |
| Year-over-year comparison | Compare against last year's outfit journal -- identify items gone since last season |
| Gap identification | Surface missing categories (e.g., "You had 3 linen shirts last summer, now you have 0") |
| Replacement suggestions | Aligned with active style shift goals; ranked by Happiness Function |
| Budget timeline | Spread replacement purchases across weeks leading up to season, respecting monthly budget |

**Depends on:** Sprint 1.5 (Context Layer)

---

### Sprint 3: Personalized Discovery Feed

> **Effort:** 2-3 days | **Status:** PLANNED
> **Why now:** First revenue-adjacent feature (affiliate-ready cards). Turns passive users into engaged browsers.

**Core experience:** New "Discover" tab with swipeable product cards.

| Card Type | Query Source |
|-----------|-------------|
| Gap Filler | Wardrobe gaps from seasonal audit + style shift needs |
| Style Shift Nudge | Bridge items toward aspirational style |
| Similar-But-Better | Upgrades for low-happiness items you still wear |
| Outfit Inspiration | Complete looks buildable from your wardrobe + 1 new piece |
| Brand Discovery | New brands matching your taste graph, weighted by price range + brand affinity |

**Interaction model:**
- Swipe right to wishlist (emits `wishlisted` signal)
- Swipe left to dismiss (emits `dismissed` signal with implicit reason)
- Discovery Mode toggle: Contentment / Browsing / Shopping (affects card mix aggressiveness)

**Depends on:** Sprint 1.5 (Context Layer), Sprint 2 (gap data)

---

### Sprint 4: Daily Snap -- "BeReal for Outfits"

> **Effort:** 2 weeks | **Status:** PLANNED
> **Why now:** THE keystone engagement feature. Solves cold start, drives daily retention, and passively builds the wardrobe database.

**Core experience:** Daily push notification at user-configured time. Camera opens instantly. Snap, 1-tap mood, AI decomposes outfit into items, done. Target: 8-15 seconds total.

| Component | Detail |
|-----------|--------|
| Push notifications | `expo-notifications` setup, permission flow, `daily_snap_time` user setting |
| Stripped-down capture | Minimal camera screen optimized for speed, not beauty |
| AI decomposition | Claude vision identifies items from photo, matches to existing wardrobe or creates new entries |
| Streak tracking | Visible on Journal tab; streak count + calendar heat map |
| Cold start solution | After 30 days: 90-150 items cataloged with zero explicit wardrobe-building effort |

**Why this is the most important feature not yet built:**
- Wardrobe apps die because cataloging is tedious (Pain 1 from OVERVIEW.md)
- Daily Snap turns cataloging into a 10-second habit instead of a 2-hour chore
- Streak mechanic drives daily opens
- Every snap generates 3-5 wardrobe items + mood signal + outfit journal entry -- triple data value per interaction

**Depends on:** None (can start in parallel after Sprint 1.5)

---

### Sprint 5: AI Stylist Persona + Emotional UX

> **Effort:** 1-2 weeks | **Status:** PLANNED
> **Why now:** Closes the "human stylist" gap. Makes the app feel like a friend who knows you, not a scoring engine.

**5A: Emotional Reassurance (ship first — lowest effort, highest trust impact)**

| Component | Detail |
|-----------|--------|
| Wardrobe Wins | New `wardrobe-wins.ts` — computes Power Piece (high happiness + confident mood), Joy Bringer (creative mood), Hidden Gem (low wears, high rating), Reliability King (most worn, 7+ happiness) |
| Outfit confirmation | `POST /outfits` response includes warm `reassurance` field: "That blazer has a 100% confidence rating — every time you've worn it, you tagged 'powerful'" |
| Stylist context | Enhanced system prompt with wins data + anti-sycophancy rules. Warmth is evidence-based, never generic. |
| Where it surfaces | Today tab (rotating Wins card), Profile tab (Wardrobe Wins section), Stylist Chat, Daily Snap confirmation |

**5B: "Challenge Me" Mode (ship second — needs trust from 5A)**

| Component | Detail |
|-----------|--------|
| Habit detection | New `habit-detector.ts` — color distribution, category frequency, combination repeats, dormant items, formality rut |
| Challenge outfits | New `'challenge'` intent that inverts recency penalty, reduces color harmony weight, boosts aspiration-aligned items |
| Scaffolded risk | Never more than ONE unfamiliar item per outfit. Rest are trusted favorites. |
| Intensity ladder | Level 1-4 stored in agent_memories. Positive mood tags on challenges → level up. Negative → level down. |
| Aspiration mandate | Challenges lean toward the user's aspirational archetype (from Aspiration Gap). "You told us you want bohemian — try this." |

**5C: "Stylist's Wild Card" (ship third — highest risk, needs monitoring)**

| Component | Detail |
|-----------|--------|
| Wild card outfit | 4th outfit slot on Today tab with inverted scoring weights: negative formality weight rewards contrast, minimal color harmony |
| Guardrails | Weather always positive-weighted. 2+ items must have happiness >= 6. Gemini validation: "Is this wearable as intentional styling?" |
| Framing | "The formality mismatch is intentional — it's what makes this interesting." Styling notes explain WHY the tension works. |
| Prominent toggle | "Wild" added to intent selector strip alongside Default/Comfort/Statement |

**UX Polish (same sprint)**

| Change | Before | After |
|--------|--------|-------|
| Mood chip naming | "confident" | "power mode" |
| | "comfortable" | "soft day" |
| | "creative" | "main character energy" |
| | "powerful" | "boss mode" |
| | "relaxed" | "easy breezy" |
| Proactive nudges | (none) | "You haven't worn your suede boots in 52 days" on home screen |
| Stylist Chat starters | Static prompts | Dynamic conversation starters based on recent activity |

---

### Sprint 6: Collections / Trip Packing

> **Effort:** 1-2 weeks | **Status:** PLANNED
> **Why now:** High-intent use case (travel) that drives multi-day engagement and showcases AI intelligence.

**Core experience:** "Pack for Lisbon, 5 days, 75 degrees F" -- AI generates capsule wardrobe from your closet.

| Component | Detail |
|-----------|--------|
| Collections table | New `collections` + `collection_items` bridge tables |
| Trip packing flow | Destination, duration, weather (API integration), occasion mix |
| AI capsule generation | Maximize outfit combinations while minimizing items; respect checked-bag constraints |
| Event-based planning | Dinner Thursday, museum Friday, beach Saturday -- occasion-specific outfits within the capsule |
| Post-trip rating | Happiness rating per outfit after trip; feeds preference signals |

---

## Horizon 2: Month 2-3

### Visual Outfit Collage

> **Effort:** 2-3 weeks | **Status:** HORIZON

Transform outfit suggestions from "a list of items" to "a look."

- Canvas-composite background-removed images into flat-lay moodboard layout
- Uses existing `image_url_clean` (rembg background removal already in pipeline)
- Shareable to Instagram Stories / saved to camera roll
- Potential viral loop: collage watermarked with "styled by Adore"

---

### Outfit Context Enrichment

> **Effort:** 1 week | **Status:** HORIZON

Make the AI's reasoning visible and trustworthy.

| Element | Example |
|---------|---------|
| Context echo line on outfit cards | "Bold picks for your confident mood -- layered for 68 degrees F" |
| "Why this outfit" expandable | Top 3-4 scoring factors: mood alignment, weather fit, style DNA match, cost efficiency |
| Hero item indicator | Subtle accent border + tooltip on the piece driving the outfit's score |

---

### Style Shift Network

> **Effort:** 2-3 weeks | **Status:** HORIZON
> **Why it matters:** First data network effect. Your style shift gets better because other people shifted too.

| Component | Detail |
|-----------|--------|
| Aggregation tables | `shift_transition_stats` + `shift_item_insights` (anonymized) |
| Social proof | "287 users shifted to Clean Minimalist. 72% reached their goal. Avg 11 weeks." |
| Crowd intelligence | Best bridge pieces, top purchases, common regrets -- shown during style shift flow |
| Privacy | All data anonymized and aggregated; no individual user data exposed |

---

### Anti-Impulse Enhancement with Search History

> **Effort:** 1 week | **Status:** HORIZON

| Signal | Value |
|--------|-------|
| Deliberation score | "You've been looking at blazers for 3 weeks -- this isn't impulse" |
| Search-purchase cross-reference | Strengthen Check with Adore verdicts using browsing history |
| Taste Graph enrichment | Search behavior as a leading indicator of style evolution (searches precede purchases by weeks) |

---

## Horizon 3: Month 3-6 -- Moonshot Moats

These are the features that make Adore defensible. Each one creates a compounding advantage that competitors cannot replicate without years of user data.

### Moat 1: Anti-Return Affiliate Commerce

> **Status:** MOONSHOT

| Component | Detail |
|-----------|--------|
| Share sheet / browser extension | "Check with Adore" available from any shopping app or browser |
| Affiliate URL pipeline | `external_products.affiliate_url` field already in schema |
| Premium rates | Pitch to brands: "Our users return 60% fewer items. Pay us more per conversion." |
| Revenue model | Affiliate commissions on purchases that score 7.0+ on Happiness Function |

---

### Moat 2: Style Twins

> **Status:** MOONSHOT

| Component | Detail |
|-----------|--------|
| Matching algorithm | 512-dimensional vector similarity search on Taste Graph embeddings |
| Social proof | "Your Style Twin scored this outfit 9.1" |
| Privacy-first | Opt-in, anonymous by default. No profiles, no follows, no feed drama. |
| Value prop | See what works for someone with your exact taste -- without the social media performance |

---

### Moat 3: Taste Genome

> **Status:** MOONSHOT

| Component | Detail |
|-----------|--------|
| Fine-tuned model | FashionSigLIP embeddings trained on (image, happiness, mood, context) tuples |
| Proprietary encoding | Taste-space that captures "how wearing this feels" -- not just visual similarity |
| Moat depth | Requires millions of behavioral data points; cannot be bootstrapped |

---

### Moat 4: Happiness Guarantee

> **Status:** MOONSHOT

| Component | Detail |
|-----------|--------|
| Guarantee | Items scoring 8.0+ on Happiness Function get a wear guarantee |
| Funding | Funded by affiliate commissions from Moat 1 |
| Marketing | "The only app that guarantees you'll love what you buy" |
| Prerequisite | Happiness Function accuracy must exceed 85% before launch |

---

## V2 Backlog

Tracked features that are not yet prioritized into sprints. Pull from here as sprint capacity allows.

### Discovery & Content

| Feature | Notes |
|---------|-------|
| Real-time trend scraping | RSS feeds + fashion site monitoring for trend detection |
| Email parsing for brand newsletters | OAuth + IMAP integration; surface deals and new arrivals |
| Weekly Style Digest | Personalized newsletter with real trend data, not generic content |

### Commerce & Marketplace

| Feature | Notes |
|---------|-------|
| Price tracking / drop alerts | Monitor wishlisted items for price changes |
| One In, One Out suggestions | "Buy this blazer, sell that old one" -- wardrobe size management |
| Affiliate link generation pipeline | Automated affiliate URL attachment for recommended products |

### Social

| Feature | Notes |
|---------|-------|
| Style Twins matching | (See Moat 2 above -- promoted from backlog to Moonshot) |
| Social sharing | Deep-linked outfit cards / purchase verdicts for iMessage, IG Stories |
| Style Shift Network | (See Horizon 2 above -- promoted from backlog) |

### Retention

| Feature | Notes |
|---------|-------|
| Streaks + reward cards | Gamification layer beyond Daily Snap streaks |
| Push notification suite | Budget guardian, dormant item rescue, deal alerts, seasonal reminders |
| Monthly Style Wrapped | Analytics recap: items worn, cost-per-wear improvements, style drift |
| Instagram share card | Branded, shareable style summary card |

### Intelligence

| Feature | Notes |
|---------|-------|
| Wardrobe Lifecycle Intelligence | `lifecycle_stage` per item: new, rotation, dormant, archive, sell |
| Brand Intelligence view | Standalone analytics: which brands make you happiest, best cost-per-wear |
| Adore Forecast (B2B) | Anonymized demand signals sold to brands/retailers |
| Passive Closet Sync | NFC tags, smart mirror integration, Bluetooth beacon detection |

### Polish & Tech Debt

| Feature | Notes | Priority |
|---------|-------|----------|
| Test suite | **Biggest tech debt.** Zero tests exist today. | HIGH |
| Dark mode | Expected by users, straightforward with design system | MEDIUM |
| Travel packing mode (standalone) | Lighter version of Collections for quick trips | LOW (superseded by Sprint 6) |

---

## Competitive Positioning

### vs Wishi (human stylists, $40-550/session)

| Dimension | Adore Advantage |
|-----------|----------------|
| Intelligence | Happiness Function + Taste Graph vs human intuition |
| Economics | Zero marginal cost per styling session |
| Anti-impulse | Built-in purchase scoring; Wishi incentivized to sell |
| Style evolution | Style Shifting with measurable progress tracking |
| **Steal from Wishi** | Collections/trip packing, visual collage, emotional mood framing, proactive nudges |
| **Skip** | Human stylists, membership tiers, per-session pricing |

### vs Cladwell / Stylebook / Acloset (basic wardrobe trackers)

| Dimension | Adore Advantage |
|-----------|----------------|
| Intelligence layer | AI scoring, behavioral data, purchase advisor -- they have none |
| Data feedback loop | Every interaction improves recommendations |
| Style evolution | No competitor tracks or enables intentional style change |

### vs Stitchfix (human + algo, buy-box model)

| Dimension | Adore Advantage |
|-----------|----------------|
| Wardrobe scope | Works with YOUR wardrobe, not shipped boxes |
| Data ownership | User owns their taste data; Stitchfix owns theirs |
| Alignment | Anti-impulse ethos vs "buy more boxes" incentive |

---

## Architectural Decisions Log

Decisions made during brainstorming, locked for implementation.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Context Layer pattern | Option B: composable slices in `user-context.ts` | 5 consumers need different subsets; slices are testable and tree-shakeable |
| Context Layer caching | None (defer to 10K+ DAU) | Premature optimization; queries are fast enough at current scale |
| Search history storage | Emit into existing `preference_signals` table | Signal type `searched` already in schema, never emitted. No new tables needed. |
| Behavior events table | Defer to Sprint 4 | Only needed when Discovery Feed requires richer event taxonomy |
| Navigation pattern | Stack wrapping Tabs | Detail screens at `app/` root, pushed onto Stack over Tabs. `router.back()` returns to originating tab. |
| Daily Snap notification | `expo-notifications` + `daily_snap_time` user setting | Native push; user controls timing for habit formation |

---

## Sprint Dependency Graph

```
Sprint 1.5 (Infrastructure)
    |
    +---> Sprint 2 (Seasonal Audit)
    |         |
    |         +---> Sprint 3 (Discovery Feed)
    |
    +---> Sprint 4 (Daily Snap) [can start after 1.5, parallel to 2-3]
              |
              +---> Sprint 5 (Emotional UX) [no hard dependency, polish pass]
                        |
                        +---> Sprint 6 (Collections / Trip Packing)
```

**Critical path:** 1.5 -> 2 -> 3 (revenue-adjacent)
**Highest impact:** 1.5 -> 4 (engagement + cold start solve)
**Recommended execution:** Start Sprint 4 in parallel with Sprint 2-3 if two engineers available.

---

## How to Use This Document

- **Engineers:** Read the sprint you're working on. Each sprint has effort estimate, dependencies, and component breakdown.
- **PM (you):** Use the dependency graph and status legend to track progress. Move features from PLANNED to NEXT when dependencies clear.
- **Design:** Sprint 5 (Emotional UX) needs copy/naming review. Sprint 4 (Daily Snap) needs camera UX flow.
- **Updating:** When a sprint ships, move it to the "What's Shipped" table and update the status of dependent sprints.
