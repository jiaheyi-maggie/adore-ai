import { GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  HappinessScore,
  HappinessFlag,
  HappinessWeights,
  ItemCategory,
  Season,
  WishlistItem,
} from '@adore/shared';

// ── Season helpers ───────────────────────────────────────────

function getCurrentSeason(): Season {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function seasonDistance(current: Season, target: Season): number {
  const order: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const ci = order.indexOf(current);
  const ti = order.indexOf(target);
  const diff = Math.abs(ci - ti);
  return Math.min(diff, 4 - diff); // circular distance: 0, 1, 2
}

// ── Category pairing rules ───────────────────────────────────

const CATEGORY_PAIRINGS: Record<string, ItemCategory[]> = {
  tops: ['bottoms', 'outerwear', 'shoes', 'accessories', 'bags', 'jewelry'],
  bottoms: ['tops', 'outerwear', 'shoes', 'accessories', 'bags', 'jewelry'],
  dresses: ['outerwear', 'shoes', 'accessories', 'bags', 'jewelry'],
  outerwear: ['tops', 'bottoms', 'dresses', 'shoes', 'accessories', 'bags', 'jewelry'],
  shoes: ['tops', 'bottoms', 'dresses', 'outerwear', 'accessories', 'bags'],
  accessories: ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags'],
  bags: ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'],
  jewelry: ['tops', 'bottoms', 'dresses', 'outerwear'],
  activewear: ['shoes', 'accessories'],
  swimwear: ['accessories', 'bags'],
  sleepwear: [],
  undergarments: [],
};

// ── Default weights (fallback if user has none) ──────────────

const DEFAULT_WEIGHTS: Omit<HappinessWeights, 'user_id' | 'updated_at'> = {
  w_wear_frequency: 0.2,
  w_versatility: 0.15,
  w_aspiration: 0.125,
  w_budget: 0.125,
  w_uniqueness: 0.1,
  w_emotional: 0.125,
  w_cost_per_wear: 0.1,
  w_seasonal: 0.075,
};

// ── Component calculators ────────────────────────────────────

interface WardrobeContext {
  /** Wardrobe items in the same category */
  sameCategoryItems: Array<{
    times_worn: number;
    happiness_score: number | null;
    brand: string | null;
    colors: string[];
  }>;
  /** Count of active wardrobe items per complementary category */
  complementaryCategoryCounts: Record<string, number>;
  /** Active style goals */
  styleGoals: Array<{
    title: string;
    description: string;
    goal_type: string;
    target_state: Record<string, unknown>;
  }>;
  /** Current budget period (if any) */
  budgetRemaining: number | null;
  budgetAmount: number | null;
}

function computeWearFrequency(ctx: WardrobeContext): number {
  const items = ctx.sameCategoryItems;
  if (items.length === 0) return 5; // no data, neutral

  const avgWorn = items.reduce((sum, i) => sum + i.times_worn, 0) / items.length;
  const unwornRatio = items.filter((i) => i.times_worn === 0).length / items.length;

  // High avg wears + low unworn ratio = high score
  // avgWorn: 0→2, 10→7, 20+→10
  let wearScore = Math.min(10, 2 + avgWorn * 0.5);

  // Penalize if lots of unworn items in this category (user doesn't wear this category)
  if (unwornRatio > 0.5) wearScore *= 0.5;
  else if (unwornRatio > 0.3) wearScore *= 0.7;

  return Math.round(Math.max(0, Math.min(10, wearScore)) * 10) / 10;
}

function computeVersatility(
  category: ItemCategory | null,
  complementaryCounts: Record<string, number>
): number {
  if (!category) return 5;

  const pairableCategories = CATEGORY_PAIRINGS[category] ?? [];
  if (pairableCategories.length === 0) return 2; // sleepwear, undergarments

  let totalPairableItems = 0;
  for (const cat of pairableCategories) {
    totalPairableItems += complementaryCounts[cat] ?? 0;
  }

  // 0 items → 1, 5 items → 4, 15 items → 7, 30+ items → 10
  const score = Math.min(10, 1 + totalPairableItems * 0.3);
  return Math.round(score * 10) / 10;
}

function computeAspirationAlignment(
  item: Pick<WishlistItem, 'name' | 'brand' | 'category'>,
  goals: WardrobeContext['styleGoals']
): number {
  if (goals.length === 0) return 5; // no goals, neutral

  const itemText = [item.name, item.brand, item.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let maxMatch = 0;
  for (const goal of goals) {
    const goalText = [goal.title, goal.description, goal.goal_type]
      .join(' ')
      .toLowerCase();

    // Simple keyword overlap scoring
    const goalWords = goalText.split(/\s+/).filter((w) => w.length > 3);
    const matchCount = goalWords.filter((w) => itemText.includes(w)).length;
    const matchRatio = goalWords.length > 0 ? matchCount / goalWords.length : 0;
    maxMatch = Math.max(maxMatch, matchRatio);
  }

  // matchRatio 0 → 2, 0.5 → 6, 1.0 → 10
  const score = 2 + maxMatch * 8;
  return Math.round(score * 10) / 10;
}

function computeBudgetImpact(
  price: number | null,
  budgetRemaining: number | null,
  budgetAmount: number | null
): number {
  if (price == null || budgetRemaining == null || budgetAmount == null) return 5;
  if (budgetAmount <= 0) return 5;

  if (budgetRemaining <= 0) return 2; // budget fully spent or overspent
  if (price > budgetRemaining) return 2; // over budget
  const ratio = price / budgetRemaining;
  // price < 20% of remaining → 10, price = 100% → 3
  const score = 10 - ratio * 7;
  return Math.round(Math.max(2, Math.min(10, score)) * 10) / 10;
}

function computeUniqueness(similarCount: number): number {
  if (similarCount === 0) return 10;
  if (similarCount <= 2) return 7;
  if (similarCount <= 5) return 4;
  return 1;
}

function computeEmotionalPrediction(ctx: WardrobeContext): number {
  const scored = ctx.sameCategoryItems.filter(
    (i) => i.happiness_score != null
  );
  if (scored.length === 0) return 5;

  const avg =
    scored.reduce((sum, i) => sum + (i.happiness_score ?? 0), 0) / scored.length;
  // happiness_score is 0-10 already
  return Math.round(Math.max(0, Math.min(10, avg)) * 10) / 10;
}

function computeCostPerWear(
  price: number | null,
  wearFrequencyScore: number
): number {
  if (price == null || price === 0) return 5;

  // Estimate annual wears from the wear frequency score:
  // score 2 → ~5 wears/year, score 5 → ~25, score 8 → ~60, score 10 → ~100
  const estimatedAnnualWears = Math.max(1, wearFrequencyScore * 10);
  const cpw = price / estimatedAnnualWears;

  if (cpw < 3) return 10;
  if (cpw <= 10) return 7;
  if (cpw <= 25) return 5;
  return 3;
}

function computeSeasonalRelevance(
  category: ItemCategory | null,
  itemSeasons?: string[] | null
): number {
  // If no season data, check by month heuristic
  const current = getCurrentSeason();

  if (itemSeasons && itemSeasons.length > 0) {
    const seasons = itemSeasons as Season[];
    const minDist = Math.min(
      ...seasons.map((s) => seasonDistance(current, s))
    );
    if (minDist === 0) return 10; // in-season
    if (minDist === 1) return 7; // next/prev season
    return 2; // opposite season
  }

  // No season data — neutral
  return 5;
}

// ── Flag generation ──────────────────────────────────────────

function generateFlags(
  item: Pick<WishlistItem, 'created_at' | 'price' | 'status'>,
  overallScore: number,
  similarCount: number,
  budgetRemaining: number | null,
  aspirationScore: number,
  goals: WardrobeContext['styleGoals']
): HappinessFlag[] {
  const flags: HappinessFlag[] = [];

  // Impulse warning: added today + low score
  const addedToday =
    new Date(item.created_at).toDateString() === new Date().toDateString();
  if (addedToday && overallScore < 5) {
    flags.push({
      type: 'impulse-warning',
      message:
        'This was just added and scores low — consider sleeping on it.',
      severity: 'warning',
    });
  }

  // Duplicate alert
  if (similarCount >= 3) {
    flags.push({
      type: 'duplicate-alert',
      message: `You already own ${similarCount} similar items.`,
      severity: similarCount >= 5 ? 'critical' : 'warning',
    });
  }

  // Budget exceeded
  if (
    item.price != null &&
    budgetRemaining != null &&
    item.price > budgetRemaining
  ) {
    flags.push({
      type: 'budget-exceeded',
      message: `This is $${(item.price - budgetRemaining).toFixed(2)} over your remaining budget.`,
      severity: 'critical',
    });
  }

  // Goal aligned
  if (aspirationScore > 7) {
    flags.push({
      type: 'goal-aligned',
      message: 'This aligns with your active style goals.',
      severity: 'info',
    });
  }

  // Goal conflict: simple heuristic — check if goals mention "reduce" or "less" and item is in a conflicting category
  for (const goal of goals) {
    const goalText = `${goal.title} ${goal.description}`.toLowerCase();
    if (
      (goalText.includes('reduce') ||
        goalText.includes('less') ||
        goalText.includes('minimize') ||
        goalText.includes('stop buying')) &&
      aspirationScore < 4
    ) {
      flags.push({
        type: 'goal-conflict',
        message: `This may conflict with your goal: "${goal.title}".`,
        severity: 'warning',
      });
      break; // one flag is enough
    }
  }

  return flags;
}

// ── Reasoning generation (Gemini) ────────────────────────────

async function generateReasoning(
  item: Pick<WishlistItem, 'name' | 'brand' | 'category' | 'price'>,
  breakdown: HappinessScore['breakdown'],
  overallScore: number,
  flags: HappinessFlag[],
  similarCount: number,
  budgetRemaining: number | null
): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    // Fallback: generate a simple template-based reasoning
    return generateTemplateReasoning(
      item,
      breakdown,
      overallScore,
      flags,
      similarCount,
      budgetRemaining
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const prompt = `You are a concise fashion advisor. Given this happiness score analysis for a wishlist item, write a 2-3 sentence explanation that's warm, honest, and helpful. Speak directly to the user.

Item: ${item.name}${item.brand ? ` by ${item.brand}` : ''}${item.category ? ` (${item.category})` : ''}${item.price != null ? ` — $${item.price}` : ''}

Overall Score: ${overallScore.toFixed(1)}/10
Breakdown:
- Wear frequency prediction: ${breakdown.wear_frequency_prediction}/10
- Versatility (outfits it unlocks): ${breakdown.versatility_score}/10
- Goal alignment: ${breakdown.aspiration_alignment}/10
- Budget impact: ${breakdown.budget_impact}/10
- Uniqueness in wardrobe: ${breakdown.uniqueness_in_wardrobe}/10 (${similarCount} similar items owned)
- Emotional prediction: ${breakdown.emotional_prediction}/10
- Cost-per-wear projection: ${breakdown.cost_per_wear_projection}/10
- Seasonal relevance: ${breakdown.seasonal_relevance}/10

${flags.length > 0 ? `Flags: ${flags.map((f) => f.message).join('; ')}` : ''}
${budgetRemaining != null ? `Budget remaining: $${budgetRemaining.toFixed(2)}` : ''}

Rules:
- 2-3 sentences max
- Be specific about numbers (e.g. "you own 3 similar items", "this would cost $2 per wear")
- If score > 7: encouraging but still honest
- If score < 5: kind but direct about concerns
- No fluff, no generic advice
- Plain text, no markdown`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim();
    if (text && text.length > 10) return text;
  } catch {
    // Fall through to template
  }

  return generateTemplateReasoning(
    item,
    breakdown,
    overallScore,
    flags,
    similarCount,
    budgetRemaining
  );
}

function generateTemplateReasoning(
  item: Pick<WishlistItem, 'name' | 'brand' | 'category' | 'price'>,
  breakdown: HappinessScore['breakdown'],
  overallScore: number,
  flags: HappinessFlag[],
  similarCount: number,
  budgetRemaining: number | null
): string {
  const parts: string[] = [];
  const name = item.name || 'This item';

  if (overallScore >= 7) {
    parts.push(`${name} scores ${overallScore.toFixed(1)}/10 — a strong match for your wardrobe.`);
    if (breakdown.versatility_score >= 7) {
      parts.push('It would unlock several new outfit combinations.');
    }
    if (breakdown.budget_impact >= 8 && budgetRemaining != null) {
      parts.push(`It fits comfortably within your remaining $${budgetRemaining.toFixed(0)} budget.`);
    }
  } else if (overallScore >= 5) {
    parts.push(`${name} scores ${overallScore.toFixed(1)}/10 — decent but not a standout.`);
    if (similarCount >= 2) {
      parts.push(`You already own ${similarCount} similar items.`);
    }
  } else {
    parts.push(`${name} scores ${overallScore.toFixed(1)}/10.`);
    const concerns: string[] = [];
    if (similarCount >= 3) concerns.push(`you own ${similarCount} similar items`);
    if (breakdown.wear_frequency_prediction < 4) concerns.push('similar items are rarely worn');
    if (breakdown.budget_impact < 4) concerns.push("it's a stretch on your budget");
    if (concerns.length > 0) {
      parts.push(`Main concerns: ${concerns.join(', ')}.`);
    }
  }

  return parts.join(' ');
}

// ── Main calculator ──────────────────────────────────────────

export async function calculateHappinessScore(
  supabase: SupabaseClient,
  userId: string,
  wishlistItem: WishlistItem
): Promise<HappinessScore> {
  // 1. Fetch user's happiness weights
  const { data: weightsRow } = await supabase
    .from('happiness_weights')
    .select('*')
    .eq('user_id', userId)
    .single();

  const weights = weightsRow ?? DEFAULT_WEIGHTS;

  // 2. Fetch wardrobe items in same category
  let sameCategoryQuery = supabase
    .from('wardrobe_items')
    .select('times_worn, happiness_score, brand, colors')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .neq('status', 'sold');

  if (wishlistItem.category) {
    sameCategoryQuery = sameCategoryQuery.eq('category', wishlistItem.category);
  }

  const { data: sameCategoryItems } = await sameCategoryQuery;

  // 3. Fetch complementary category counts
  const complementaryCategories =
    wishlistItem.category
      ? CATEGORY_PAIRINGS[wishlistItem.category] ?? []
      : [];

  let complementaryCounts: Record<string, number> = {};
  if (complementaryCategories.length > 0) {
    const { data: compItems } = await supabase
      .from('wardrobe_items')
      .select('category')
      .eq('user_id', userId)
      .in('category', complementaryCategories)
      .neq('status', 'archived')
      .neq('status', 'sold');

    for (const item of compItems ?? []) {
      complementaryCounts[item.category] =
        (complementaryCounts[item.category] ?? 0) + 1;
    }
  }

  // 4. Fetch active style goals
  const { data: styleGoals } = await supabase
    .from('style_goals')
    .select('title, description, goal_type, target_state')
    .eq('user_id', userId)
    .eq('status', 'active');

  // 5. Fetch current budget period
  const today = new Date().toISOString().split('T')[0];
  const { data: budgetPeriod } = await supabase
    .from('budget_periods')
    .select('budget_amount, spent_amount, period_start, period_end')
    .eq('user_id', userId)
    .lte('period_start', today)
    .gte('period_end', today)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  let budgetRemaining: number | null = null;
  let budgetAmount: number | null = null;
  if (budgetPeriod) {
    budgetAmount = Number(budgetPeriod.budget_amount);
    // Compute spent from purchases table for accuracy — use actual budget period dates
    const { data: purchasesAgg } = await supabase
      .from('purchases')
      .select('total_amount')
      .eq('user_id', userId)
      .gte('purchase_date', budgetPeriod.period_start)
      .lte('purchase_date', budgetPeriod.period_end)
      .in('status', ['ordered', 'delivered']);

    const spent = (purchasesAgg ?? []).reduce(
      (sum, p) => sum + Number(p.total_amount),
      0
    );
    budgetRemaining = budgetAmount - spent;
  }

  // 6. Build context
  const ctx: WardrobeContext = {
    sameCategoryItems: (sameCategoryItems ?? []).map((i) => ({
      times_worn: i.times_worn ?? 0,
      happiness_score: i.happiness_score != null ? Number(i.happiness_score) : null,
      brand: i.brand,
      colors: i.colors ?? [],
    })),
    complementaryCategoryCounts: complementaryCounts,
    styleGoals: (styleGoals ?? []).map((g) => ({
      title: g.title,
      description: g.description,
      goal_type: g.goal_type,
      target_state: (g.target_state ?? {}) as Record<string, unknown>,
    })),
    budgetRemaining,
    budgetAmount,
  };

  // 7. Compute each component
  const wearFreq = computeWearFrequency(ctx);
  const versatility = computeVersatility(
    wishlistItem.category,
    ctx.complementaryCategoryCounts
  );
  const aspiration = computeAspirationAlignment(
    wishlistItem,
    ctx.styleGoals
  );
  const budget = computeBudgetImpact(
    wishlistItem.price != null ? Number(wishlistItem.price) : null,
    ctx.budgetRemaining,
    ctx.budgetAmount
  );
  const uniqueness = computeUniqueness(wishlistItem.similar_owned_count);
  const emotional = computeEmotionalPrediction(ctx);
  const costPerWear = computeCostPerWear(
    wishlistItem.price != null ? Number(wishlistItem.price) : null,
    wearFreq
  );
  const seasonal = computeSeasonalRelevance(wishlistItem.category);

  // 8. Weighted sum
  const w = {
    w_wear_frequency: Number(weights.w_wear_frequency),
    w_versatility: Number(weights.w_versatility),
    w_aspiration: Number(weights.w_aspiration),
    w_budget: Number(weights.w_budget),
    w_uniqueness: Number(weights.w_uniqueness),
    w_emotional: Number(weights.w_emotional),
    w_cost_per_wear: Number(weights.w_cost_per_wear),
    w_seasonal: Number(weights.w_seasonal),
  };

  const totalWeight =
    w.w_wear_frequency +
    w.w_versatility +
    w.w_aspiration +
    w.w_budget +
    w.w_uniqueness +
    w.w_emotional +
    w.w_cost_per_wear +
    w.w_seasonal;

  const rawScore =
    w.w_wear_frequency * wearFreq +
    w.w_versatility * versatility +
    w.w_aspiration * aspiration +
    w.w_budget * budget +
    w.w_uniqueness * uniqueness +
    w.w_emotional * emotional +
    w.w_cost_per_wear * costPerWear +
    w.w_seasonal * seasonal;

  // Normalize by total weight so score stays 0-10 even if weights don't sum to 1
  const overall =
    Math.round((totalWeight > 0 ? rawScore / totalWeight : rawScore) * 10) / 10;

  const breakdown: HappinessScore['breakdown'] = {
    wear_frequency_prediction: wearFreq,
    versatility_score: versatility,
    aspiration_alignment: aspiration,
    budget_impact: budget,
    uniqueness_in_wardrobe: uniqueness,
    emotional_prediction: emotional,
    cost_per_wear_projection: costPerWear,
    seasonal_relevance: seasonal,
  };

  // 9. Confidence: based on how much data we have
  let dataPoints = 0;
  if ((sameCategoryItems ?? []).length > 0) dataPoints += 2; // wear + emotional
  if (complementaryCategories.length > 0) dataPoints += 1; // versatility
  if ((styleGoals ?? []).length > 0) dataPoints += 1; // aspiration
  if (budgetPeriod) dataPoints += 1; // budget
  if (wishlistItem.price != null) dataPoints += 1; // cost per wear
  const confidence = Math.round((dataPoints / 6) * 100) / 100;

  // 10. Generate flags
  const flags = generateFlags(
    wishlistItem,
    overall,
    wishlistItem.similar_owned_count,
    budgetRemaining,
    aspiration,
    ctx.styleGoals
  );

  // 11. Generate reasoning
  const reasoning = await generateReasoning(
    wishlistItem,
    breakdown,
    overall,
    flags,
    wishlistItem.similar_owned_count,
    budgetRemaining
  );

  return {
    overall,
    breakdown,
    confidence,
    reasoning,
    flags,
  };
}

// ── Duplicate detection helper ───────────────────────────────

export async function countSimilarOwned(
  supabase: SupabaseClient,
  userId: string,
  category: ItemCategory | null,
  brand: string | null
): Promise<number> {
  if (!category) return 0;

  let query = supabase
    .from('wardrobe_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', category)
    .neq('status', 'archived')
    .neq('status', 'sold');

  // If brand matches, that's a stronger duplicate signal but we count the whole category
  const { count } = await query;
  return count ?? 0;
}
