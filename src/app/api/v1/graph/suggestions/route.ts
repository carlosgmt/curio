import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities, entryConnections } from "@/db";
import { eq, or } from "drizzle-orm";
import { cosineSimilarity, generateDeterministicEmbedding } from "@/lib/search/vector";
import { getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const threshold = parseFloat(url.searchParams.get("threshold") || "0.82");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    const user = userId ? { id: userId } : await getOrCreateDefaultUser();

    // 1. Fetch user saves
    const saves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(eq(userSaves.userId, user.id));

    if (saves.length < 2) {
      return NextResponse.json({ success: true, suggestions: [], count: 0 });
    }

    // 2. Fetch existing connections
    const connections = await db
      .select()
      .from(entryConnections)
      .where(eq(entryConnections.userId, user.id));

    const existingEdgeKeys = new Set<string>();
    for (const c of connections) {
      existingEdgeKeys.add(`${c.sourceSaveId}:${c.targetSaveId}`);
      if (c.isBidirectional) {
        existingEdgeKeys.add(`${c.targetSaveId}:${c.sourceSaveId}`);
      }
    }

    // 3. Extract embeddings
    const items = saves.map((s) => {
      let vec: number[];
      if (s.save.privateEmbedding && s.save.privateEmbedding.length === 768) {
        vec = Array.from(s.save.privateEmbedding);
      } else if (s.entity?.embedding && s.entity.embedding.length === 768) {
        vec = Array.from(s.entity.embedding);
      } else {
        const text = `${s.save.privateTitle || s.entity?.title || ""} ${s.save.typePath || ""}`;
        vec = generateDeterministicEmbedding(text, 768);
      }
      return {
        saveId: s.save.id,
        title: s.save.privateTitle || s.entity?.title || "Untitled",
        typePath: s.save.typePath || s.entity?.typePath || "/general",
        heroImageUrl: s.entity?.heroImageUrl || null,
        vector: vec,
      };
    });

    const suggestions = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];

        // Skip if already connected
        if (existingEdgeKeys.has(`${a.saveId}:${b.saveId}`)) continue;

        const sim = cosineSimilarity(a.vector, b.vector);
        if (sim >= threshold) {
          suggestions.push({
            sourceSaveId: a.saveId,
            sourceTitle: a.title,
            sourceTypePath: a.typePath,
            targetSaveId: b.saveId,
            targetTitle: b.title,
            targetTypePath: b.typePath,
            cosineSimilarity: sim,
            suggestedConnectionType: "AESTHETIC_SIBLING",
          });
        }
      }
    }

    suggestions.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, limit),
      count: suggestions.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
