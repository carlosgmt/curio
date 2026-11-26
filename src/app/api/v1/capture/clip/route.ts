import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, entitySources, globalEntities, userSaves } from "@/db";
import { AuthError, requireAuth } from "@/lib/auth/service";
import { generateEntityKey } from "@/lib/ingest/cascade";
import {
  classifyClipDestination,
  normalizeClipCurrency,
  parseClipPriceCents,
  sanitizeUniversalClipPayload,
} from "@/lib/clip/protocol";

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const body = await req.json().catch(() => null);
    const clip = sanitizeUniversalClipPayload(body);

    if (!clip) {
      return NextResponse.json(
        { error: "Invalid clip payload: valid http/https url required" },
        { status: 400 }
      );
    }

    const classification = classifyClipDestination(clip);
    const { urlHash, entityKey } = generateEntityKey(clip.url, clip.name || undefined);
    const priceCents = parseClipPriceCents(clip.price);
    const currency = normalizeClipCurrency(clip.currency, clip.price);
    const heroImageUrl = clip.images?.[0] || null;
    const summary = clip.description || clip.selection || null;
    const brandOrCreator = clip.brand || clip.retailer || null;
    const displayTitle = clip.name || new URL(clip.url).hostname.replace(/^www\./, "");

    const structuredSnapshot = {
      source: "bookmarklet-clip",
      title: displayTitle,
      brand: clip.brand || null,
      retailer: clip.retailer || null,
      color: clip.color || null,
      colors: clip.colors || [],
      material: clip.material || null,
      materialText: clip.materialText || null,
      sku: clip.sku || null,
      manualUrl: clip.manualUrl || null,
      images: clip.images || [],
      schemaTypes: clip.schemaTypes || [],
      selection: clip.selection || null,
      recipe: clip.recipe || null,
      routedDestination: classification.destination,
    };

    // 1. Lookup or insert global entity by urlHash (deduplicates cleanly across sync adapters)
    const [existingEntity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.urlHash, urlHash))
      .limit(1);

    let entity = existingEntity;
    let entityWasCreated = false;

    if (!entity) {
      const [inserted] = await db
        .insert(globalEntities)
        .values({
          urlHash,
          entityKey,
          canonicalUrl: clip.url,
          coreType: classification.coreType,
          typePath: classification.typePath,
          title: displayTitle,
          summary,
          heroImageUrl,
          brandOrCreator,
          priceCents,
          bestPriceCents: priceCents,
          currency,
          coreStructuredData: structuredSnapshot,
          extendedAttributes: {},
        })
        .returning();
      entity = inserted;
      entityWasCreated = true;
    } else {
      const nextPatch: Partial<typeof globalEntities.$inferInsert> = {};
      if (!entity.heroImageUrl && heroImageUrl) nextPatch.heroImageUrl = heroImageUrl;
      if (!entity.summary && summary) nextPatch.summary = summary;
      if (!entity.brandOrCreator && brandOrCreator) nextPatch.brandOrCreator = brandOrCreator;
      if (!entity.priceCents && priceCents) {
        nextPatch.priceCents = priceCents;
        nextPatch.bestPriceCents = priceCents;
        nextPatch.currency = currency;
      }
      if (Object.keys(nextPatch).length > 0) {
        nextPatch.updatedAt = new Date().toISOString();
        const [updated] = await db
          .update(globalEntities)
          .set(nextPatch)
          .where(eq(globalEntities.id, entity.id))
          .returning();
        if (updated) entity = updated;
      }
    }

    // 2. Ensure entitySources row exists for this URL
    const [existingSource] = await db
      .select()
      .from(entitySources)
      .where(and(eq(entitySources.entityId, entity.id), eq(entitySources.urlHash, urlHash)))
      .limit(1);

    if (!existingSource) {
      let sellerName = clip.retailer || clip.brand || "";
      if (!sellerName) {
        try {
          sellerName = new URL(clip.url).hostname.replace(/^www\./, "");
        } catch {
          sellerName = "Web";
        }
      }
      await db.insert(entitySources).values({
        entityId: entity.id,
        sellerName,
        sourceUrl: clip.url,
        urlHash,
        priceCents,
        currency,
      });
    }

    // 3. Lookup or insert userSave (flags Closet/My Stuff clips as wishlist so sync promotes seamlessly)
    const [existingSave] = await db
      .select()
      .from(userSaves)
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.entityId, entity.id)))
      .limit(1);

    let save = existingSave;
    let saveWasCreated = false;
    const isShoppingWishlist =
      classification.destination === "closet" || classification.destination === "my-stuff";

    if (!save) {
      const [insertedSave] = await db
        .insert(userSaves)
        .values({
          userId: user.id,
          entityId: entity.id,
          typePath: classification.typePath,
          isPrivateMemo: false,
          wishlist: isShoppingWishlist,
          personalNotes: clip.selection || null,
          userCustomValues: { clippedFrom: "bookmarklet", routedTo: classification.destination },
          candidateFallbacks: [],
          autoTags: classification.tags,
          enrichmentStatus: "ENRICHED",
          visibility: "PRIVATE",
        })
        .returning();
      save = insertedSave;
      saveWasCreated = true;
    } else if (clip.selection) {
      const existingNotes = save.personalNotes || "";
      if (!existingNotes.includes(clip.selection)) {
        const mergedNotes = existingNotes ? `${existingNotes}\n\n${clip.selection}` : clip.selection;
        const [updatedSave] = await db
          .update(userSaves)
          .set({ personalNotes: mergedNotes })
          .where(eq(userSaves.id, save.id))
          .returning();
        if (updatedSave) save = updatedSave;
      }
    }

    const status = entityWasCreated || saveWasCreated ? "created" : "existing";
    return NextResponse.json(
      {
        ok: true,
        status,
        save,
        entity,
        routing: {
          ...classification,
          targetPath:
            classification.destination === "curio"
              ? `/curio/card/${encodeURIComponent(save.id)}`
              : classification.targetPath,
        },
      },
      { status: status === "created" ? 201 : 200 }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Clip capture failed:", error);
    return NextResponse.json(
      { error: "Clip capture failed", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
