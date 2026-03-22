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

### 6 Screens, ~2.5 Minutes

```
Splash → Name → 5 Style Swipes → Selfie → First Snap → Revelation
 0.5s    10s       40s            20s       15s         instant
```

### Screen 1: Splash (auto-advance, 0.5s)
Animated "adore" script with gradient shimmer.

### Screen 2: Name
Single text input, auto-focused. No email, no signup yet. "So I can personalize your experience."

### Screen 3: Style Vibe (5 Binary Swipes)
"This or that" visual pairs:
1. Minimal clean vs. Layered maximal (silhouette)
2. Neutral earth tones vs. Bold saturated color (color temp)
3. Structured tailored vs. Relaxed flowy (formality)
4. Classic timeless vs. Trend-forward edgy (novelty)
5. Investment pieces vs. Variety rotation (spending)

### Screen 4: Selfie for Color Analysis
Camera with warm-toned border. "Let's find your colors." After capture: 1.5s color extraction animation → "You're a Warm Autumn" with 4-color swatch.

### Screen 5: First Outfit Snap
"Snap what you're wearing right now." "No judgment, pajamas count."

### Screen 6: Revelation (THE HOOK)
Shows: Style Archetype + Color Season + Items detected in outfit + "Fun fact: 73% of your outfit is in your best colors."

### Post-Onboarding: NEVER Empty
- Journal: 1 entry (onboarding outfit)
- Wardrobe: 3-5 items (auto-decomposed)
- Stylist: Pre-loaded message with 3 outfit ideas
- Wishlist: 3 curated suggestions from style vibe
- Profile: Style Vibe badge + Color Season

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

### The Style DNA Shape
An abstract, fluid generative art form that grows with usage:
- Day 1: vague blob, 2-3 colors
- Month 1: more defined, distinct segments
- Month 6: rich, detailed personal emblem
- Unique to each user. Shareable. Pulses with each new data point.

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

# Advanced graphics (rings, charts)
npx expo install @shopify/react-native-skia

# Gestures + haptics
npx expo install react-native-gesture-handler expo-haptics

# Better images
npx expo install expo-image

# Gradients
npx expo install expo-linear-gradient

# Screenshots (shareable stats)
npx expo install react-native-view-shot

# Confetti (celebrations)
npx expo install react-native-fast-confetti
```

---

## 11. Implementation Priority

| Sprint | Focus | Impact |
|--------|-------|--------|
| **1** | Color palette swap + fonts + warm empty states | Immediate visual transformation |
| **2** | "Today" tab with outfit swipe cards + contextual home | Core value loop |
| **3** | Post-snap reward cards + streak system | Daily engagement |
| **4** | Onboarding flow (6 screens) | First-time experience |
| **5** | Monthly Style Wrapped + Style Rings + CPW on cards | Retention layer |

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

*Sources: See full agent research transcripts in project task logs.*
*Last updated: 2026-03-22*
