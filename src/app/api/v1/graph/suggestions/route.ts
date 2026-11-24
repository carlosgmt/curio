import { NextRequest, NextResponse } from "next/server";
import { db, userSaves, globalEntities, entryConnections } from "@/db";
import { and, eq } from "drizzle-orm";
import { cosineSimilarity, generateDeterministicEmbedding } from "@/lib/search/vector";
import { requireAuth, AuthError } from "@/lib/auth/service";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const url = new URL(req.url);
    const anchorSaveId = url.searchParams.get("saveId");
    const defaultThreshold = anchorSaveId ? "0.18" : "0.82";
    const threshold = parseFloat(url.searchParams.get("threshold") || defaultThreshold);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);

    // 1. Fetch non-memo user saves (private memos never participate in synaptic edges)
    const saves = await db
      .select({
        save: userSaves,
        entity: globalEntities,
      })
      .from(userSaves)
      .leftJoin(globalEntities, eq(userSaves.entityId, globalEntities.id))
      .where(and(eq(userSaves.userId, user.id), eq(userSaves.isPrivateMemo, false)));

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

    // 3. Extract embeddings (use deterministic space consistently when anchorSaveId is requested or neural embeddings are mixed)
    const items = saves.map((s) => {
      const text = `${s.save.privateTitle || s.entity?.title || ""} ${s.entity?.brandOrCreator || ""} ${s.save.typePath || s.entity?.typePath || ""} ${(s.save.autoTags || []).join(" ")}`;
      let vec: number[];
      if (!anchorSaveId && s.save.privateEmbedding && s.save.privateEmbedding.length === 768) {
        vec = Array.from(s.save.privateEmbedding);
      } else if (!anchorSaveId && s.entity?.embedding && s.entity.embedding.length === 768) {
        vec = Array.from(s.entity.embedding);
      } else {
        vec = generateDeterministicEmbedding(text, 768);
      }
      return {
        saveId: s.save.id,
        title: s.save.privateTitle || s.entity?.title || "Untitled",
        brandOrCreator: s.entity?.brandOrCreator || null,
        typePath: s.save.typePath || s.entity?.typePath || "/general",
        heroImageUrl: s.entity?.heroImageUrl || null,
        vector: vec,
      };
    });

    const suggestions = [];

    if (anchorSaveId) {
      const anchor = items.find((item) => item.saveId === anchorSaveId);
      if (!anchor) {
        return NextResponse.json({ success: true, suggestions: [], count: 0 });
      }
      for (const candidate of items) {
        if (candidate.saveId === anchor.saveId) continue;
        if (existingEdgeKeys.has(`${anchor.saveId}:${candidate.saveId}`)) continue;
        const sim = cosineSimilarity(anchor.vector, candidate.vector);
        if (sim >= threshold) {
          suggestions.push({
            sourceSaveId: anchor.saveId,
            sourceTitle: anchor.title,
            sourceTypePath: anchor.typePath,
            targetSaveId: candidate.saveId,
            targetTitle: candidate.title,
            targetBrandOrCreator: candidate.brandOrCreator,
            targetHeroImageUrl: candidate.heroImageUrl,
            targetTypePath: candidate.typePath,
            cosineSimilarity: sim,
            suggestedConnectionType: "PAIRED_WITH",
          });
        }
      }
    } else {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];

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
    }

    suggestions.sort((a, b) => b.cosineSimilarity - a.cosineSimilarity);

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, limit),
      count: suggestions.length,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
