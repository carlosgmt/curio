#!/usr/bin/env bun
import { getDatabaseTelemetry } from "../lib/system/telemetry";
import { sqlite } from "../db";
import { resolveFilm } from "../lib/enrichment/providers/cinema";
import { resolveBook } from "../lib/enrichment/providers/books";
import { extractOpenGraph } from "../lib/enrichment/opengraph";
import { generateEmbedding } from "../lib/search/vector";
import { hashPassword } from "../lib/auth/service";

function printBox(title: string, rows: Array<[string, string | number]>) {
  const col1Width = 32;
  const col2Width = 36;
  const totalInnerWidth = col1Width + col2Width + 3;

  console.log(`┌${"─".repeat(totalInnerWidth)}┐`);
  const padTitle = ` ${title} `;
  const leftPad = Math.floor((totalInnerWidth - padTitle.length) / 2);
  const rightPad = totalInnerWidth - padTitle.length - leftPad;
  console.log(`│${" ".repeat(leftPad)}\x1b[1m\x1b[36m${padTitle}\x1b[0m${" ".repeat(rightPad)}│`);
  console.log(`├${"─".repeat(col1Width + 1)}┬${"─".repeat(col2Width + 1)}┤`);

  for (const [k, v] of rows) {
    const kStr = String(k).padEnd(col1Width);
    const vStr = String(v).padEnd(col2Width);
    console.log(`│ ${kStr}│ ${vStr}│`);
  }
  console.log(`└${"─".repeat(col1Width + 1)}┴${"─".repeat(col2Width + 1)}┘\n`);
}

async function runStats() {
  console.log("\n\x1b[1m\x1b[35m=== Curio Operator System Telemetry ===\x1b[0m\n");
  const t = await getDatabaseTelemetry();

  // Storage
  printBox("SQLite WAL Engine & Storage", [
    ["DB File Size", `${t.storage.dbSizeMb} MB (${t.storage.dbSizeBytes.toLocaleString()} bytes)`],
    ["WAL Journal Size", `${t.storage.walSizeMb} MB (${t.storage.walSizeBytes.toLocaleString()} bytes)`],
    ["SHM Shared Memory", `${t.storage.shmSizeMb} MB`],
    ["Journal Mode", t.storage.journalMode.toUpperCase()],
    ["Page Count / Size", `${t.storage.pageCount.toLocaleString()} pages @ ${t.storage.pageSize} B`],
    ["Freelist Count", `${t.storage.freelistCount} pages`],
    ["Database Integrity", t.storage.integrityCheck === "ok" ? "✓ OK" : t.storage.integrityCheck],
  ]);

  // Entities & Saves
  printBox("Entity & Save Metrics", [
    ["Total Users", t.counts.users],
    ["Total Saves", t.counts.userSaves],
    ["Public Saves", t.cache.totalPublicSaves],
    ["Step-0 Private Memos", t.archetypes.PRIVATE_MEMO || 0],
    ["Canonical Entities", t.counts.globalEntities],
    ["Multi-Merchant Sources", t.counts.entitySources],
    ["Smart Lists", t.counts.smartLists],
    ["Entry Connections", t.counts.entryConnections],
  ]);

  // Cache
  printBox("Global Cache & Compute Reuse", [
    ["Unique Canonical Entities", t.cache.uniqueEntities],
    ["Cache Hits (Compute Avoided)", t.cache.cacheHitCount],
    ["Cache Hit Rate", `${t.cache.cacheHitRatePercent}%`],
    ["Multi-Source Entities", t.cache.multiSourceEntities],
    ["Estimated Dollar Savings", `$${(t.cache.cacheHitCount * 0.025).toFixed(2)}`],
  ]);

  // External Subsystems
  printBox("External Subsystems & Host", [
    ["Local Ollama Status", t.ollama.status.toUpperCase()],
    ["Ollama Latency", t.ollama.latencyMs ? `${t.ollama.latencyMs} ms` : "N/A"],
    ["Ollama Active Model", t.ollama.activeModel],
    ["Host Runtime", `Bun ${t.process.bunVersion || "runtime"} (${t.process.nodeVersion})`],
    ["Memory RSS", `${t.process.memoryRssMb} MB`],
    ["Host Uptime", `${Math.floor(t.process.uptimeSeconds / 60)} min ${t.process.uptimeSeconds % 60} sec`],
  ]);
}

async function runTriage() {
  console.log("\n\x1b[1m\x1b[33m=== Curio Ingestion Triage Queue ===\x1b[0m\n");

  const items = sqlite
    .prepare(`
      SELECT 
        s.id as saveId,
        s.type_path as typePath,
        s.enrichment_status as enrichmentStatus,
        s.private_title as privateTitle,
        g.title as entityTitle,
        g.hero_image_url as heroImageUrl,
        g.canonical_external_id as canonicalExternalId
      FROM user_saves s
      LEFT JOIN global_entities g ON s.entity_id = g.id
      WHERE s.is_private_memo = 0 AND (s.enrichment_status = 'FAILED' OR g.hero_image_url IS NULL OR g.hero_image_url = '')
      ORDER BY s.created_at DESC
      LIMIT 50
    `)
    .all() as Array<any>;

  if (items.length === 0) {
    console.log("\x1b[32m✓ Triage queue is empty! All saves are enriched with complete artwork.\x1b[0m\n");
    return;
  }

  console.log(`Found ${items.length} items needing attention:\n`);
  console.log(`┌${"─".repeat(38)}┬${"─".repeat(24)}┬${"─".repeat(14)}┬${"─".repeat(24)}┐`);
  console.log(`│ ${"Save ID / Title".padEnd(36)} │ ${"Type Path".padEnd(22)} │ ${"Status".padEnd(12)} │ ${"Missing Elements".padEnd(22)} │`);
  console.log(`├${"─".repeat(38)}┼${"─".repeat(24)}┼${"─".repeat(14)}┼${"─".repeat(24)}┤`);

  for (const item of items) {
    const title = (item.privateTitle || item.entityTitle || "Untitled").substring(0, 36);
    const typePath = (item.typePath || "uncategorized").substring(0, 22);
    const status = item.enrichmentStatus.padEnd(12);
    const missing: string[] = [];
    if (!item.heroImageUrl) missing.push("artwork");
    if (!item.canonicalExternalId) missing.push("external_id");
    if (item.enrichmentStatus === "FAILED") missing.push("failed");
    const missingStr = missing.join(", ").substring(0, 22);

    console.log(`│ ${title.padEnd(36)} │ ${typePath.padEnd(22)} │ ${status} │ ${missingStr.padEnd(22)} │`);
  }
  console.log(`└${"─".repeat(38)}┴${"─".repeat(24)}┴${"─".repeat(14)}┴${"─".repeat(24)}┘\n`);
}

async function runReEnrich(args: string[]) {
  const mode = args.includes("--all") ? "all" : "failed";
  console.log(`\n\x1b[1m\x1b[36m=== Curio Batch Re-enrichment (mode: ${mode}) ===\x1b[0m\n`);

  const query =
    mode === "all"
      ? `SELECT s.id as saveId, s.entity_id as entityId, s.type_path as typePath, g.title, g.canonical_url as canonicalUrl, g.canonical_external_id as canonicalExternalId, g.hero_image_url as heroImageUrl, g.core_type as coreType, g.summary, g.brand_or_creator as brandOrCreator, g.core_structured_data as coreStructuredData FROM user_saves s JOIN global_entities g ON s.entity_id = g.id`
      : `SELECT s.id as saveId, s.entity_id as entityId, s.type_path as typePath, g.title, g.canonical_url as canonicalUrl, g.canonical_external_id as canonicalExternalId, g.hero_image_url as heroImageUrl, g.core_type as coreType, g.summary, g.brand_or_creator as brandOrCreator, g.core_structured_data as coreStructuredData FROM user_saves s JOIN global_entities g ON s.entity_id = g.id WHERE s.enrichment_status = 'FAILED' OR g.hero_image_url IS NULL OR g.hero_image_url = ''`;

  const targets = sqlite.prepare(query).all() as Array<any>;
  if (targets.length === 0) {
    console.log("\x1b[32m✓ No items require re-enrichment.\x1b[0m\n");
    return;
  }

  console.log(`Processing ${targets.length} items with concurrency = 3...\n`);
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targets.length; i += 3) {
    const chunk = targets.slice(i, i + 3);
    await Promise.all(
      chunk.map(async (target) => {
        try {
          let updatedHero = target.heroImageUrl;
          let updatedSummary = target.summary;
          let updatedBrandOrCreator = target.brandOrCreator;
          let parsedCoreData: Record<string, unknown> = {};
          try {
            parsedCoreData = JSON.parse(target.coreStructuredData || "{}");
          } catch {}

          const path = (target.typePath || "").toLowerCase();
          const core = (target.coreType || "").toUpperCase();

          if (core === "MEDIA" || path.startsWith("/media")) {
            const film = await resolveFilm(target.title);
            if (film) {
              if (film.posterUrl) updatedHero = film.posterUrl;
              if (film.summary) updatedSummary = film.summary;
              if (film.director) updatedBrandOrCreator = film.director;
              parsedCoreData = { ...parsedCoreData, ...film.coreStructuredData };
            }
          } else if (core === "BOOK" || path.includes("book")) {
            const bQuery = target.canonicalExternalId || target.title;
            const book = await resolveBook(bQuery);
            if (book) {
              if (book.coverUrl) updatedHero = book.coverUrl;
              if (book.summary) updatedSummary = book.summary;
              if (book.author) updatedBrandOrCreator = book.author;
              parsedCoreData = { ...parsedCoreData, ...book.coreStructuredData };
            }
          } else if (target.canonicalUrl && target.canonicalUrl.startsWith("http")) {
            const meta = await extractOpenGraph(target.canonicalUrl);
            if (meta.image) updatedHero = meta.image;
            if (meta.description) updatedSummary = meta.description;
            if (meta.authorOrCreator) updatedBrandOrCreator = meta.authorOrCreator;
          }

          sqlite
            .prepare(`
              UPDATE global_entities 
              SET hero_image_url = ?, summary = ?, brand_or_creator = ?, core_structured_data = ?, updated_at = datetime('now')
              WHERE id = ?
            `)
            .run(
              updatedHero,
              updatedSummary,
              updatedBrandOrCreator,
              JSON.stringify(parsedCoreData),
              target.entityId
            );

          sqlite
            .prepare(`UPDATE user_saves SET enrichment_status = 'ENRICHED' WHERE id = ?`)
            .run(target.saveId);

          successCount++;
          process.stdout.write(`\r\x1b[32m✓ Progress: ${successCount + failedCount}/${targets.length} items\x1b[0m`);
        } catch {
          failedCount++;
          process.stdout.write(`\r\x1b[33m! Progress: ${successCount + failedCount}/${targets.length} items\x1b[0m`);
        }
      })
    );
  }

  console.log(`\n\n\x1b[32mCompleted re-enrichment: ${successCount} succeeded, ${failedCount} failed.\x1b[0m\n`);
}

async function runReindex() {
  console.log("\n\x1b[1m\x1b[34m=== Curio Semantic Vector Reindexer ===\x1b[0m\n");
  const startTime = Date.now();

  const saves = sqlite
    .prepare(`
      SELECT 
        s.id,
        s.private_title as privateTitle,
        s.personal_notes as personalNotes,
        s.auto_tags as autoTags,
        s.type_path as typePath,
        g.title as entityTitle,
        g.summary
      FROM user_saves s
      LEFT JOIN global_entities g ON s.entity_id = g.id
    `)
    .all() as Array<any>;

  console.log(`Indexing ${saves.length} saves into semantic embeddings...`);

  let count = 0;
  for (const save of saves) {
    const title = save.privateTitle || save.entityTitle || "";
    const notes = save.personalNotes || "";
    let tags = "";
    try {
      const parsedTags = JSON.parse(save.autoTags || "[]");
      tags = Array.isArray(parsedTags) ? parsedTags.join(" ") : "";
    } catch {}

    const textToEmbed = `${title} ${notes} ${tags} ${save.typePath || ""}`.trim();
    if (textToEmbed) {
      const embedding = await generateEmbedding(textToEmbed);
      sqlite
        .prepare(`UPDATE user_saves SET private_embedding = ? WHERE id = ?`)
        .run(JSON.stringify(embedding), save.id);
      count++;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\x1b[32m✓ Reindexed ${count} saves in ${durationSec}s\x1b[0m\n`);
}

async function runSetPassword(args: string[]) {
  const username = args[1]?.toLowerCase().replace(/^@/, "");
  const newPassword = args[2];
  const newEmail = args[3]?.toLowerCase();

  if (!username || !newPassword) {
    console.log("Usage: bun run src/cli/admin.ts set-password <username> <new-password> [new-email]");
    return;
  }

  if (newPassword.length < 6) {
    console.log("\x1b[31mError: Password must be at least 6 characters long.\x1b[0m");
    return;
  }

  const hash = hashPassword(newPassword);
  let result;
  if (newEmail) {
    result = sqlite
      .prepare("UPDATE users SET password_hash = ?, is_admin = 1, email = ? WHERE lower(username) = ?")
      .run(hash, newEmail, username);
  } else {
    result = sqlite
      .prepare("UPDATE users SET password_hash = ?, is_admin = 1 WHERE lower(username) = ?")
      .run(hash, username);
  }

  if (result.changes > 0) {
    console.log(`\n\x1b[32m✓ Successfully set password and granted admin role for user @${username}${newEmail ? ` (email: ${newEmail})` : ""}\x1b[0m\n`);
  } else {
    console.log(`\n\x1b[31mError: User @${username} not found in database.\x1b[0m\n`);
  }
}

async function runListUsers() {
  console.log("\n\x1b[1m\x1b[36m=== Curio Registered Users ===\x1b[0m\n");
  const users = sqlite
    .prepare("SELECT id, email, username, display_name, password_hash, is_admin, created_at FROM users ORDER BY created_at ASC")
    .all() as Array<any>;

  for (const u of users) {
    const hasPassword = Boolean(u.password_hash);
    const adminTag = u.is_admin ? " [ADMIN]" : "";
    const passTag = hasPassword ? "\x1b[32m[Password Set]\x1b[0m" : "\x1b[33m[No Password / Legacy Seed]\x1b[0m";
    console.log(`• @${u.username}${adminTag} (${u.display_name || "No Name"}) - ${u.email} ${passTag}`);
  }
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "stats";

  switch (command) {
    case "stats":
      await runStats();
      break;
    case "triage":
      await runTriage();
      break;
    case "re-enrich":
      await runReEnrich(args);
      break;
    case "reindex":
      await runReindex();
      break;
    case "set-password":
      await runSetPassword(args);
      break;
    case "users":
      await runListUsers();
      break;
    default:
      console.log(`
Curio Admin CLI:
  bun run src/cli/admin.ts stats                           Show system telemetry and WAL metrics
  bun run src/cli/admin.ts users                           List registered users and password state
  bun run src/cli/admin.ts set-password <user> <pass>      Set password & grant admin role
  bun run src/cli/admin.ts triage                          Inspect incomplete/failed saves
  bun run src/cli/admin.ts re-enrich [--all]               Batch re-enrich metadata & hero art
  bun run src/cli/admin.ts reindex                         Rebuild vector embeddings in SQLite
`);
      break;
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("CLI Error:", err);
    process.exit(1);
  });
}
