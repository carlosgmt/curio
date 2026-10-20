import { NextRequest } from "next/server";
import { classifyWithHeuristics } from "@/lib/router/privacy";
import { db, curioTypes, userSaves } from "@/db";
import { eq } from "drizzle-orm";
import { extractOpenGraphHead } from "@/lib/enrichment/opengraph";
import { executeBackgroundEnrichment, getOrCreateDefaultUser } from "@/lib/ingest/cascade";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { input } = body;
  const user = await getOrCreateDefaultUser();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      // 8-second stream timeout guard
      const timeoutId = setTimeout(() => {
        sendEvent("error", { message: "Capture pipeline timed out after 8s" });
        controller.close();
      }, 8000);

      try {
        // STAGE 1: OPTIMISTIC (<10ms SLA)
        const privacy = classifyWithHeuristics(input);
        const isPrivateMemo = privacy.isPrivate || privacy.intent === "PRIVATE_MEMO";

        // Resolve valid fallback type ID or null
        const [fallbackType] = await db
          .select({ id: curioTypes.id })
          .from(curioTypes)
          .where(eq(curioTypes.typePath, isPrivateMemo ? "/memo/personal" : "/product/generic"))
          .limit(1);

        const [optimisticSave] = await db.insert(userSaves).values({
          userId: user.id,
          isPrivateMemo,
          privateTitle: privacy.suggestedTitle || input.slice(0, 80),
          personalNotes: isPrivateMemo ? input : null,
          enrichmentStatus: isPrivateMemo ? "LOCAL_ONLY" : "OPTIMISTIC",
          typePath: isPrivateMemo ? "/memo/personal" : "/product/generic",
          customTypeId: fallbackType?.id || null,
        }).returning();

        sendEvent("stage1_optimistic", {
          stage: "OPTIMISTIC",
          saveId: optimisticSave.id,
          isPrivateMemo,
          title: optimisticSave.privateTitle,
          timestamp: Date.now(),
        });

        if (isPrivateMemo) {
          clearTimeout(timeoutId);
          sendEvent("complete", { saveId: optimisticSave.id });
          controller.close();
          return;
        }

        // STAGE 2: HEAD_PARSED (150–350ms)
        const urlMatch = input.match(/https?:\/\/[^\s]+/i);
        const extractedUrl = urlMatch ? urlMatch[0] : null;

        if (extractedUrl) {
          try {
            const head = await extractOpenGraphHead(extractedUrl);
            sendEvent("stage2_head_parsed", {
              stage: "HEAD_PARSED",
              saveId: optimisticSave.id,
              title: head.title,
              heroImageUrl: head.imageUrl,
              priceCents: head.priceCents,
              domain: new URL(extractedUrl).hostname,
            });
          } catch {
            // non-fatal
          }
        }

        // STAGE 3: ENRICHED (1.2–3.0s)
        const enriched = await executeBackgroundEnrichment(optimisticSave.id, input, user.id);
        sendEvent("stage3_enriched", {
          stage: "ENRICHED",
          saveId: optimisticSave.id,
          entityId: enriched.entityId,
          typePath: enriched.typePath,
          extendedAttributes: enriched.extendedAttributes,
          candidateFallbacks: enriched.candidateFallbacks,
          autoTags: enriched.autoTags,
        });

        clearTimeout(timeoutId);
        sendEvent("complete", { saveId: optimisticSave.id });
        controller.close();
      } catch (err: any) {
        clearTimeout(timeoutId);
        sendEvent("error", { message: err.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
