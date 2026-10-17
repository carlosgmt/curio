import { statSync, existsSync } from "node:fs";
import path from "node:path";
import { sqlite } from "@/db";

export interface CurioTelemetry {
  storage: {
    dbSizeBytes: number;
    dbSizeMb: number;
    walSizeBytes: number;
    walSizeMb: number;
    shmSizeBytes: number;
    shmSizeMb: number;
    journalMode: string;
    pageCount: number;
    pageSize: number;
    freelistCount: number;
    integrityCheck: string;
  };
  counts: {
    users: number;
    userSaves: number;
    globalEntities: number;
    entitySources: number;
    smartLists: number;
    entryConnections: number;
    curioTypes: number;
  };
  cache: {
    totalPublicSaves: number;
    uniqueEntities: number;
    cacheHitCount: number;
    cacheHitRatePercent: number;
    multiSourceEntities: number;
  };
  enrichment: {
    byStatus: {
      ENRICHED: number;
      FAILED: number;
      OPTIMISTIC: number;
      HEAD_PARSED: number;
      LAZY_QUEUED: number;
      LOCAL_ONLY: number;
      [key: string]: number;
    };
    missingArtworkCount: number;
  };
  archetypes: Record<string, number>;
  ollama: {
    status: "online" | "offline" | "degraded";
    latencyMs: number | null;
    activeModel: string;
    installedModels: string[];
  };
  process: {
    nodeVersion: string;
    bunVersion: string | null;
    uptimeSeconds: number;
    memoryRssMb: number;
  };
}

export async function getDatabaseTelemetry(): Promise<CurioTelemetry> {
  const dbPath = path.resolve(process.env.DATABASE_PATH ?? "./data/curio.db");
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;

  const dbSizeBytes = existsSync(dbPath) ? statSync(dbPath).size : 0;
  const walSizeBytes = existsSync(walPath) ? statSync(walPath).size : 0;
  const shmSizeBytes = existsSync(shmPath) ? statSync(shmPath).size : 0;

  const journalMode = (sqlite.pragma("journal_mode", { simple: true }) as string) || "unknown";
  const pageCount = (sqlite.pragma("page_count", { simple: true }) as number) || 0;
  const pageSize = (sqlite.pragma("page_size", { simple: true }) as number) || 4096;
  const freelistCount = (sqlite.pragma("freelist_count", { simple: true }) as number) || 0;
  const integrityCheck = (sqlite.pragma("integrity_check", { simple: true }) as string) || "ok";

  const getCount = (table: string): number => {
    try {
      const row = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      return row?.count || 0;
    } catch {
      return 0;
    }
  };

  const usersCount = getCount("users");
  const userSavesCount = getCount("user_saves");
  const globalEntitiesCount = getCount("global_entities");
  const entitySourcesCount = getCount("entity_sources");
  const smartListsCount = getCount("smart_lists");
  const entryConnectionsCount = getCount("entry_connections");
  const curioTypesCount = getCount("curio_types");

  // Cache metrics (PRD v3.2 §4.4)
  const totalPublicSavesRow = sqlite
    .prepare("SELECT COUNT(*) as count FROM user_saves WHERE is_private_memo = 0")
    .get() as { count: number };
  const totalPublicSaves = totalPublicSavesRow?.count || 0;
  const uniqueEntities = globalEntitiesCount;
  const cacheHitCount = Math.max(0, totalPublicSaves - uniqueEntities);
  const cacheHitRatePercent =
    totalPublicSaves > 0
      ? Number((((totalPublicSaves - uniqueEntities) / totalPublicSaves) * 100).toFixed(1))
      : 0;

  let multiSourceEntities = 0;
  try {
    const multiSourceRow = sqlite
      .prepare(
        "SELECT COUNT(*) as count FROM (SELECT entity_id FROM entity_sources GROUP BY entity_id HAVING COUNT(*) > 1)"
      )
      .get() as { count: number };
    multiSourceEntities = multiSourceRow?.count || 0;
  } catch {}

  // Enrichment breakdown
  const statusRows = sqlite
    .prepare("SELECT enrichment_status, COUNT(*) as count FROM user_saves GROUP BY enrichment_status")
    .all() as Array<{ enrichment_status: string; count: number }>;

  const byStatus: {
    ENRICHED: number;
    FAILED: number;
    OPTIMISTIC: number;
    HEAD_PARSED: number;
    LAZY_QUEUED: number;
    LOCAL_ONLY: number;
    [key: string]: number;
  } = {
    ENRICHED: 0,
    FAILED: 0,
    OPTIMISTIC: 0,
    HEAD_PARSED: 0,
    LAZY_QUEUED: 0,
    LOCAL_ONLY: 0,
  };
  for (const row of statusRows) {
    if (row.enrichment_status) {
      byStatus[row.enrichment_status] = row.count;
    }
  }

  let missingArtworkCount = 0;
  try {
    const missingArtworkRow = sqlite
      .prepare(`
        SELECT COUNT(*) as count 
        FROM user_saves s 
        JOIN global_entities g ON s.entity_id = g.id 
        WHERE g.hero_image_url IS NULL OR g.hero_image_url = ''
      `)
      .get() as { count: number };
    missingArtworkCount = missingArtworkRow?.count || 0;
  } catch {}

  // Archetypes breakdown
  const archetypes: Record<string, number> = {
    PRODUCT: 0,
    PLACE: 0,
    MEDIA: 0,
    ARTICLE: 0,
    PRIVATE_MEMO: 0,
    BOOK: 0,
    CULINARY: 0,
    OTHER: 0,
  };

  try {
    const saveArchetypes = sqlite
      .prepare(`
        SELECT 
          s.is_private_memo,
          s.type_path,
          g.core_type,
          ct.root_archetype
        FROM user_saves s
        LEFT JOIN global_entities g ON s.entity_id = g.id
        LEFT JOIN curio_types ct ON s.type_id = ct.id
      `)
      .all() as Array<{
        is_private_memo: number;
        type_path: string | null;
        core_type: string | null;
        root_archetype: string | null;
      }>;

    for (const s of saveArchetypes) {
      if (s.is_private_memo === 1) {
        archetypes.PRIVATE_MEMO++;
        continue;
      }
      const root = (s.root_archetype || s.core_type || "").toUpperCase();
      const path = (s.type_path || "").toLowerCase();
      if (path.includes("book") || root === "BOOK") {
        archetypes.BOOK++;
      } else if (
        path.includes("film") ||
        path.includes("movie") ||
        path.includes("music") ||
        root === "MEDIA"
      ) {
        archetypes.MEDIA++;
      } else if (path.includes("place") || root === "PLACE") {
        archetypes.PLACE++;
      } else if (path.includes("culinary") || path.includes("recipe") || root === "CULINARY") {
        archetypes.CULINARY++;
      } else if (path.includes("article") || path.includes("read") || root === "ARTICLE") {
        archetypes.ARTICLE++;
      } else if (path.includes("product") || root === "PRODUCT") {
        archetypes.PRODUCT++;
      } else if (root === "PRIVATE_MEMO") {
        archetypes.PRIVATE_MEMO++;
      } else {
        archetypes.OTHER++;
      }
    }
  } catch {}

  // Ollama Subsystem Probe
  const ollamaRawUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const ollamaBase = ollamaRawUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const activeModel = process.env.LOCAL_LLM_MODEL || "gemma4:12b-it-qat";

  let ollamaStatus: "online" | "offline" | "degraded" = "offline";
  let latencyMs: number | null = null;
  let installedModels: string[] = [];

  try {
    const start = Date.now();
    const res = await fetch(`${ollamaBase}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      latencyMs = Date.now() - start;
      const data = (await res.json()) as { models?: Array<{ name?: string; model?: string }> };
      installedModels = data.models?.map((m) => m.name || m.model || "").filter(Boolean) || [];
      ollamaStatus = "online";
    } else {
      ollamaStatus = "degraded";
    }
  } catch {
    ollamaStatus = "offline";
    latencyMs = null;
  }

  return {
    storage: {
      dbSizeBytes,
      dbSizeMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
      walSizeBytes,
      walSizeMb: Number((walSizeBytes / (1024 * 1024)).toFixed(2)),
      shmSizeBytes,
      shmSizeMb: Number((shmSizeBytes / (1024 * 1024)).toFixed(2)),
      journalMode,
      pageCount,
      pageSize,
      freelistCount,
      integrityCheck,
    },
    counts: {
      users: usersCount,
      userSaves: userSavesCount,
      globalEntities: globalEntitiesCount,
      entitySources: entitySourcesCount,
      smartLists: smartListsCount,
      entryConnections: entryConnectionsCount,
      curioTypes: curioTypesCount,
    },
    cache: {
      totalPublicSaves,
      uniqueEntities,
      cacheHitCount,
      cacheHitRatePercent,
      multiSourceEntities,
    },
    enrichment: {
      byStatus,
      missingArtworkCount,
    },
    archetypes,
    ollama: {
      status: ollamaStatus,
      latencyMs,
      activeModel,
      installedModels,
    },
    process: {
      nodeVersion: process.version,
      bunVersion: typeof Bun !== "undefined" ? Bun.version : null,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    },
  };
}
