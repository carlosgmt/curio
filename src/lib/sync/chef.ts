import {
  getAdapterSyncCacheEntry,
  runSyncAdapter,
  type SyncAdapter,
  type SyncBoardTarget,
  type SyncFetchFn,
  type SyncOptions,
  type SyncRecord,
  type SyncRunResult,
} from "./engine";
import { registerSyncAdapter } from "./registry";

export interface ChefExportIngredient {
  raw_text: string;
  name?: string;
  display_name?: string;
  ingredient_slug?: string | null;
  amount_min?: number | null;
  amount_max?: number | null;
  unit?: string;
  prep_note?: string;
  role?: string;
  storage_type?: string;
}

export interface ChefExportRecipe {
  id: number;
  slug: string;
  title: string;
  description?: string;
  status: "complete" | "stub" | "archived" | string;
  source_type?: string;
  source_ref?: string;
  servings?: number;
  meal_types?: string[];
  cuisine?: string;
  image_path?: string;
  primary_protein?: string;
  carb_base?: string;
  kid_friendly?: number;
  spice_level?: number;
  allergens?: string[];
  diet_flags?: string[];
  thermal_profile?: string;
  seasonality_mode?: string;
  peak_seasons?: string[];
  in_season_now?: boolean;
  carb_load?: string;
  carb_swappable?: boolean;
  health_tier?: string;
  nutrition_traits?: string[];
  active_prep_min?: number | null;
  passive_cook_min?: number | null;
  total_time_min?: number | null;
  effort_tier?: string;
  free_tags?: string[];
  chef_notes?: string;
  variations?: string[];
  pairs_with?: string[];
  times_cooked?: number;
  keep_prior_count?: number;
  last_cooked_at?: string | null;
  updated_at?: string | null;
  ingredients?: ChefExportIngredient[];
  steps?: string[];
}

export interface ChefSyncOptions extends SyncOptions {
  chefApiUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_CHEF_BASE_URL = "http://host.docker.internal:8720";
const PUBLIC_CHEF_BASE_URL = "https://mini.orca-banjo.ts.net/chef";

export function getChefApiBaseUrl(): string {
  return (process.env.CHEF_API_URL || DEFAULT_CHEF_BASE_URL).replace(/\/+$/, "");
}

function getRecipesBoardTarget(isStub: boolean): SyncBoardTarget[] {
  if (isStub) {
    return [
      {
        rootSlug: "recipes",
        rootTitle: "Recipes",
        rootDescription: "Home kitchen recipes & culinary repertoire",
        rootDefaultLayout: "masonry",
        subSlug: "recipes-ideas",
        subTitle: "Keep Ideas",
        subDescription: "Dishes & inspiration harvested from Google Keep",
        subDefaultLayout: "masonry",
        autoRules: {
          tagsInclude: ["recipe", "keep-idea"],
          typePathPrefix: "/culinary/recipe",
        },
      },
    ];
  }
  return [
    {
      rootSlug: "recipes",
      rootTitle: "Recipes",
      rootDescription: "Home kitchen recipes & culinary repertoire",
      rootDefaultLayout: "masonry",
      autoRules: {
        tagsInclude: ["recipe"],
      },
    },
  ];
}

function normalizeComplexity(effort?: string): string {
  if (effort === "express") return "quick";
  if (effort === "hands_off") return "hands-off";
  if (effort === "weekend") return "project";
  return "weeknight";
}

function normalizeYieldAmount(min?: number | null, max?: number | null): number | undefined {
  if (typeof min === "number" && Number.isFinite(min)) return min;
  if (typeof max === "number" && Number.isFinite(max)) return max;
  return undefined;
}

export function mapChefRecipeToSyncRecord(r: ChefExportRecipe): SyncRecord | null {
  if (!r || !r.slug || r.status === "archived") return null;

  const isStub = r.status === "stub";
  const key = `recipe:${r.slug}`;
  const isExternalUrl =
    r.source_type === "url" && typeof r.source_ref === "string" && /^https?:\/\//i.test(r.source_ref);
  const canonicalUrl = isExternalUrl
    ? r.source_ref!.trim()
    : `${PUBLIC_CHEF_BASE_URL}/?recipe=${encodeURIComponent(r.slug)}`;

  const rawImg = typeof r.image_path === "string" ? r.image_path.trim() : "";
  const imgFilename = rawImg ? rawImg.replace(/^.*[/\\]/, "") : "";
  const heroImageUrl = imgFilename
    ? `/api/v1/media/chef/${encodeURIComponent(imgFilename)}`
    : null;

  const tags = new Set<string>(["recipe"]);
  if (isStub) tags.add("keep-idea");
  if (r.effort_tier) tags.add(r.effort_tier);
  if (r.carb_load) tags.add(`${r.carb_load}-carb`);
  if (r.thermal_profile && r.thermal_profile !== "neutral") tags.add(r.thermal_profile);
  if (r.kid_friendly === 2) tags.add("matilda-ok");
  for (const t of r.free_tags || []) {
    const clean = String(t || "").trim().toLowerCase();
    if (clean) tags.add(clean);
  }

  const ingredients = (r.ingredients || [])
    .map((ing) => ({
      item: (ing.name || ing.display_name || ing.raw_text || "").trim(),
      amount: normalizeYieldAmount(ing.amount_min, ing.amount_max),
      unit: ing.unit?.trim() || undefined,
      prepNote: ing.prep_note?.trim() || undefined,
      role: ing.role || undefined,
    }))
    .filter((ing) => Boolean(ing.item));

  const prepTimeMinutes =
    typeof r.active_prep_min === "number" && Number.isFinite(r.active_prep_min)
      ? r.active_prep_min
      : undefined;
  const cookTimeMinutes =
    typeof r.passive_cook_min === "number" && Number.isFinite(r.passive_cook_min)
      ? r.passive_cook_min
      : typeof r.total_time_min === "number" &&
          Number.isFinite(r.total_time_min) &&
          prepTimeMinutes !== undefined &&
          r.total_time_min >= prepTimeMinutes
        ? r.total_time_min - prepTimeMinutes
        : undefined;

  const summaryParts: string[] = [];
  if (r.description?.trim()) {
    summaryParts.push(r.description.trim());
  }
  const totalCooked = (r.times_cooked || 0) + (r.keep_prior_count || 0);
  if (totalCooked > 0 && !r.description?.trim()) {
    summaryParts.push(`Cooked ${totalCooked}×`);
  }

  const season =
    Array.isArray(r.peak_seasons) && r.peak_seasons.length > 0 ? r.peak_seasons : ["all"];
  const mealType =
    Array.isArray(r.meal_types) && r.meal_types.length > 0 ? r.meal_types : ["lunch", "dinner"];

  return {
    externalId: r.slug,
    entityKey: key,
    canonicalExternalId: key,
    canonicalUrl,
    coreType: "CULINARY",
    typePath: "/culinary/recipe",
    title: r.title,
    brandOrCreator: r.cuisine ? String(r.cuisine) : "Home Kitchen",
    summary: summaryParts.join(" · ") || null,
    heroImageUrl,
    wishlist: isStub,
    tags: [...tags],
    personalNotes: r.chef_notes?.trim() || null,
    coreStructuredData: {
      title: r.title,
      cuisine: r.cuisine || "spanish",
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes:
        typeof r.total_time_min === "number" && Number.isFinite(r.total_time_min)
          ? r.total_time_min
          : undefined,
      yieldServings: r.servings || 4,
      complexity: normalizeComplexity(r.effort_tier),
      ingredients,
      directions: Array.isArray(r.steps) ? r.steps : [],
      tags: [...tags],
      season,
      mealType,
      notes: r.chef_notes?.trim() || undefined,
      effortTier: r.effort_tier || "weeknight",
      carbLoad: r.carb_load || "moderate",
      carbSwappable: Boolean(r.carb_swappable),
      healthTier: r.health_tier || "balanced_everyday",
      thermalProfile: r.thermal_profile || "neutral",
      primaryProtein: r.primary_protein || "none",
      kidFriendly: r.kid_friendly ?? 1,
      spiceLevel: r.spice_level ?? 0,
      allergens: r.allergens || [],
      dietFlags: r.diet_flags || [],
      timesCooked: r.times_cooked ?? 0,
      keepPriorCount: r.keep_prior_count ?? 0,
      lastCookedAt: r.last_cooked_at ?? null,
      recipeStatus: r.status,
      chefSlug: r.slug,
      source: "chef-ui",
    },
    extendedAttributes: {
      source: "chef-ui",
      chefId: r.id,
      chefSlug: r.slug,
      recipeStatus: r.status,
      timesCooked: r.times_cooked ?? 0,
      keepPriorCount: r.keep_prior_count ?? 0,
      lastCookedAt: r.last_cooked_at ?? null,
      nutritionTraits: r.nutrition_traits || [],
      inSeasonNow: Boolean(r.in_season_now),
      variations: r.variations || [],
      pairsWith: r.pairs_with || [],
    },
    sourceLink: {
      sellerName: isExternalUrl ? "Saved Recipe Link" : "Chef UI",
      sourceUrl: canonicalUrl,
    },
    boards: getRecipesBoardTarget(isStub),
  };
}

export const chefAdapter: SyncAdapter<ChefSyncOptions> = {
  sourceId: "chef",
  displayName: "Chef UI (Recipes)",
  supportsWishlistPromotion: false,
  supportsPruning: true,
  keyPrefix: "recipe:",
  getStatus(userId: string) {
    return {
      configuredUrl: getChefApiBaseUrl(),
      ...getAdapterSyncCacheEntry("chef", userId),
    };
  },
  async fetchSnapshot(_userId: string, options?: ChefSyncOptions) {
    const fetchFn: SyncFetchFn = options?.fetchFn ?? fetch;
    const baseUrl = (options?.chefApiUrl || getChefApiBaseUrl()).replace(/\/+$/, "");
    const timeoutMs = options?.timeoutMs ?? 6000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let payload: { digest?: string; counts?: Record<string, number>; recipes?: ChefExportRecipe[] };
    try {
      const res = await fetchFn(`${baseUrl}/api/recipes/export`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Chef UI API returned ${res.status}`);
      }
      payload = (await res.json()) as {
        digest?: string;
        counts?: Record<string, number>;
        recipes?: ChefExportRecipe[];
      };
    } finally {
      clearTimeout(timer);
    }

    const rawRecipes = Array.isArray(payload.recipes) ? payload.recipes : [];
    const records: SyncRecord[] = [];
    for (const r of rawRecipes) {
      const mapped = mapChefRecipeToSyncRecord(r);
      if (mapped) records.push(mapped);
    }

    return {
      digest: payload.digest || `chef-${records.length}`,
      records,
      meta: {
        upstreamCount: rawRecipes.length,
        completeCount: records.filter((rec) => !rec.wishlist).length,
        stubCount: records.filter((rec) => Boolean(rec.wishlist)).length,
      },
    };
  },
};

registerSyncAdapter(chefAdapter);

export async function syncChefWithCurio(
  userId: string,
  options?: ChefSyncOptions
): Promise<SyncRunResult> {
  return runSyncAdapter(userId, chefAdapter, options);
}

export function getChefSyncStatus(userId: string): {
  configuredUrl: string;
  lastSyncedAt: string | null;
  digest: string | null;
  lastResult: SyncRunResult | null;
} {
  return {
    configuredUrl: getChefApiBaseUrl(),
    ...getAdapterSyncCacheEntry("chef", userId),
  };
}

export function extractChefSlug(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const trimmed = c.trim();
    if (trimmed.startsWith("recipe:") && trimmed.length > "recipe:".length) {
      return trimmed.slice("recipe:".length);
    }
  }
  return null;
}

export async function syncCurioSaveEditToChef(
  entityKey: string | null | undefined,
  updates: {
    title?: string | null;
    summary?: string | null;
    personalNotes?: string | null;
    autoTags?: string[];
  },
  options?: { fetchFn?: SyncFetchFn; chefApiUrl?: string }
): Promise<boolean> {
  const slug = extractChefSlug(entityKey);
  if (!slug) return false;

  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined && updates.title !== null && updates.title.trim()) {
    payload.title = updates.title.trim();
  }
  if (updates.summary !== undefined) {
    payload.description = updates.summary ?? "";
  }
  if (updates.personalNotes !== undefined) {
    payload.chef_notes = updates.personalNotes ?? "";
  }
  if (Array.isArray(updates.autoTags)) {
    payload.classification = { free_tags: updates.autoTags };
  }
  if (Object.keys(payload).length === 0) return false;

  const fetchFn: SyncFetchFn = options?.fetchFn ?? fetch;
  const baseUrl = (options?.chefApiUrl || getChefApiBaseUrl()).replace(/\/+$/, "");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetchFn(`${baseUrl}/api/recipes/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
