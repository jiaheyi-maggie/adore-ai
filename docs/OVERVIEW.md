# Adore — Your Style Intelligence

> "The first app that knows what you own, what you actually wear, what suits you, and what will make you happy next."

**Adore** is an AI-powered personal stylist and wardrobe intelligence platform that treats fashion as a data problem. It combines persistent AI memory, a personalized happiness function, and behavioral taste analysis to help you dress better, spend smarter, and build a wardrobe that genuinely brings you joy.

---

## Table of Contents

1. [Why This Exists](#1-why-this-exists)
2. [The Insight](#2-the-insight)
3. [Target User](#3-target-user)
4. [Product Vision](#4-product-vision)
5. [The Happiness Function](#5-the-happiness-function)
6. [The Taste Graph](#6-the-taste-graph)
7. [Core Features](#7-core-features)
8. [Architecture](#8-architecture)
9. [AI/ML Strategy](#9-aiml-strategy)
10. [Data Model](#10-data-model)
11. [Business Model](#11-business-model)
12. [Competitive Landscape](#12-competitive-landscape)
13. [The Moat](#13-the-moat)
14. [Anti-Features](#14-anti-features)
15. [Success Metrics](#15-success-metrics)
16. [Phased Roadmap](#16-phased-roadmap)

---

## 1. Why This Exists

### The 8 Pain Points

Every person who cares about how they dress faces the same set of unsolved problems:

**Pain 1: Wardrobe scanning is tedious.**
The average person owns 100-150 clothing items. Existing apps require you to photograph each one individually — lay it flat, snap it, tag it, repeat 150 times. Users start with enthusiasm, catalog 30-40 items, and abandon the app. The cold start problem kills retention before the product ever delivers value.

**Pain 2: Selling clothes is a completely separate workflow.**
If you've already cataloged your wardrobe digitally — with photos, descriptions, and condition info — why can't you just tap "sell this" and list it? Instead, you have to re-photograph items, re-describe them, navigate to Poshmark/Depop/Mercari, and go through their listing flow. Two separate apps, two separate efforts. Nobody does this.

**Pain 3: No app has persistent memory of your style.**
Every interaction with every fashion app starts from zero context. No app remembers what you like, what you've bought, what you returned, how your taste has evolved, or what you told it last month. There is no long-term AI relationship — just stateless outfit generators.

**Pain 4: No cost model for desire management.**
You see things you want to buy everywhere — Instagram ads, Pinterest boards, store windows, friends' outfits. These desires accumulate with no system for managing them. There's no unified wish list, no budget-aware prioritization, no "needs vs wants" framework, no way to know: "Should I actually buy this, or is this an impulse that I'll regret?"

**Pain 5: Outfit generation is limited to what you own.**
Every wardrobe app generates outfits exclusively from your existing items. But what if you're ONE piece away from a great outfit? What if buying a $80 blazer would unlock 15 new combinations? What if your budget this month can accommodate it? No app does the math on buy-vs-substitute.

**Pain 6: No long-term style evolution tracking.**
You might want to "level up" your wardrobe gradually — build a jewelry collection, transition from casual to business casual, develop a signature color palette. No app tracks these goals, measures progress, or adjusts recommendations to nudge you toward where you want to be.

**Pain 7: Wardrobe doesn't auto-update from purchases.**
You buy clothes online constantly. Confirmation emails, shipping notifications, delivery receipts — all the data is in your inbox. But your wardrobe app doesn't know about any of it. You have to manually add every purchase. If you forget (you will), the wardrobe database drifts from reality.

**Pain 8: Occasion-based planning has no reality check.**
When you need to dress for a specific event, you either scroll Instagram/Pinterest for inspiration (generic, not based on what you own) or stare at your closet hoping something works. There's no tool that separates "what I can pull together tonight in 30 minutes" from "what I want to be able to wear long-term and should build toward."

### The Market Failure

The wardrobe app market ($224M in 2024, growing to $399M by 2032) has produced dozens of apps — Indyx, Whering, Alta, Cladwell, Acloset, Fits, Stylebook — and none have broken through to mainstream adoption. 90-day retention across the category is 28%. Day-30 retention is 5.6%.

Why? Because every app is a **point solution**:
- Indyx does wardrobe + resale, but no intelligence
- Whering does analytics, but no resale or budget tracking
- Alta does great scanning, but no full lifecycle
- Cladwell does capsule philosophy, but nothing else
- Fits does virtual try-on, but wardrobe management is secondary

No product connects the full lifecycle: **acquire → organize → style → evolve → sell → acquire better.**

And critically, three pain points remain **completely unaddressed** by any existing product:
- Persistent AI context (pain 3) — no one does this
- Budget-aware desire management (pain 4) — no one does this
- Long-term style evolution goals (pain 6) — no one does this

These three compound into a retention mechanic the entire category is missing: **an app that gets smarter over time.**

---

## 2. The Insight

### Don't Build a Wardrobe App. Build a Taste Graph.

Spotify didn't build a music player — they built a **taste graph**. The music player was the surface. The real product was the behavioral data: what you actually listen to, what you skip, what you replay, when you listen to what. That data powers Discover Weekly, which feels like magic, which drives daily usage, which generates more data. Flywheel.

Adore is the Spotify model applied to fashion.

The wardrobe scanner is not the product. The outfit generator is not the product. The product is the **behavioral dataset of what you actually wear, how it makes you feel, and what that reveals about your true style.**

Every day a user logs what they wore, rates an outfit, adds a wish list item, or makes a purchase, the dataset gets more valuable. After 6 months of daily use, Adore knows your taste better than you know yourself. The switching cost becomes infinite — no competing app has your history.

### The Happiness Function Makes It Quantitative

Most fashion apps deal in subjective aesthetics: "This looks good." Adore introduces an objective optimization target: **maximize the happiness you derive from what you wear.**

The Happiness Function is a personalized reward model that learns, from your actual behavior, what makes you happy vs. what you *think* will make you happy. It turns every fashion decision — buy, sell, keep, wear, skip — into a data point that improves the model.

This reframes the entire product from "wardrobe organizer" to **"personal optimization engine for how you present yourself to the world."**

---

## 3. Target User

### Primary Persona: Priya

**Demographics:** 26-35, urban professional, $80K-$180K income. Disposable clothing budget: ~$200-500/month, but spends erratically.

**Behavior:**
- Owns ~150-200 items but wears the same 15-20 on rotation
- Has downloaded 1-2 wardrobe apps before; abandoned both within 2 weeks
- Browses Instagram/Pinterest/TikTok daily for style inspiration; screenshots looks she likes; never acts on 90% of them
- Keeps a Notes app list of "things I want to buy" that she never reviews strategically
- Returns ~25-30% of online purchases
- Feels simultaneous "I have nothing to wear" and guilt about overconsumption

**Hair-on-fire moment:** Standing in front of her closet at 7:45am, late for work, wearing one of the same 5 outfits on rotation despite owning 180 items. At lunch, she impulse-buys a $90 top that duplicates something she already owns.

**Why Priya:**
- High enough income to have a real wardrobe, not high enough to hire a human stylist ($200-500/session)
- Digitally native, comfortable with AI, already uses AI tools at work
- Fashion-interested but not fashion-obsessed — wants to look good, not become a fashion blogger
- The pain is both financial (wasted money on duplicates, impulse purchases) and emotional (decision fatigue, guilt cycle)

### Secondary Persona: Marcus

**Demographics:** 30-40, tech professional, $120K-$250K income. Minimal fashion interest but wants to "look put together."

**Behavior:**
- Owns ~60-80 items, mostly basics
- Knows nothing about color theory, styling, or outfit composition
- Buys the same things repeatedly because he doesn't know what else to get
- Would happily pay for something that tells him exactly what to wear each day

**Why Marcus matters:** He represents the "fashion-unaware" market — people who want the output (looking good) without the process (learning about fashion). For Marcus, the AI stylist IS the product. He won't use outfit journals or style analytics. He wants: "What do I wear today?" answered in 3 seconds. His happiness function is simpler (comfort, appropriateness, low effort) but equally valid.

---

## 4. Product Vision

### The Wardrobe Lifecycle, Unified

```
    ┌──────────────────────────────────────────────────────┐
    │                    ADORE LIFECYCLE                     │
    │                                                       │
    │   DISCOVER          ACQUIRE          ORGANIZE         │
    │   ┌─────────┐      ┌─────────┐      ┌─────────┐     │
    │   │ Wish    │ ───► │ Buy     │ ───► │ Catalog │     │
    │   │ List    │      │ Smart   │      │ Auto    │     │
    │   └─────────┘      └─────────┘      └─────────┘     │
    │       ▲                                   │          │
    │       │              STYLE                ▼          │
    │       │            ┌─────────┐      ┌─────────┐     │
    │       │            │ Outfit  │ ◄─── │ Wardrobe│     │
    │       │            │ Generate│      │ Intel   │     │
    │       │            └─────────┘      └─────────┘     │
    │       │                │                             │
    │       │    EVOLVE      ▼          RELEASE            │
    │   ┌─────────┐    ┌─────────┐    ┌─────────┐        │
    │   │ Style   │    │ Wear &  │    │ Sell /  │        │
    │   │ Goals   │◄───│ Rate    │───►│ Donate  │        │
    │   └─────────┘    └─────────┘    └─────────┘        │
    │                       │                              │
    │                       ▼                              │
    │              ┌─────────────────┐                     │
    │              │  HAPPINESS      │                     │
    │              │  FUNCTION       │                     │
    │              │  (learns from   │                     │
    │              │   everything)   │                     │
    │              └─────────────────┘                     │
    └──────────────────────────────────────────────────────┘
```

### Two Modes of Operation

**Tonight Mode** — "I have an event in 30 minutes. What do I wear?"
- Constraint: only items currently available (clean, accessible)
- Input: occasion type, weather, time pressure
- Output: 3 outfit options ranked by happiness score, ready to wear NOW

**Aspiration Mode** — "I want to be able to pull off this look."
- No time constraint. Mix owned + purchasable items.
- Budget-aware: "This look requires 2 new items totaling $160."
- Goal-tracking: "You're 70% of the way to this aesthetic."
- Timeline: "At your current budget, you'll complete this in 6 weeks."

---

## 5. The Happiness Function

### What It Is

The Happiness Function is a personalized reward model — `H(item, user, context) → score [0-10]` — that predicts how much joy a clothing item or outfit will bring you, based on your behavioral history.

It is NOT a subjective "do I like how this looks" rating. It is an empirical model trained on what you *actually do* — how often you wear things, how they make you feel, what you reach for vs. what sits in the closet.

### Why It Matters

The fashion industry's entire business model is predicated on creating desire, not satisfaction. Ads make you want things. Sales create urgency. Influencers generate FOMO. None of these signals correlate with how happy the purchase will actually make you.

The Happiness Function is the antidote. It answers: **"Given everything I know about you — your style, your body, your budget, your goals, and the 200 clothing decisions you've made in the past year — will buying this make your life measurably better?"**

This is a fundamentally new value proposition. No fashion app, no retailer, and no stylist offers this.

### The Model

```
H(item, user, context) = weighted_sum(
    w1 · wear_frequency_prediction,     // Will you actually wear this?
    w2 · versatility_score,             // How many outfits does it unlock?
    w3 · aspiration_alignment,          // Does it move you toward your style goals?
    w4 · budget_impact,                 // Can you afford this joy?
    w5 · uniqueness_in_wardrobe,        // Do you already own something similar?
    w6 · emotional_prediction,          // Based on past mood tags for similar items
    w7 · cost_per_wear_projection,      // Economic value over time
    w8 · seasonal_relevance             // Is this useful now or in 6 months?
)
```

### Input Signals (What Feeds the Model)

| Signal | Type | How Captured | Weight |
|--------|------|-------------|--------|
| **Wear frequency** | Behavioral | Outfit journal — what you actually wore | Highest |
| **Outfit mood tags** | Explicit | User rates "how did this make you feel?" (confident, comfortable, meh, overdressed, etc.) | High |
| **Cost-per-wear trajectory** | Derived | purchase_price / times_worn, tracked over time | High |
| **Versatility score** | Derived | Number of distinct outfits this item appears in | High |
| **Time-to-first-wear** | Behavioral | Days between purchase and first wear | Medium |
| **Return history for similar items** | Behavioral | Your return rate for this brand/category/style | Medium |
| **Reached-for-but-didn't-wear** | Behavioral | Items considered during outfit selection but passed over | Medium |
| **Browse-to-buy ratio** | Behavioral | How long an item sat on wish list before purchase | Medium |
| **Compliment/photo correlation** | Behavioral | Did you photograph yourself? Get tagged more? Save the outfit? | Low-Medium |
| **Purchase context** | Contextual | Impulse buy vs. planned purchase vs. filling a wardrobe gap | Medium |
| **Similar item satisfaction** | Derived | Happiness scores of items with similar attributes in your wardrobe | Medium |
| **Aspiration alignment** | Derived | How well this item fits declared style goals | Medium |

### Output: The Happiness Score

A single number, 0-10, with expandable reasoning. Examples:

**High Score (8.2/10):**
> **Navy wool blazer — $120 at J.Crew**
> - Wear prediction: 2-3x/week based on your professional lifestyle → HIGH
> - Versatility: Unlocks 14 new outfit combinations with your existing wardrobe → HIGH
> - Return risk: 0% return rate for J.Crew blazers in your history → LOW RISK
> - Cost-per-wear: $2.40 projected over 12 months → EXCELLENT
> - Aspiration: Aligns with your "more polished workwear" goal → YES
> - Uniqueness: You don't own a navy blazer (gap filled) → HIGH

**Low Score (2.8/10):**
> **Graphic tee — $45 at Urban Outfitters**
> - Wear prediction: 1-2x based on similar item history → LOW
> - Uniqueness: You own 6 similar graphic tees, average wear: 2x each → REDUNDANT
> - Return risk: 60% return rate for impulse tees → HIGH RISK
> - Historical pattern: You buy these when stressed, regret within a week → IMPULSE FLAG
> - Cost-per-wear: $22.50 projected → POOR
> - Aspiration: Does not align with any current style goal → NO

### The Anti-Impulse Engine

The Happiness Function enables a powerful anti-impulse feature:

```
User screenshots a jacket from Instagram.
↓
Adore runs the Happiness Function:
↓
"Hold on. Items you discover via social media have an average
happiness score of 3.1 in your history. Items you discover by
identifying wardrobe gaps score 7.8.

Want to check if your wardrobe actually needs this first?"
↓
User taps "Check my wardrobe"
↓
"You own 2 similar jackets. They average 4 wears each.
Your predicted happiness for this purchase: 2.9/10.

Alternatively: you don't own a structured blazer, which would
unlock 14 new outfits. Here are 3 options in your budget that
score 7.5+ on your happiness function."
```

This is **a cognitive behavioral tool dressed as a wardrobe app.** It shows people the gap between their impulse decisions and their actual satisfaction patterns.

### Happiness Function Evolution Over Time

The weights (`w1` through `w8`) are personalized per user and update continuously:

- **Week 1:** Generic weights based on aggregate user data. Happiness scores are directionally useful but not personalized.
- **Month 1:** Enough wear data and ratings to start personalizing. Accuracy improves noticeably.
- **Month 3:** The model has seen 60+ outfit decisions and 5-10 purchases. Predictions become reliable. Users start trusting the score.
- **Month 6+:** The model knows the user better than they know themselves. It can predict with high confidence whether a purchase will be worn 50 times or sit in the closet. This is when the switching cost becomes real — no other app has this data.

### Happiness Reports

Monthly "Happiness Report" shows:
- **Average happiness score** of items worn this month vs. last month
- **Best performer:** The item with highest cost-per-wear improvement
- **Worst performer:** The item you bought but haven't worn
- **Budget efficiency:** "You spent $340 on clothing. Your average happiness-per-dollar was 6.2. Last month it was 4.8. You're getting better at buying things that make you happy."
- **Impulse tracking:** "3 of your 5 purchases this month were impulse buys. They averaged 3.1 happiness. Your planned purchases averaged 7.4."

---

## 6. The Taste Graph

### What It Is

The Taste Graph is a multi-dimensional representation of your style identity, derived from behavioral data (not stated preferences). It captures:

- **Color affinities:** Not what colors you say you like, but what colors you actually reach for on a Tuesday morning.
- **Silhouette preferences:** Fitted vs. relaxed, cropped vs. long, structured vs. flowing.
- **Formality distribution:** What percentage of your life is casual / smart casual / business / formal.
- **Brand affinities:** Which brands you return to, which you abandon.
- **Style archetype blend:** Minimalist 40%, Classic 30%, Streetwear 20%, Bohemian 10%.
- **Price sensitivity curve:** At what price point does perceived value drop? When do you get buyer's remorse?
- **Seasonal patterns:** How your style shifts with weather and seasons.

### Aspirational vs. Actual

The most important insight the Taste Graph reveals: **the gap between your aspirational style and your actual style.**

Many people pin minimalist Scandinavian outfits on Pinterest but reach for colorful, maximalist pieces every morning. Their aspirational self says "clean lines, neutral palette." Their behavioral self says "bold prints, statement jewelry."

Adore shows both. It doesn't judge. It says: "Here's what you actually wear. Here's what you say you want to wear. The gap is here. Do you want to close it, or do you want to update your goals to match your real preferences?"

This self-awareness is the product's most valuable output. It's not about clothes. It's about **knowing yourself.**

### Taste Graph as a Social Layer (Phase 3+)

Once the Taste Graph exists per user, it enables:

- **Style twins:** "Your taste graph is 92% similar to @user. See their recent outfits." Discovery without influencer culture.
- **Outfit inspiration that actually works:** Instead of showing random Pinterest outfits, show outfits from people with similar taste graphs AND similar wardrobes.
- **Collaborative filtering:** "Users with your taste graph who bought X wore it 40 times." This is Spotify's collaborative filtering but for fashion.

### Taste Graph as a Commerce Layer (Phase 4+)

The Taste Graph is the most valuable dataset in fashion because it answers the question every brand desperately wants answered: **"What do real people actually wear?"**

Brands currently guess using: purchase data (noisy — gifts, impulse buys, sale items), browsing data (aspirational — people browse things they'd never actually wear), and influencer proxies (fake — sponsored content doesn't reflect genuine preference).

Adore owns the **ground truth**: what people put on their body every day, combined with how it makes them feel. At scale, this data (anonymized, aggregated, with consent) is worth more than the consumer subscription revenue.

---

## 7. Core Features

### 7.1 Wardrobe Intelligence

**Passive Wardrobe Building (the key innovation):**
The wardrobe builds itself. Three passive ingestion channels:

1. **Email/receipt auto-import:** Connect Gmail → Adore scans for purchase confirmations → extracts item details → adds to wardrobe pending user confirmation. Handles returns automatically (detects return confirmation emails and flags items for removal).

2. **Outfit journal (daily snap):** User photographs what they're wearing today. AI decomposes the outfit into individual items and catalogs each one. Over 30 days, this passively catalogs 60-150 items (2-5 per outfit × 30 days).

3. **Manual photo scan (fallback):** Camera with guided capture. Lay item flat, snap it. AI removes background, extracts attributes (color, category, pattern, fabric, brand, formality, season). Batch mode for initial onboarding.

The design principle: **the wardrobe is an output of using the app, not an input required to use it.**

**Wardrobe Analytics:**
- Category breakdown (14 tops, 8 bottoms, 6 dresses, etc.)
- Color distribution map
- Versatility scores per item (how many outfits does it appear in?)
- Cost-per-wear leaderboard
- "Never worn" and "rarely worn" identification
- Wardrobe gaps: "You have 0 items in [category] — this limits your outfit options."
- Seasonal readiness: "You're well-stocked for summer but have gaps for fall."

### 7.2 AI Stylist (Persistent Agent)

A conversational AI stylist that remembers everything:

**Memory layers:**
- **Working memory:** Current conversation context, today's weather, today's calendar
- **Episodic memory:** Past conversations, outfit ratings, stated preferences ("I told you I don't like yellow")
- **Semantic memory:** Style profile, brand affinities, size info, body proportions
- **Procedural memory:** Learned styling rules specific to the user ("she always rolls her sleeves," "he pairs this watch with formal outfits")

**Capabilities:**
- "What should I wear today?" → Weather-aware, calendar-aware, considers what you wore recently (avoids repetition)
- "Style this piece" → Given one item, generate complete outfit from wardrobe
- "I have a wedding in Tuscany next month" → Generate capsule packing list, identify gaps, suggest purchases within budget
- "Should I buy this?" → Run the Happiness Function, give data-backed recommendation
- "How has my style changed?" → Show Taste Graph evolution over time
- "Why do I keep buying things I don't wear?" → Analyze purchase patterns, identify impulse triggers

**What makes it different from ChatGPT + "style me":**
The persistent memory. After 3 months, the stylist knows: your exact wardrobe, your body proportions, your comfort zones, your aspirations, your budget, your lifestyle, which of its past suggestions you loved and which you ignored. It is a genuine long-term relationship, not a stateless chatbot.

### 7.3 Outfit Generation Engine

**From-wardrobe generation:**
- Input: occasion, weather, mood, time constraint
- Filter: available items (clean, in season, accessible)
- Score: outfit compatibility (color harmony, formality match, style coherence)
- Rank: by happiness function score
- Output: Top 3 outfits, visually composed, with explanations

**Hybrid generation (owned + purchasable):**
- After generating best wardrobe-only outfits, identify: "You're one piece away from a better outfit"
- Search product catalogs for the missing piece
- Show: owned items + suggested purchase, with happiness score and cost-per-wear projection
- Budget check: "This is within your monthly budget" or "This would put you $40 over budget — still worth it?"

**Buy-vs-substitute decision engine:**
- "You need a white button-down. You don't own one. Happiness score for buying: 8.1."
- "Alternatively: you own a cream silk blouse (happiness score as substitute: 6.3) or a white t-shirt (happiness score: 4.1)."
- "Your budget has $120 remaining this month. Recommendation: buy the button-down. It unlocks 12 outfits and you'll use it year-round."

### 7.4 Budget & Desire Management

**The Intelligent Wish List:**
- Add items via screenshot, link, or description
- Auto-categorized as **Need** (fills a wardrobe gap), **Want** (doesn't fill a gap but you desire it), or **Dream** (aspirational, not budget-ready)
- Each item gets a Happiness Score prediction
- Duplicate detection: "You already own 3 similar items. Average wear: 2x each."
- Price tracking: alerts when wish list items go on sale
- Sort by: happiness score, price, urgency, versatility impact

**Budget Tracker:**
- Set monthly/quarterly clothing budget
- Track spending vs. budget with visual progress bar
- Cost-per-wear analytics across entire wardrobe
- Monthly spending report: total spent, happiness-per-dollar efficiency, impulse vs. planned ratio
- Projection: "At this rate, your average cost-per-wear across all items will be $X by year-end"

### 7.5 Style Evolution & Goals

**Style Goals:**
- "Build a capsule wardrobe of 40 versatile items" → progress tracker, suggestions
- "Develop a jewelry collection" → identify gaps, suggest acquisitions, track progress
- "Transition from casual to business casual" → gradual recommendations, milestone tracking
- "Reduce fast fashion to <20% of wardrobe" → track composition, suggest sustainable alternatives
- "Develop a signature color palette" → color analysis, palette recommendations, gap filling

**Evolution Tracking:**
- Monthly Taste Graph snapshots: how your style is changing
- "6 months ago you wore 80% casual. Now you're 50% casual, 40% smart casual. Your goal was this shift — you're ahead of schedule."
- Anti-suggestions: "You've been drifting toward impulse streetwear purchases. This conflicts with your stated goal of 'more polished.' Want to adjust your goal or refocus?"

### 7.6 Marketplace Integration (One-Tap Sell)

**Listing generation:**
- Select any wardrobe item → "Sell this"
- Auto-generates: cleaned photo (background already removed), AI-written title and description, suggested price (based on brand + condition + comparable sales data + original purchase price)
- One-tap list to supported platforms

**Integration strategy (pragmatic):**
- Phase 1: Generate listing package (title, description, price, photos) → user copy-pastes to marketplace of choice
- Phase 2: eBay direct API integration (most robust public API)
- Phase 3: Partner with cross-listing tools (Vendoo, List Perfectly) for Poshmark/Depop/Mercari

**Smart sell suggestions:**
- "You haven't worn this in 6 months. Similar items sell for $45 on Depop. Want to list it?"
- "This item's cost-per-wear is $62 (worn once). Selling it recovers $30, bringing effective cost to $32."
- "You're 2 items away from your capsule wardrobe goal. Selling these 5 rarely-worn items would fund 3 of the items on your wish list."

### 7.7 Color Analysis & Personal Palette

**Selfie-based color analysis:**
- Upload a selfie in natural lighting
- AI analyzes skin undertone, eye color, natural hair color
- Determines seasonal color palette (spring/summer/autumn/winter and sub-seasons)
- Maps every wardrobe item to the palette: "72% of your wardrobe is in your best colors. 18% is neutral. 10% clashes with your palette."

**Color-aware features:**
- Outfit generation respects color harmony rules (complementary, analogous, triadic)
- Shopping recommendations prioritize colors in the user's palette
- "Your wardrobe has 14 black tops and 0 warm-toned neutrals. Here's your color gap."

### 7.8 Occasion & Context Intelligence

**Calendar integration:**
- Pull events from Google Calendar
- Infer dress code from event titles and descriptions
- Multi-context days: "You have a team standup at 10am and dinner at 7:30pm — want outfits for both?"

**Weather intelligence:**
- Not just "will it rain" — feels-like temperature, humidity, UV index, indoor/outdoor ratio
- Layering logic: "45°F at 8am, 68°F by noon → suggest a removable layer"

**Travel packing:**
- "I'm going to Tokyo for 5 days. Business dinner, 2 tourist days, 1 temple visit."
- Generates capsule packing list: maximum outfits from minimum items
- Identifies gaps: "You don't own versatile walking shoes — here's one for $X."
- Weather forecast integration for the destination

### 7.9 Outfit Journal

The daily habit that powers everything:

- **Quick capture:** Snap a photo of what you're wearing. Takes 5 seconds.
- **Auto-decomposition:** AI identifies individual items in the outfit photo, matches to wardrobe items (or adds new ones).
- **Mood tag:** Optional — "How do you feel in this?" (confident, comfortable, overdressed, creative, meh)
- **Context tag:** Auto-detected from calendar/weather, or manual (work, date, casual, event)

**Why this is the core mechanic:**
Every outfit journal entry simultaneously:
1. Builds the wardrobe passively (items auto-cataloged)
2. Generates wear frequency data (happiness function input)
3. Creates outfit compatibility data (what goes with what)
4. Captures emotional data (mood tags)
5. Trains the Taste Graph (actual vs. aspirational)
6. Updates cost-per-wear for every item in the outfit

One 5-second action feeds six systems. This is the atomic habit that makes everything else work.

---

## 8. Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  iOS App    │  │ Android App │  │  Web App (Phase 3)  │  │
│  │  (Expo/RN)  │  │  (Expo/RN)  │  │  (Next.js)          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         └────────────────┼─────────────────────┘             │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTPS / WebSocket
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        API LAYER                              │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                  API Gateway (Hono)                     │   │
│  │  Routes: /auth, /wardrobe, /outfits, /agent,          │   │
│  │          /wishlist, /budget, /marketplace, /analytics   │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│  ┌──────────┐  ┌────────┴────────┐  ┌───────────────────┐   │
│  │  Auth    │  │  Business Logic  │  │  Background Jobs  │   │
│  │  Module  │  │  (Core Domain)   │  │  (Inngest/Cron)   │   │
│  └──────────┘  └─────────────────┘  └───────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                     DATA & AI LAYER                           │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ PostgreSQL │  │  pgvector  │  │  Object Storage (R2)   │ │
│  │ (Supabase) │  │ (embeddings│  │  (images)              │ │
│  │            │  │  & search) │  │                        │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ Redis      │  │ Claude API │  │  FashionSigLIP         │ │
│  │ (cache)    │  │ (AI core)  │  │  (fashion embeddings)  │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ rembg      │  │ Gmail API  │  │  Weather/Calendar API  │ │
│  │ (bg remove)│  │ (receipts) │  │  (context)             │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Mobile** | React Native (Expo) | Cross-platform, single codebase. Expo camera/image APIs are mature. |
| **Backend** | Hono (TypeScript) on Fly.io | Lightweight, fast, TypeScript end-to-end. Edge-capable. |
| **Database** | PostgreSQL via Supabase | Relational data + pgvector for embeddings + Auth + Storage + RLS. One platform. |
| **Vector Search** | pgvector (HNSW index) | Per-user wardrobe is <1,000 items. pgvector handles this trivially. No need for dedicated vector DB until 1M+ users. |
| **Image Storage** | Cloudflare R2 (or Supabase Storage) | S3-compatible, CDN-fronted, cheap. |
| **Cache** | Upstash Redis | Outfit generation cache, style profile cache, weather cache. Serverless Redis. |
| **AI Core** | Claude API (Anthropic) | Vision for item recognition. Text for outfit generation, styling chat, receipt parsing. Structured output for reliability. |
| **Fashion Embeddings** | Marqo-FashionSigLIP | 512-dim fashion-specific embeddings. +57% over FashionCLIP. Powers similarity search and outfit scoring. |
| **Background Removal** | rembg (self-hosted) | Open-source, free, fast. Cloth-segmentation model included. |
| **Email Parsing** | Gmail API + Claude extraction | OAuth read-only. LLM-based extraction generalizes across retailers without per-retailer templates. |
| **Weather** | OpenWeather API | Free tier is sufficient. Feels-like temp, UV, precipitation. |
| **Calendar** | Google Calendar API | Event detection, dress code inference. |
| **Product Search** | ShopStyle Collective API | Aggregated fashion product catalog with affiliate revenue sharing. |
| **Background Jobs** | Inngest | Event-driven job processing. Email scanning, embedding generation, nightly analytics. |
| **Push Notifications** | Expo Push + OneSignal | Occasion reminders, sale alerts, outfit suggestions. |

---

## 9. AI/ML Strategy

### Phase 1: LLM-First (MVP)

No custom ML models. Claude handles everything:

| Task | Model | Cost/Call | Latency |
|------|-------|----------|---------|
| Item attribute extraction (from photo) | Claude Sonnet (Vision) | ~$0.005 | 2-3s |
| Outfit generation | Claude Sonnet | ~$0.02 | 3-5s |
| Stylist conversation | Claude Sonnet | ~$0.01 | 1-3s |
| Receipt/email parsing | Claude Haiku | ~$0.001 | 1-2s |
| Listing description generation | Claude Haiku | ~$0.001 | 1-2s |
| Happiness score calculation | Claude Haiku | ~$0.002 | 1-2s |

**Total per-user cost: ~$0.90/month**

Why LLM-first: LLMs have surprisingly strong fashion knowledge from training data. They understand color theory, style archetypes, occasion-appropriateness, and brand positioning. For a startup, this is 80% as good as custom ML at 1% of the development cost.

### Phase 2: Hybrid (Post-PMF)

Add embedding-based systems alongside LLMs:

- **FashionSigLIP embeddings** for fast similarity search and outfit compatibility pre-filtering
- **Collaborative filtering** once user base exceeds ~1,000 active users
- **Personalized happiness function weights** learned from individual user data via gradient-free optimization (evolutionary strategies or Bayesian optimization on the weight vector)

### Phase 3: Custom Models (Scale)

At 100K+ users with rich behavioral data:

- Fine-tuned CLIP model for fashion-specific embeddings (trained on user outfit ratings)
- Custom outfit scoring model (trained on millions of outfit ratings)
- Distilled receipt parser (100x cheaper than LLM, runs locally)
- On-device outfit suggestion model (instant, no API call)

---

## 10. Data Model

### Core Entities

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    User       │     │ StyleProfile │     │   StyleGoal      │
│──────────────│     │──────────────│     │──────────────────│
│ id           │──┐  │ user_id (FK) │     │ user_id (FK)     │
│ email        │  │  │ color_season │     │ goal_type        │
│ name         │  │  │ body_metrics │     │ target_state     │
│ created_at   │  │  │ taste_vector │     │ current_progress │
│ budget_month │  │  │ formality_   │     │ deadline         │
│              │  │  │   distribution│     │ status           │
└──────────────┘  │  │ updated_at   │     └──────────────────┘
                  │  └──────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │         WardrobeItem                  │
                  │  │──────────────────────────────────────│
                  ├──│ id                                    │
                  │  │ user_id (FK)                          │
                  │  │ name                                  │
                  │  │ category (enum)                       │
                  │  │ subcategory                           │
                  │  │ colors (array)                        │
                  │  │ pattern                               │
                  │  │ material                              │
                  │  │ brand                                 │
                  │  │ size                                  │
                  │  │ formality_level (1-5)                 │
                  │  │ seasons (array)                       │
                  │  │ condition                             │
                  │  │ purchase_price                        │
                  │  │ purchase_date                         │
                  │  │ purchase_source                       │
                  │  │ image_url (original)                  │
                  │  │ image_url_clean (bg removed)          │
                  │  │ times_worn (derived)                  │
                  │  │ cost_per_wear (derived)               │
                  │  │ happiness_score (derived)             │
                  │  │ versatility_score (derived)           │
                  │  │ status (active|stored|listed|sold)    │
                  │  │ source (manual|email|outfit_journal)  │
                  │  │ created_at                            │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │         ItemEmbedding                 │
                  │  │──────────────────────────────────────│
                  │  │ item_id (FK)                          │
                  │  │ embedding (vector[512])               │
                  │  │ model_version                         │
                  │  │ created_at                            │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │           Outfit                      │
                  │  │──────────────────────────────────────│
                  ├──│ id                                    │
                  │  │ user_id (FK)                          │
                  │  │ occasion                              │
                  │  │ weather_context                       │
                  │  │ source (generated|journaled|saved)    │
                  │  │ happiness_score                       │
                  │  │ mood_tag                              │
                  │  │ worn_date                             │
                  │  │ photo_url (outfit journal photo)      │
                  │  │ notes                                 │
                  │  │ created_at                            │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │         OutfitItem                    │
                  │  │──────────────────────────────────────│
                  │  │ outfit_id (FK)                        │
                  │  │ wardrobe_item_id (FK, nullable)       │
                  │  │ external_product_id (FK, nullable)    │
                  │  │ layer_position                        │
                  │  │ is_owned (boolean)                    │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │       PreferenceSignal                │
                  │  │──────────────────────────────────────│  ← APPEND-ONLY
                  ├──│ id                                    │
                  │  │ user_id (FK)                          │
                  │  │ signal_type (enum: wore, rated,       │
                  │  │   purchased, returned, skipped,       │
                  │  │   wishlisted, sold, searched)         │
                  │  │ item_id (FK, nullable)                │
                  │  │ outfit_id (FK, nullable)              │
                  │  │ value (jsonb — flexible payload)      │
                  │  │ context (jsonb — weather, occasion)   │
                  │  │ created_at                            │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │         WishlistItem                  │
                  │  │──────────────────────────────────────│
                  ├──│ id                                    │
                  │  │ user_id (FK)                          │
                  │  │ name                                  │
                  │  │ image_url                             │
                  │  │ source_url                            │
                  │  │ price                                 │
                  │  │ brand                                 │
                  │  │ category                              │
                  │  │ priority (need|want|dream)            │
                  │  │ happiness_score_prediction            │
                  │  │ similar_owned_count                   │
                  │  │ versatility_impact                    │
                  │  │ status (active|purchased|dismissed)   │
                  │  │ price_alert_threshold                 │
                  │  │ created_at                            │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │       AgentMemory                     │
                  │  │──────────────────────────────────────│
                  ├──│ id                                    │
                  │  │ user_id (FK)                          │
                  │  │ memory_type (working|episodic|        │
                  │  │   semantic|procedural)                │
                  │  │ content (text)                        │
                  │  │ embedding (vector[512])               │
                  │  │ importance_score                      │
                  │  │ access_count                          │
                  │  │ last_accessed_at                      │
                  │  │ superseded_by (FK, nullable)          │
                  │  │ created_at                            │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │       BudgetPeriod                    │
                  │  │──────────────────────────────────────│
                  ├──│ id                                    │
                  │  │ user_id (FK)                          │
                  │  │ period_start                          │
                  │  │ period_end                            │
                  │  │ budget_amount                         │
                  │  │ spent_amount (derived)                │
                  │  │ happiness_per_dollar (derived)        │
                  │  │ impulse_buy_count (derived)           │
                  │  │ planned_buy_count (derived)           │
                  │  └──────────────────────────────────────┘
                  │
                  │  ┌──────────────────────────────────────┐
                  │  │     ExternalProduct                   │
                  │  │──────────────────────────────────────│
                  └──│ id                                    │
                     │ name                                  │
                     │ brand                                 │
                     │ category                              │
                     │ price                                 │
                     │ image_url                             │
                     │ source_url                            │
                     │ affiliate_url                         │
                     │ retailer                              │
                     │ embedding (vector[512])               │
                     │ attributes (jsonb)                    │
                     │ last_checked_at                       │
                     │ created_at                            │
                     └──────────────────────────────────────┘
```

### Design Principles

1. **PreferenceSignal is append-only.** Never update a signal. Append new ones. Decay and aggregation happen in batch. This makes the system debuggable ("why did the agent suggest that?") and supports time-travel analysis.

2. **AgentMemory uses supersession chains.** Never delete a memory. When a memory is updated, the old version gets a `superseded_by` pointer. This enables "how has my style evolved?" queries and protects against preference drift bugs.

3. **OutfitItem bridges owned and external.** An outfit can contain both wardrobe items and external products. This is what makes "you're one piece away" possible. The `is_owned` boolean drives the buy-vs-substitute logic.

4. **All queries are user-scoped.** Every table has `user_id`. Every query includes it. Row-Level Security enforced at the database level. This is both the security invariant and the future sharding key.

5. **Derived fields are denormalized for read performance.** `times_worn`, `cost_per_wear`, `happiness_score`, `versatility_score` on WardrobeItem are computed and cached. Updated via background jobs, not on every read.

6. **Embeddings are model-versioned.** When the embedding model upgrades, old vectors become incompatible. `model_version` on ItemEmbedding enables incremental re-embedding.

---

## 11. Business Model

### Freemium + Affiliate Commerce

**Free Tier (forever):**
- Up to 100 wardrobe items
- 3 outfit suggestions per day
- Basic wish list (no happiness score)
- Style profile (read-only)
- Manual item entry only

**Adore Pro ($8.99/month or $69.99/year):**
- Unlimited wardrobe items
- Unlimited outfit suggestions with "one piece away" mode
- Full Happiness Function with scores on all items and purchases
- Email receipt auto-import
- Budget tracker with monthly reports
- Style DNA evolution tracking
- Wardrobe gap analysis
- Color analysis
- Travel packing optimization
- Priority AI stylist responses

**Phase 2+ Revenue (do not build yet):**
- **Affiliate revenue:** When users click "buy" on recommended items, Adore earns 5-15% commission via ShopStyle Collective. This is the real business at scale, but requires established user trust. Only recommend items after the user has experienced months of "the app saved me from buying something I didn't need."
- **Marketplace listing fee:** $1-2 per cross-platform listing to Poshmark/Depop/Mercari.
- **Anonymized taste intelligence:** Aggregated, anonymized style data sold to brands for trend analysis. (Only with explicit user consent, only at significant scale.)

### Unit Economics

| Metric | Value |
|--------|-------|
| AI cost per user/month | ~$0.90 |
| Infrastructure per user/month | ~$0.04 |
| **Total COGS per user/month** | **~$0.94** |
| Pro subscription price | $8.99/month |
| **Gross margin** | **~89.5%** |
| Target free-to-paid conversion | 8-12% |
| Target annual churn | <30% |

### Why This Price Point

$8.99/month is less than one impulse purchase at H&M. If the app prevents even one unnecessary $30 purchase per month (which the Happiness Function is specifically designed to do), ROI is self-evident. Competitors charge $4-10/month: Acloset ~$5, Fits ~$8, Indyx Insider $9.99.

### What NOT to Do

- **No ads.** Fashion ads undermine the "buy less, buy better" positioning. The moment you show ads, you're incentivized to make users want things, which is the opposite of the product's purpose.
- **No sponsored placements.** Product recommendations must be algorithmically pure. If a user suspects the AI is recommending something because a brand paid for placement, trust is destroyed permanently.
- **Don't gate basic wardrobe management behind a paywall.** The catalog must be free. Users need to reach the "aha moment" before they'll pay.

---

## 12. Competitive Landscape

### Direct Competitors

| Competitor | Funding | Users | Strengths | Critical Weakness |
|-----------|---------|-------|-----------|-------------------|
| **Indyx** | Undisclosed | 500K+ | Best onboarding (professional archivists), integrated resale, receipt forwarding | No AI intelligence layer. Catalog tool, not an advisor. |
| **Whering** | $3M+ | 200K+ | Cost-per-wear analytics, 100M item DB, sustainability focus | UK-centric. No resale. No budget. No persistent AI. |
| **Alta** | $11M seed | Growing | TIME Best Invention 2025. Great scanning + AI tagging. | No full lifecycle. No happiness function. No resale. |
| **Fits** | Undisclosed | Growing | Best virtual try-on (OpenAI models). Community features. | Wardrobe management is secondary. Try-on is the product. |
| **Cladwell** | Bootstrapped | 100K+ | Strong capsule wardrobe philosophy. Free. | Extremely narrow scope. No AI memory. No commerce. |
| **Acloset** | Undisclosed | 500K+ | AI outfit recs, shopping advisor, marketplace | Buggy. 100-item cap on free. Mixed review quality. |

### Indirect Competitors

| Competitor | Threat Level | Why |
|-----------|-------------|-----|
| **Google Shopping (virtual try-on)** | Medium | Commoditizes try-on. But Google will never tell you to buy less. |
| **Pinterest** | Low | Aspiration, not action. No wardrobe context. |
| **Stitch Fix** | Low | Human stylists + box model. Different market segment entirely. |
| **Instagram Shopping** | Low | Discovery, not intelligence. Feed-based, not personalized. |
| **Apple Photos (clothing recognition)** | Medium-Long | Could auto-catalog wardrobe from photos. But Apple won't build the intelligence layer. |

### Why Adore Wins

No competitor has all three of:
1. **Persistent AI context** that learns over months
2. **A happiness function** that quantifies purchase decisions
3. **Full lifecycle management** from acquire to sell

These three compound. The persistent context makes the happiness function accurate. The happiness function drives better purchase decisions. Better decisions increase wardrobe satisfaction. Higher satisfaction drives daily engagement. Daily engagement generates more data. More data makes the persistent context richer. **This is the flywheel no competitor has.**

---

## 13. The Moat

### Short-term Moat (Year 1): Product Completeness
The unified lifecycle (scan → style → buy → sell → evolve) is a product moat. Any competitor who adds one feature still lacks the others. Building the full system takes 12+ months. By the time they catch up, Adore has a data advantage.

### Medium-term Moat (Year 2-3): Behavioral Data
After 6 months of daily use, Adore has a user's complete taste graph — what they wear, what they buy, what they sell, how they feel about each decision. This data is non-transferable. No competing app can import it. No new app starts with it. The switching cost is total.

### Long-term Moat (Year 3+): Taste Intelligence Network
At scale (1M+ users), the aggregated taste data enables collaborative filtering that no smaller competitor can match. "Users with your taste graph who bought X wore it 40 times and rated it 8.7/10." This prediction quality scales with network size.

### Structural Moat: Incentive Alignment
Every fashion company — Zara, Shein, Amazon, Instagram — wants you to **buy more.** Adore wants you to **buy better.** This creates a structural moat: big tech will never build a product that tells users to buy less, because their business model depends on transaction volume. Adore's business model depends on user trust and subscription retention, which aligns with the user's actual interest.

---

## 14. Anti-Features

Things Adore will **never** do:

1. **Never comment on the user's body negatively.** Use geometry (proportions, silhouette, line), never judgment. No "flattering for your body type" language.

2. **Never push fast fashion.** Serve users who buy fast fashion, but never recommend disposable fashion. The sustainability angle is both morally correct and strategically smart (higher-value items = higher affiliate revenue).

3. **Never become a feed.** No infinite scroll of "inspiration." The app is *decisional* (help me choose NOW), not *aspirational* (show me pretty things). Aspiration drives engagement but not conversion.

4. **Never gate Day-1 value behind the paywall.** The outfit recommendation must be free and work immediately. Premium unlocks power features.

5. **Never require manual data entry for anything.** Every piece of data should be captured as a byproduct of something the user already wants to do.

6. **Never show traditional ads.** Purchase recommendations must be indistinguishable from genuine styling advice.

7. **Never sell individual user data.** Anonymized, aggregated insights only, with explicit opt-in consent.

8. **Never auto-recommend without confidence.** If the AI isn't sure, it says so. Transparent reasoning builds trust. Overconfident bad recommendations destroy it.

---

## 15. Success Metrics

### North Star Metric
**Weekly Outfit Journal entries per active user.** This measures the core daily habit. If users are logging outfits, every other feature benefits.

### Key Metrics by Phase

**Phase 1 (MVP, Month 1-3):**
| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Items cataloged per user (30 days) | 30+ | Wardrobe must be useful for outfit gen |
| Day-7 retention | 40% | First-week experience is working |
| Day-30 retention | 15% | 3x category average (5.6%) proves differentiation |
| Outfit suggestions accepted | 20%+ | AI quality is sufficient |
| Wish list items added per user | 5+ | Engagement with desire management |

**Phase 2 (Growth, Month 4-12):**
| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Day-30 retention | 25%+ | Habit is forming |
| Free-to-paid conversion | 8% | Monetization is working |
| Happiness score accuracy (user-rated) | 7/10+ after 60 days | AI is learning correctly |
| "Prevented purchases" per user/month | 2+ | Core value prop is landing |
| NPS | 50+ | Users would recommend |

**Phase 3 (Scale, Year 2+):**
| Metric | Target | Why It Matters |
|--------|--------|---------------|
| MAU | 100K+ | Product-market fit proven |
| Annual churn | <30% | Retention is sustainable |
| Affiliate revenue per paying user | $2-5/month | Commerce flywheel is working |
| Happiness-per-dollar trend | Increasing | Users are buying better over time |

---

## 16. Phased Roadmap

### Phase 1: Foundation (Months 1-3)
**Goal:** Prove the core loop — scan, style, rate, repeat.

- Wardrobe scanning (photo + AI attribute extraction)
- AI stylist with persistent memory
- Outfit generation (owned items, weather + occasion aware)
- Budget tracker + wish list with happiness score predictions
- Outfit journal (daily snap)
- Style quiz onboarding
- Color analysis from selfie
- iOS app (Expo/React Native)

### Phase 2: Intelligence (Months 4-8)
**Goal:** Make the Happiness Function accurate and the lifecycle complete.

- Email/receipt auto-import (Gmail integration)
- "One piece away" — hybrid outfits (owned + purchasable)
- Full Happiness Function with personalized weights
- Style evolution goals and tracking
- Marketplace listing generation (eBay API integration)
- Monthly Happiness Report
- Calendar integration
- Android app
- Travel packing optimization

### Phase 3: Network (Months 9-15)
**Goal:** Build the social and commerce layers.

- Taste Graph visualization and evolution timeline
- Style twins / collaborative filtering
- Cross-platform resale (Vendoo/List Perfectly partnership)
- Affiliate commerce (ShopStyle Collective integration)
- Web app (Next.js)
- Advanced analytics (capsule wardrobe scoring, seasonal rotation)

### Phase 4: Intelligence Platform (Year 2+)
**Goal:** Become the taste intelligence layer for the fashion industry.

- Anonymized trend intelligence (B2B product)
- Brand partnership program
- Virtual try-on (leverage commodity APIs)
- Custom ML models (trained on user data)
- On-device inference for instant suggestions
- International expansion (localized style norms)

---

## Appendix: Why "Adore"?

The name captures three things:

1. **The emotion:** To adore is to love deeply. The app is about building a wardrobe you genuinely love — not one you tolerate.

2. **The action:** To adorn (closely related) means to make beautiful. The app helps you adorn yourself with intention.

3. **The metric:** "What's your Adore score?" is the natural language for the Happiness Function. "My Adore score for this purchase is 8.2" — it works as both the brand and the metric.

The positioning: **Adore is the first fashion app aligned with YOUR interests, not the retailer's.** It helps you buy less, buy better, and love what you own.

---

*Last updated: 2026-03-21*
*Status: Pre-development, detailed product specification*
