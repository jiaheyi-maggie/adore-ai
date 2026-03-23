# Adore Design System

> Research compiled from Visionary, Frontend Engineer, and UX Engineer agents (2026-03-22)

---

## Table of Contents
1. [Color Palette](#1-color-palette)
2. [Typography](#2-typography)
3. [Gamification Model](#3-gamification-model)
4. [Navigation & Information Architecture](#4-navigation--information-architecture)
5. [Onboarding Flow](#5-onboarding-flow)
6. [Daily Engagement Loop](#6-daily-engagement-loop)
7. [Interaction Design](#7-interaction-design)
8. [Screen-by-Screen Specs](#8-screen-by-screen-specs)
9. [Emotional Design Patterns](#9-emotional-design-patterns)
10. [Tech Stack](#10-tech-stack)
11. [Implementation Priority](#11-implementation-priority)
12. [Style Radar Chart](#12-style-radar-chart)
13. [Style Shifting Flow](#13-style-shifting-flow)
14. [Batch Scanning UX Patterns](#14-batch-scanning-ux-patterns)

---

## 1. Color Palette

### Philosophy: "Let the clothes be the color, let the UI be the frame."
The app is a gallery for the user's wardrobe. The frame shouldn't compete with the art.

### Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FAF8F5` | Screen backgrounds (warm off-white) |
| `surface` | `#FFFFFF` | Cards, sheets, modals |
| `text-primary` | `#2D2926` | Headings, primary content |
| `text-secondary` | `#8C8279` | Subtitles, metadata, timestamps |
| `text-muted` | `#B8AFA6` | Placeholders, disabled text |
| `border` | `#EDE8E3` | Dividers, card borders |
| `accent` | `#C4956A` | Primary CTA buttons, active states (bronze/cognac) |
| `accent-hover` | `#B3845A` | Button pressed state |
| `accent-soft` | `#E8D5C4` | Selected chips, highlight backgrounds (blush cream) |
| `secondary` | `#7B6B5D` | Secondary buttons, icons (muted umber) |
| `success` | `#6B8F71` | Match confirmed, positive states (muted sage) |
| `warning` | `#D4A04A` | Budget alerts, caution |
| `error` | `#C45B5B` | Errors, destructive actions (warm red) |

### Dark Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#1C1917` | Screen backgrounds (warm black, stone-tinted) |
| `surface` | `#292524` | Cards, sheets |
| `text-primary` | `#F5F0EB` | Headings, primary content |
| `text-secondary` | `#A39890` | Subtitles, metadata |
| `border` | `#3D3835` | Dividers |
| `accent` | `#D4A574` | Lighter bronze for dark backgrounds |

### Category Colors (for wardrobe badges)

| Category | Hex | Note |
|----------|-----|------|
| Tops | `#7BA3C9` | Soft blue |
| Bottoms | `#8B7BB5` | Soft purple |
| Dresses | `#C97B8B` | Dusty rose |
| Outerwear | `#7B9B8B` | Sage |
| Shoes | `#C4956A` | Bronze |
| Accessories | `#B5A08B` | Warm taupe |
| Bags | `#9B8B7B` | Muted brown |
| Jewelry | `#D4B896` | Gold |
| Activewear | `#7BBBA3` | Teal |
| Swimwear | `#7BADC9` | Sky |
| Sleepwear | `#B5A3C4` | Lavender |

### Design Rationale
- Warm off-white (#FAF8F5) vs cold gray (#fafafa): warm backgrounds increase perceived quality and dwell time (Aesop, Le Labo, Apple product pages)
- Bronze/cognac accent (#C4956A) vs pure black: black buttons say "tech app", bronze says "curated, editorial, warm"
- Muted sage (#6B8F71) vs electric green (#22c55e): sage communicates growth, naturalness, sustainability
- Dark mode is non-negotiable: creates perception of luxury, preferred by target demographic for evening use

---

## 2. Typography

### Two-Font System: Editorial Tension

The serif headline + sans-serif body creates the same visual grammar as Vogue and Harper's Bazaar. Users have been trained to associate this pattern with quality.

### Font Stack

| Role | Font | Weight | Fallback |
|------|------|--------|----------|
| Display / Headers | Cormorant Garamond | 400-600 | Playfair Display, Georgia |
| Body / UI | Inter | 400-600 | DM Sans, system |
| Numbers / Stats | DM Mono | 400-500 | Menlo, monospace |

### Type Scale

| Name | Font | Size | Weight | Tracking | Usage |
|------|------|------|--------|----------|-------|
| `display` | Cormorant | 32pt | 500 | 0 | Screen titles ("Your Wardrobe") |
| `heading` | Cormorant | 24pt | 500 | 0 | Section headers |
| `subheading` | Cormorant | 18pt | 500 | 0 | Card titles |
| `body` | Inter | 15pt | 400 | 0 | Primary content |
| `body-sm` | Inter | 13pt | 400 | 0 | Secondary content |
| `caption` | Inter | 11pt | 500 | 1.5px | Labels, badges (uppercase) |
| `stat` | DM Mono | 20pt | 500 | 0 | Numbers, cost-per-wear |
| `stat-lg` | DM Mono | 36pt | 500 | 0 | Hero numbers, analytics |

### Expo Installation
```bash
npx expo install expo-font @expo-google-fonts/cormorant-garamond @expo-google-fonts/inter @expo-google-fonts/dm-mono
```

---

## 3. Gamification Model

### "Style Intelligence" — NOT Duolingo

Don't gamify Adore. **Intellectualize** it. Make users feel smart, not rewarded. The model is closer to Spotify Wrapped than Duolingo.

> **Duolingo says:** "Great job! 50 XP! Keep your streak!"
> **Adore says:** "Interesting — you've gravitated toward earth tones all month, but your highest-rated outfit was that cobalt blazer. Your data suggests you play it safe but feel best when you don't."

### What TO Use

| Mechanic | Implementation | Why It Works |
|----------|---------------|-------------|
| **Outfit logging streaks** | 7-day flame icon, gentle encouragement | Loss aversion — users with 7-day streaks retain 3.6x better |
| **Variable reward insights** | Different insight after each snap (rotate 4 types) | Dopamine from unpredictability |
| **Cost-per-wear competition** | "Your jacket just hit $3.60/wear — more efficient than 73% of your wardrobe" | Frugality as a game |
| **Style Rings** (Apple Fitness) | 3 rings: Wear, Explore, Grow | Goal-gradient effect + visual completion bias |
| **Monthly Wrapped** (Spotify) | Swipeable story cards with personal style data | Identity reinforcement + shareability |
| **Milestone unlocks** | 10 items → suggestions, 50 → analytics, 100 → evolution tracking | Intrinsic motivation |

### What NOT to Use

| Anti-Pattern | Why |
|-------------|-----|
| XP points | Feels like Chuck E. Cheese, cheapens the brand |
| Mascot character | Fashion audience finds it childish |
| Leaderboards | Encourages overconsumption, contradicts sustainability |
| Generic badges | "Shoe Collector: 10 pairs!" is inventory management, not style |
| Aggressive notifications | 45% of users are privacy-concerned; nagging drives uninstalls |

### The Three Style Rings

```
Ring 1: WEAR (inner, bronze #C4956A)
  "Did you log an outfit today?" (binary)

Ring 2: EXPLORE (middle, sage #6B8F71)
  "Did you wear something neglected (14+ days)?"

Ring 3: GROW (outer, blush #E8D5C4)
  "Did you take a style goal action?"
```

---

## 4. Navigation & Information Architecture

### Tab Structure (Restructured)

```
+-------+---------+---------+----------+---------+
|  [*]  |  [cam]  | [chat]  |  [grid]  | [user]  |
| Today | Journal | Stylist | Wardrobe | Profile |
+-------+---------+---------+----------+---------+
```

**"Today" is the new default tab** — shows outfit swipe cards, weather, calendar context.

### Contextual Home Screen

```
MORNING (6am-10am):
  "Good morning. Here's what looks good today."
  → 3 outfit suggestions based on weather + calendar + recent wears
  → One-tap: "Wearing this" to log it

DAYTIME/EVENING:
  "What are you wearing today?"
  → Camera button, prominent
  → Quick-log: tap recent outfit to re-log

LATE NIGHT:
  "Your week in style"
  → Mini analytics: 5 outfits logged, top mood, CPW leader
```

### Depth: Max 2 Taps to Any Action

- Today → Outfit card detail (1 tap) → Item detail (2 taps)
- Journal → Quick snap camera (1 tap on FAB)
- Wardrobe → Item detail (1 tap) → Sell item (2 taps)
- Profile → Style DNA / Monthly report / Settings (1 tap each)

### Quick Actions
- **Long-press on wardrobe item**: Wear today / Add to outfit / Sell this / Mark as donated
- **Shake gesture**: Random outfit generation (Today screen only)
- **Double-tap outfit card**: Quick-save to favorites (heart animation)

---

## 5. Onboarding Flow

### 6 Screens, ~2.5 Minutes (as built)

```
Splash → Name → Occasion Map → Visual Taste → Anti-Taste → Selfie → First Snap → Revelation
 0.5s    10s        25s             35s           20s         20s       15s          instant
```

The original binary "this or that" swipe design was replaced with a research-backed visual taste profiling approach. Binary swipes produce noisy data; visual card selection produces richer archetype signals.

### Screen 1: Splash (auto-advance, 0.5s)
Animated "adore" script with gradient shimmer.

### Screen 2: Name
Single text input, auto-focused. No email, no signup yet. "So I can personalize your experience."

### Screen 3: Occasion Map (multi-select, 6 cards)
"What's your life actually like?" — Work / Casual / Social / Fitness / Travel / Special Events. Multi-select; drives `formality_distribution` in the style profile. No wrong answer.

### Screen 4: Visual Taste (multi-select, 15 tagged style cards)
"Outfits that feel like YOU." Each card shows a real styled outfit photo with archetype tags behind it (user sees the photo, not the tags). Selecting a card increments archetype weights. Min 2 cards required.

### Screen 5: Anti-Taste (optional, 12 polarizing cards)
"Not your thing." Same card format; avoiding these cards is as signal-rich as selecting favorites. Skippable — presented as optional with "I like all of these" escape hatch.

### Screen 6: Selfie for Color Analysis
Camera with warm-toned border. Photo library also supported. "Let's find your colors." After capture: Gemini 2.5 Flash analyzes skin undertone, eye color, natural hair color → 1.5s animation → "You're a Warm Autumn" with 4-color swatch.

### Screen 7: First Outfit Snap
"Snap what you're wearing right now." Photo library supported. "No judgment, pajamas count."

### Screen 8: Revelation (THE HOOK)
Shows: Style Archetype + Color Season + Style Radar Chart (6-axis hexagon, the "wow" moment) + items detected in outfit + "Fun fact: 73% of your outfit is in your best colors."

The server computes `style_archetypes` and `formality_distribution` from raw card selections server-side. The revelation screen passes the Style DNA to the API; the radar renders from those archetype weights.

### Post-Onboarding: NEVER Empty
- Journal: 1 entry (onboarding outfit)
- Wardrobe: 3-5 items (auto-decomposed from first snap)
- Stylist: Pre-loaded message with 3 outfit ideas
- Wishlist: 3 curated suggestions from style profile
- Profile: Style Radar Card + Color Season + archetype breakdown

---

## 6. Daily Engagement Loop

### The Atomic Habit

```
TRIGGER (morning notification: "What are you wearing today?")
    ↓
ACTION (5-second outfit snap)
    ↓
REWARD (instant insight — variable, 4 types)
    ↓
INVESTMENT (data improves future suggestions)
    ↓
TRIGGER (tomorrow's notification is smarter)
```

### Notification Adaptation Over Time
- Week 1: "What are you wearing today?" (generic)
- Week 2: "It's 62° and sunny — perfect for that denim jacket" (weather + wardrobe aware)
- Month 1: "You haven't worn your green blazer in 3 weeks" (nudge neglected items)
- Month 3: "8-day warm-tones streak — new personal best!" (gamification)

### Variable Reward Cards (Post-Snap, Rotate)

**Type A — Item Discovery**: "I spotted a belt I haven't seen before. Add it?"
**Type B — Streak + Stats**: "7 days! You're using 22% of your wardrobe."
**Type C — Style Insight**: "Your happiest outfits all include a structured outer layer."
**Type D — Outfit Unlocked**: "Today's snap added gray pants — unlocks 4 new combos."

### Weekly Report (Sunday evening card)
Outfits logged, unique items worn, utilization %, most-worn item, mood trend.

### Monthly "Style Wrapped"
Full-screen swipeable story cards. Sharable to Instagram Stories.

---

## 7. Interaction Design

### Processing Screen (Magic Moment)
Replace `ActivityIndicator` with scan-line animation over the outfit photo. Items highlighted one by one as detected.

### Haptic Feedback
```
Light impact   → tapping chips, scrolling selectors
Medium impact  → saving an outfit, confirming item
Success notif  → item matched in wardrobe
Selection      → scrolling occasion/mood pickers
```

### Animation Library: Reanimated 4 + Moti
- Staggered card entrance: `FadeInUp.delay(index * 100)`
- Skeleton loading: `MotiSkeleton` with warm gray gradient
- Confetti on milestones: `react-native-fast-confetti`
- Ring animations: `@shopify/react-native-skia` Path with animated end

### Happiness Score Visualization
**Show as warmth/glow, not a number:**
- High (7-10): warm golden glow border
- Medium (4-6): neutral appearance
- Low (0-3): no special treatment (absence of warmth, not cold)

Numeric score available on tap → "See why" expands reasoning.

---

## 8. Screen-by-Screen Specs

### Wardrobe Grid
- 2-column uniform grid, 3:4 aspect ratio (not masonry)
- FlashList for performance
- Each card: photo, name, colored category dot, cost-per-wear number
- View toggle: grid / list

### Outfit Journal Feed
- Vertical card feed with sticky date headers
- Each card: full-width 16:9 outfit photo, occasion badge, mood emoji, item count, mini thumbnails
- Phase 2: calendar view toggle (month with tiny thumbnails)

### AI Stylist Chat
- Fashion concierge, not ChatGPT
- AI messages: warm cream background, rich outfit cards inline (not plain text)
- User messages: accent-colored, right-aligned
- Input: text + camera icon + wardrobe picker
- Typing indicator: three animated dots (Moti)

### Profile / Stats
- Spotify Wrapped aesthetic
- Animated count-up for big numbers
- Scatter plot for cost-per-wear (items as dots)
- Donut chart for category breakdown
- All sharable via `react-native-view-shot`

---

## 9. Emotional Design Patterns

| Pattern | Source | Adore Implementation |
|---------|--------|---------------------|
| **Personality through data** | Spotify Wrapped | Style DNA, Monthly Wrapped, shareable stat cards |
| **Streaks + loss aversion** | Duolingo | Outfit logging streaks with flame icon, streak freeze |
| **Visual progress rings** | Apple Fitness | Three Style Rings (Wear, Explore, Grow) |
| **Daily ritual** | BeReal | Morning outfit snap prompt, no filters/editing |
| **Discovery feed** | Pinterest | Outfit ideas feed with rich visual cards |
| **Virtual companion growth** | Finch | Style DNA as evolving generative art shape |

### The Style DNA Visualization

The original concept was an abstract generative blob — evocative but illegible. It was replaced with the **Style Radar Chart**: a 6-axis hexagonal radar built in `react-native-svg`. Axes: Structure, Complexity, Risk, Formality, Warmth, Energy. Different users produce visibly different polygon shapes, making the visualization both meaningful and immediately readable.

The radar appears as the "wow moment" in the revelation screen during onboarding, and as a shareable `StyleRadarCard` in the profile screen. The card includes: radar polygon, archetype name, top 3 trait labels, and a share button (react-native-view-shot capture).

---

## 10. Tech Stack

```bash
# Core styling
npx expo install nativewind@^5 tailwindcss@^4

# Fonts
npx expo install expo-font @expo-google-fonts/cormorant-garamond @expo-google-fonts/inter @expo-google-fonts/dm-mono

# Animation
npx expo install react-native-reanimated moti

# High-performance lists
npx expo install @shopify/flash-list

# SVG (Style Radar Chart — replaces Skia for Expo Go compatibility)
npx expo install react-native-svg

# Gestures + haptics
npx expo install react-native-gesture-handler expo-haptics

# Camera (used for Hanger Flip auto-capture)
npx expo install expo-camera

# Better images
npx expo install expo-image

# Gradients
npx expo install expo-linear-gradient

# Screenshots (shareable stats, Style Radar Card)
npx expo install react-native-view-shot

# Confetti (celebrations)
npx expo install react-native-fast-confetti
```

**Note on Skia:** `@shopify/react-native-skia` was installed and then removed. It requires a custom dev client and is incompatible with Expo Go. `react-native-svg` is used instead for the Style Radar Chart and all other vector graphics. Do not re-add Skia without switching to a dev build.

---

## 11. Implementation Priority

| Sprint | Focus | Status |
|--------|-------|--------|
| **1** | Color palette + fonts + warm empty states | Done |
| **2** | Outfit Journal with AI decomposition | Done |
| **3** | AI Stylist with persistent memory | Done |
| **4** | Wish List + Happiness Function + Budget Tracker | Done |
| **5** | Marketplace one-tap sell + AI listing generation | Done |
| **6** | Onboarding (visual taste quiz, occasion map, color analysis) | Done |
| **7** | Style DNA spectrum + Style Radar Chart | Done |
| **8** | Batch Photo Closet Dump | Done |
| **9** | Hanger Flip Rapid Scan | Done |
| **10** | Product Matching (Google Shopping via Serper) | Done |
| **11** | Style Shifting engine (12 presets, 6-step flow) | Done |
| **Next** | "Today" tab — outfit swipe cards + contextual home | Planned |
| **Next** | Outfit generation engine (weather + occasion aware) | Planned |
| **Next** | Post-snap reward cards + streak system | Planned |
| **Next** | Monthly Style Wrapped + Style Rings + CPW on cards | Planned |

---

## Anti-Features (What Adore Should NEVER Do)

1. Never comment on the user's body negatively
2. Never push fast fashion
3. Never become an infinite scroll feed
4. Never gate Day-1 value behind paywall
5. Never require manual data entry for anything
6. Never show traditional ads
7. Never use a mascot
8. Never compare wardrobes between users

---

## 12. Style Radar Chart

The Style Radar is the primary visual identity artifact for each user's style profile. It renders as a hexagonal radar using `react-native-svg` (not Skia — must stay Expo Go compatible).

### Six Axes

| Axis | Low End | High End | Derived From |
|------|---------|----------|-------------|
| **Structure** | Flowing / relaxed | Tailored / architectural | `minimalist` + `classic` archetype weights; `structured` style tags |
| **Complexity** | Simple / clean | Layered / detailed | `maximalist` + `bohemian`; `layered`, `textured` tags |
| **Risk** | Safe / conventional | Daring / experimental | `edgy` + `maximalist`; `statement`, `bold`, `expressive` tags |
| **Formality** | Casual / laid-back | Polished / formal | `formality_distribution` (average of occasion weights × formality multipliers) |
| **Warmth** | Cool / minimal | Cozy / inviting | `cozy` + `romantic` + `bohemian`; `earthy`, `soft`, `hygge` tags |
| **Energy** | Calm / understated | High-energy / vibrant | `athletic` + `edgy`; `sporty`, `graphic`, `urban` tags |

### Rendering Spec

```
Size: 200×200 (default), 160×160 (compact/card view)
Center: (100, 100)
Outer radius: 80px (full score)
Axes: 6, at 60° intervals, starting at 270° (top = Structure)
Fill: accent color (#C4956A) at 25% opacity
Stroke: accent color (#C4956A), 2px
Axis lines: border color (#EDE8E3), 1px
Grid rings: 3 rings at 33%, 66%, 100% of outer radius
Labels: 11pt Inter 500, text-secondary (#8C8279), positioned 12px outside outer radius
```

The polygon vertices are computed by mapping each axis score (0–1) to a point along the axis ray from center to outer radius, then connecting them in order. Zero scores produce a small central hexagon, not invisible axes.

### Components

- `StyleRadar.tsx` — Pure SVG radar polygon. Props: `scores` (6-item object), `size`, `color`.
- `StyleRadarCard.tsx` — Shareable card wrapping the radar with archetype name, top 3 trait labels, and a share button. Used in revelation screen and profile tab.

### Score Computation

Scores are computed from `style_archetypes` (normalized weights, sum to 1.0) using weighted combinations per axis. Gemini maps free-text onboarding card selections to archetype weights during the onboarding API call; the weights are stored in `StyleProfile.taste_vector`.

---

## 13. Style Shifting Flow

Style Shifting is a 6-step mobile flow (`style-shift.tsx`) that guides the user from "I want to dress differently" to a persisted `StyleGoal` with a shopping list and bridge outfit suggestions.

### Step Breakdown

```
Step 1: Choose Direction
  Grid of 12 archetype preset cards
  Each card: preset name, description, 3 signature color swatches
  Single select; selected card gets accent border

Step 2: Set Intensity
  Labeled slider: Subtle → Moderate → Committed → Signature
  Below the slider: live preview text ("A nod to the aesthetic"
  / "Clearly directional" / "Unmistakably [Preset]")
  Intensity controls how aggressively wardrobe items are classified

Step 3: Closet Re-Seen
  POST /style-shift/analyze → wardrobe classified into 4 buckets:
  ● target-aligned   (accent dot, "Keep & wear more")
  ● bridge           (secondary dot, "Works with styling")
  ● neutral          (border dot, "Fine as-is")
  ● phase-out        (muted dot, "Conflicts with this direction")
  Horizontal scroll of item cards with classification badge
  Tap any item → bottom sheet explains WHY it was classified that way

Step 4: Bridge Outfits
  POST /style-shift/bridge-outfits → 3 outfits from owned items only
  Each outfit card: photo grid, archetype score badge ("72% Dark Academia"),
  3 styling tip bullets specific to the target aesthetic
  "No new purchases required" label on this screen

Step 5: Shopping List
  POST /style-shift/shopping-list → items ranked by outfit-unlock leverage
  Each item: Serper product match (photo, price, retailer), happiness score
  prediction, "Unlocks X new outfits" label
  Budget guard: total estimated spend shown at top

Step 6: Goal Created
  Summary card: target preset, intensity label, X items to phase out,
  Y bridge outfits, Z shopping list items
  CTA: "Start this journey" → writes StyleGoal to DB
  → returns to profile with new goal card in progress section
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/style-shift/presets` | GET | Returns all 12 `ArchetypePreset` definitions |
| `/style-shift/analyze` | POST | Classifies wardrobe items against target preset + intensity |
| `/style-shift/bridge-outfits` | POST | Generates outfits from owned items only |
| `/style-shift/shopping-list` | POST | Ranked purchase list via product-search.ts + happiness.ts |
| `/style-shift/create` | POST | Persists the StyleGoal |

### Design Principles for this Flow

- **No purchases required to get value.** Steps 1–4 give immediate value from the current wardrobe. Step 5 is additive.
- **Classification must be explainable.** Every item classification surfaces its reasoning on tap. Users who disagree can override — that override is a preference signal.
- **The goal survives the flow.** After Step 6, the user has a living goal. Weekly nudges reference it. The profile screen shows progress. It is not a one-time report.

---

## 14. Batch Scanning UX Patterns

Two new scanning modalities were added for cold-start wardrobe building. Both funnel into the wardrobe grid via a review carousel before any items are committed.

### Batch Photo Closet Dump (batch-scan.tsx)

**Mental model:** Think of it as OCR for clothes. One photo, many items.

```
Step 1: Instructions
  Illustration: top-down view of clothes laid flat
  Checklist: "Lay items flat", "Good lighting", "No overlap",
             "Up to 20 items per photo"
  CTA: "Take Photo" or "Choose from Library"

Step 2: Processing
  Full-screen photo with scan-line animation
  Counter: "Found X items" ticking up as Gemini responds
  Each detected item gets a bounding-box overlay drawn in sequence

Step 3: Review Carousel
  Horizontal swipe through detected items
  Each card: cropped image (from bounding box), editable fields
  (name, category, color, brand), with "Skip this item" button
  Items Gemini was uncertain about show a confidence badge

Step 4: Confirm
  "Adding X items to your wardrobe"
  Batch POST to /wardrobe/items/batch-confirm
  Success: confetti, redirect to wardrobe grid
```

**Entry points:** Empty state button ("Scan your whole closet at once") + wardrobe FAB → action sheet option.

### Hanger Flip Rapid Scan (hanger-scan.tsx)

**Mental model:** Like a document scanner, but for your closet rod.

```
Step 1: Instructions
  Animation: hand sliding hanger to the right, camera auto-capturing
  Key points: "Keep your closet rod visible", "Slide one hanger at a time",
              "Camera captures automatically every 2.5 seconds"

Step 2: Scanning (active camera)
  Live viewfinder
  Capture counter + haptic buzz on each auto-capture
  Manual capture button for items that moved too fast
  "Done scanning" button to stop

Step 3: Processing
  "Processing X captures..." with progress bar
  Parallel Gemini calls per capture
  Server merges duplicate detections (same color + category + brand
  within the same session = same item, keep highest-confidence capture)

Step 4: Review Carousel
  Same pattern as Batch Photo (see above)

Step 5: Confirm
  Same pattern as Batch Photo (see above)
```

**Entry points:** Same as Batch Photo — empty state + FAB action sheet.

### Shared Review Carousel Conventions

Both flows use the same review carousel pattern. Conventions to maintain:
- Swipe left/right to navigate, NOT a vertical list
- "Skip" is always available and non-destructive (skipped items are not added)
- Editable fields use inline text inputs, not modal sheets — keep the flow moving
- A "confidence" indicator (checkmark vs. question mark icon) tells the user when Gemini is uncertain
- The confirm screen always shows the final count before any DB write

---

*Sources: See full agent research transcripts in project task logs.*
*Last updated: 2026-03-23*
