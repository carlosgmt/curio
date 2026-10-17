#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db, sqlite, userSaves, globalEntities, smartLists } from "@/db";
import { getOrCreateDefaultUser, ingestCapture } from "@/lib/ingest/cascade";
import { hybridSearch, generateEmbedding } from "@/lib/search/vector";
import { getDatabaseTelemetry } from "@/lib/system/telemetry";
import { eq } from "drizzle-orm";

export function createCurioMcpServer() {
  const server = new McpServer({
    name: "curio",
    version: "1.0.0",
  });

  // Tool 1: curio_capture_item
  server.tool(
    "curio_capture_item",
    "Capture any URL, text snippet, book, film, product, place, or private note into Curio. Automatically routes through the privacy router, resolves canonical entities, and indexes into the user's taste graph.",
    {
      content: z.string().describe("URL or raw text note to capture"),
      title: z.string().optional().describe("Title override"),
      typePath: z.string().optional().describe("Optional type path override, e.g. /media/film, /product/book, /place"),
      isPrivateMemo: z.boolean().optional().describe("Strictly isolate as a private memo (zero external scraping, local only)"),
      notes: z.string().optional().describe("Curator commentary or personal review"),
      tags: z.array(z.string()).optional().describe("List of tags to attach"),
    },
    async (args) => {
      try {
        const user = await getOrCreateDefaultUser();

        if (args.isPrivateMemo) {
          // Strictly isolate as private memo
          const displayTitle = args.title || args.content.slice(0, 48).split("\n")[0] || "Private Memo";
          const autoTags = args.tags || ["memo", "private"];

          const embedding = await generateEmbedding(`${displayTitle} ${args.notes || ""} ${args.content}`);

          const [save] = await db
            .insert(userSaves)
            .values({
              userId: user.id,
              entityId: null,
              typePath: args.typePath || "/memo",
              isPrivateMemo: true,
              privateTitle: displayTitle,
              personalNotes: args.notes ? `${args.notes}\n\n${args.content}` : args.content,
              autoTags,
              privateEmbedding: JSON.stringify(embedding),
              enrichmentStatus: "LOCAL_ONLY",
              visibility: "PRIVATE",
            })
            .returning();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    saveId: save.id,
                    title: displayTitle,
                    typePath: "/memo",
                    isPrivateMemo: true,
                    status: "LOCAL_ONLY",
                    message: "Saved strictly as a local private memo (zero external scraping).",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Standard capture through the privacy & cascade pipeline
        const result = await ingestCapture(args.content, user);

        // Apply optional manual overrides
        if (args.title || args.notes || args.typePath) {
          await db
            .update(userSaves)
            .set({
              ...(args.title ? { privateTitle: args.title } : {}),
              ...(args.notes ? { personalNotes: args.notes } : {}),
              ...(args.typePath ? { typePath: args.typePath } : {}),
              ...(args.tags ? { autoTags: args.tags } : {}),
            })
            .where(eq(userSaves.id, result.save.id));
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  saveId: result.save.id,
                  title: args.title || result.entity?.title || result.save.privateTitle,
                  typePath: args.typePath || result.save.typePath,
                  canonicalUrl: result.entity?.canonicalUrl,
                  status: result.status,
                  isPrivateMemo: result.is_private_memo,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error capturing item: ${err.message || String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: curio_search_taste
  server.tool(
    "curio_search_taste",
    "Perform hybrid semantic vector and lexical search across the user's Curio taste graph and personal memory. Returns ranked items with aesthetic metadata, ratings, and tags.",
    {
      query: z.string().describe("Natural language search query, e.g. 'cozy cafe with natural light', 'sci-fi books', 'natural wine'"),
      limit: z.number().optional().default(10).describe("Maximum items to return"),
      category: z.string().optional().describe("Filter by typePath prefix, e.g. /product, /place, /media"),
      includePrivate: z.boolean().optional().default(false).describe("Whether to include private memos (defaults to false for agent privacy)"),
    },
    async (args) => {
      try {
        const user = await getOrCreateDefaultUser();
        const limit = args.limit || 10;

        const results = await hybridSearch({
          userId: user.id,
          query: args.query,
          limit: limit * 2,
          category: args.category,
        });

        const filtered = results
          .filter((item) => (args.includePrivate ? true : !item.isPrivateMemo))
          .slice(0, limit)
          .map((item) => ({
            saveId: item.saveId,
            title: item.title,
            typePath: item.typePath,
            coreType: item.coreType,
            summary: item.summary,
            heroImageUrl: item.heroImageUrl,
            score: Number(item.score.toFixed(3)),
            personalNotes: item.save?.personalNotes || undefined,
            tags: item.save?.autoTags || [],
          }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query: args.query,
                  totalResults: filtered.length,
                  items: filtered,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error searching taste graph: ${err.message || String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: curio_get_telemetry
  server.tool(
    "curio_get_telemetry",
    "Retrieve Curio system telemetry, SQLite database status, WAL file metrics, Global Cache Hit Rate, and AI quota consumption.",
    {
      detailed: z.boolean().optional().default(false).describe("Return full storage breakdown and model list"),
    },
    async (args) => {
      try {
        const telemetry = await getDatabaseTelemetry();
        if (!args.detailed) {
          const summary = {
            storage: {
              dbSizeMb: telemetry.storage.dbSizeMb,
              walSizeMb: telemetry.storage.walSizeMb,
              journalMode: telemetry.storage.journalMode,
              integrity: telemetry.storage.integrityCheck,
            },
            counts: telemetry.counts,
            cacheEfficiency: {
              hitRatePercent: `${telemetry.cache.cacheHitRatePercent}%`,
              hits: telemetry.cache.cacheHitCount,
              savedDollarsEst: `$${(telemetry.cache.cacheHitCount * 0.025).toFixed(2)}`,
            },
            ollama: telemetry.ollama,
          };
          return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(telemetry, null, 2) }],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error fetching telemetry: ${err.message || String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 4: curio_list_boards
  server.tool(
    "curio_list_boards",
    "List all smart lists, curated boards, and public vitrines created by the user in Curio.",
    {
      visibility: z.enum(["PUBLIC", "PRIVATE", "ALL"]).optional().default("ALL").describe("Filter boards by visibility"),
    },
    async (args) => {
      try {
        const user = await getOrCreateDefaultUser();

        let query = `
          SELECT 
            sl.id,
            sl.title,
            sl.slug,
            sl.description,
            sl.visibility,
            sl.is_paywalled as isPaywalled,
            sl.access_price_cents as accessPriceCents,
            sl.external_sync_target as externalSyncTarget,
            sl.created_at as createdAt,
            (SELECT COUNT(*) FROM list_items li WHERE li.list_id = sl.id) as itemCount
          FROM smart_lists sl
          WHERE sl.user_id = ?
        `;

        const params: any[] = [user.id];
        if (args.visibility === "PUBLIC") {
          query += ` AND sl.visibility = 'PUBLIC'`;
        } else if (args.visibility === "PRIVATE") {
          query += ` AND sl.visibility = 'PRIVATE'`;
        }
        query += ` ORDER BY sl.created_at DESC`;

        const boards = sqlite.prepare(query).all(...params) as Array<any>;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  visibilityFilter: args.visibility || "ALL",
                  count: boards.length,
                  boards,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error listing boards: ${err.message || String(err)}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

export async function startMcpServer() {
  const server = createCurioMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.main) {
  startMcpServer().catch((err) => {
    console.error("Curio MCP Server error:", err);
    process.exit(1);
  });
}
