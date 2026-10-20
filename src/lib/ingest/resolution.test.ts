import { describe, expect, it } from "bun:test";
import { resolveOrCreateCanonicalEntity } from "./resolution";
import { db, globalEntities, entitySources } from "@/db";
import { eq } from "drizzle-orm";

describe("4-Stage URL-Agnostic Canonical Entity Resolution", () => {
  it("resolves identical wine from Vivino then Decántalo without creating duplicate global_entities", async () => {
    const runId = Date.now();
    const wineTitle = `Viña Tondonia Reserva ${runId}`;
    const brand = "R. López de Heredia";
    const typePath = "/product/beverage/wine";
    const vintage = 2011;

    // 1. Ingest wine from Vivino
    const vivinoUrl = `https://www.vivino.com/us-es-vina-tondonia-reserva/w/1162?year=2011&run=${runId}`;
    const vivinoRes = await resolveOrCreateCanonicalEntity({
      url: vivinoUrl,
      sellerName: "Vivino",
      title: wineTitle,
      brandOrCreator: brand,
      typePath,
      priceCents: 4800,
      currency: "USD",
      structuredAttributes: { vintage, region: "Rioja", country: "Spain" },
    });

    expect(vivinoRes.entity).toBeDefined();
    expect(vivinoRes.resolvedStage).toBe("NEW");
    const canonicalEntityId = vivinoRes.entity.id;

    // 2. Ingest identical wine from Decántalo (different URL & retailer)
    const decantaloUrl = `https://www.decantalo.com/es/en/vina-tondonia-reserva-2011.html?run=${runId}`;
    const decantaloRes = await resolveOrCreateCanonicalEntity({
      url: decantaloUrl,
      sellerName: "Decántalo",
      title: wineTitle,
      brandOrCreator: brand,
      typePath,
      priceCents: 4250,
      currency: "EUR",
      structuredAttributes: { vintage, region: "Rioja" },
    });

    expect(decantaloRes.entity.id).toBe(canonicalEntityId); // Zero duplicates!
    expect([2, 3, 4]).toContain(decantaloRes.resolvedStage as number);
    expect(decantaloRes.sourceAdded).toBe(true);

    // 3. Re-ingest the exact same Decántalo URL -> resolves via Stage 1 (URL Hash)
    const exactUrlRes = await resolveOrCreateCanonicalEntity({
      url: decantaloUrl,
      sellerName: "Decántalo",
      title: "Some different scraped page title",
      typePath,
    });

    expect(exactUrlRes.entity.id).toBe(canonicalEntityId);
    expect(exactUrlRes.resolvedStage).toBe(1);

    // 4. Verify exactly 1 global entity exists and 2 distinct sources exist
    const sources = await db
      .select()
      .from(entitySources)
      .where(eq(entitySources.entityId, canonicalEntityId));

    expect(sources.length).toBeGreaterThanOrEqual(2);
    const sellerNames = sources.map((s) => s.sellerName);
    expect(sellerNames).toContain("Vivino");
    expect(sellerNames).toContain("Decántalo");
  });
});
