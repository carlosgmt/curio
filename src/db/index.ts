import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/curio.db";

try {
  mkdirSync(dirname(DB_PATH), { recursive: true });
} catch {
  // directory exists
}

export const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

// Helper to safely add column if it doesn't already exist
function ensureColumn(table: string, column: string, columnDef: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`);
    } catch (e) {
      console.warn(`Could not add column ${column} to ${table}:`, e);
    }
  }
}

// 1. Ensure core tables exist (base structures)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    is_pro INTEGER NOT NULL DEFAULT 0,
    ai_credits_remaining INTEGER NOT NULL DEFAULT 25,
    ai_credits_reset_at TEXT,
    custom_domain TEXT,
    affiliate_tags TEXT,
    google_sync_tokens TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS curio_types (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    json_schema TEXT NOT NULL,
    public_field_keys TEXT NOT NULL DEFAULT '[]',
    extraction_prompt TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS global_entities (
    id TEXT PRIMARY KEY NOT NULL,
    parent_entity_id TEXT,
    url_hash TEXT NOT NULL,
    entity_key TEXT NOT NULL UNIQUE,
    canonical_url TEXT NOT NULL,
    core_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    hero_image_url TEXT,
    core_structured_data TEXT NOT NULL DEFAULT '{}',
    extended_attributes TEXT NOT NULL DEFAULT '{}',
    ucp_sku_id TEXT,
    price_cents INTEGER,
    currency TEXT DEFAULT 'USD',
    price_verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entity_sources (
    id TEXT PRIMARY KEY NOT NULL,
    entity_id TEXT NOT NULL REFERENCES global_entities(id) ON DELETE CASCADE,
    seller_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    price_cents INTEGER,
    currency TEXT DEFAULT 'USD',
    affiliate_template TEXT,
    in_stock INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_saves (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    entity_id TEXT REFERENCES global_entities(id),
    custom_type_id TEXT REFERENCES curio_types(id),
    is_private_memo INTEGER NOT NULL DEFAULT 0,
    private_title TEXT,
    personal_notes TEXT,
    user_custom_values TEXT NOT NULL DEFAULT '{}',
    candidate_fallbacks TEXT NOT NULL DEFAULT '[]',
    auto_tags TEXT NOT NULL DEFAULT '[]',
    has_converted_purchase INTEGER NOT NULL DEFAULT 0,
    enrichment_status TEXT NOT NULL DEFAULT 'ENRICHED',
    visibility TEXT NOT NULL DEFAULT 'PRIVATE',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS smart_lists (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_paywalled INTEGER NOT NULL DEFAULT 0,
    access_price_cents INTEGER,
    auto_rules TEXT,
    external_sync_target TEXT DEFAULT 'NONE',
    visibility TEXT NOT NULL DEFAULT 'PRIVATE',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS list_items (
    id TEXT PRIMARY KEY NOT NULL,
    list_id TEXT NOT NULL REFERENCES smart_lists(id),
    save_id TEXT NOT NULL REFERENCES user_saves(id),
    position_index INTEGER NOT NULL DEFAULT 0,
    section_header TEXT,
    curator_note TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS entry_connections (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    source_save_id TEXT NOT NULL REFERENCES user_saves(id) ON DELETE CASCADE,
    target_save_id TEXT NOT NULL REFERENCES user_saves(id) ON DELETE CASCADE,
    connection_type TEXT NOT NULL,
    context_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// 2. Safe in-place schema migrations for existing SQLite databases (PRD v3.2 columns)
ensureColumn("curio_types", "parent_type_id", "TEXT");
ensureColumn("curio_types", "type_path", "TEXT NOT NULL DEFAULT ''");
ensureColumn("curio_types", "root_archetype", "TEXT NOT NULL DEFAULT 'PRODUCT'");
ensureColumn("curio_types", "default_silhouette", "TEXT NOT NULL DEFAULT 'generic'");
ensureColumn("curio_types", "identity_rules", "TEXT");

ensureColumn("global_entities", "canonical_external_id", "TEXT");
ensureColumn("global_entities", "identity_fingerprint", "TEXT");
ensureColumn("global_entities", "brand_or_creator", "TEXT");
ensureColumn("global_entities", "type_path", "TEXT");
ensureColumn("global_entities", "best_price_cents", "INTEGER");

ensureColumn("user_saves", "type_id", "TEXT REFERENCES curio_types(id)");
ensureColumn("user_saves", "type_path", "TEXT");
ensureColumn("user_saves", "preferred_source_id", "TEXT REFERENCES entity_sources(id)");

// 3. Now create indexes safely on all tables/columns
sqlite.exec(`
  CREATE INDEX IF NOT EXISTS idx_curio_types_path ON curio_types (type_path);
  CREATE INDEX IF NOT EXISTS idx_curio_types_parent ON curio_types (parent_type_id);

  CREATE INDEX IF NOT EXISTS idx_global_entities_url_hash ON global_entities (url_hash);
  CREATE INDEX IF NOT EXISTS idx_global_entities_parent_id ON global_entities (parent_entity_id);
  CREATE INDEX IF NOT EXISTS idx_global_entities_price_cents ON global_entities (price_cents);
  CREATE INDEX IF NOT EXISTS idx_global_entities_canonical_ext ON global_entities (canonical_external_id);
  CREATE INDEX IF NOT EXISTS idx_global_entities_type_path ON global_entities (type_path);

  CREATE INDEX IF NOT EXISTS idx_entity_sources_entity_id ON entity_sources (entity_id);
  CREATE INDEX IF NOT EXISTS idx_entity_sources_url_hash ON entity_sources (url_hash);

  CREATE INDEX IF NOT EXISTS idx_user_saves_user_id ON user_saves (user_id);
  CREATE INDEX IF NOT EXISTS idx_user_saves_entity_id ON user_saves (entity_id);
  CREATE INDEX IF NOT EXISTS idx_user_saves_type_path ON user_saves (type_path);

  CREATE INDEX IF NOT EXISTS idx_list_items_list_order ON list_items (list_id, position_index);

  CREATE INDEX IF NOT EXISTS idx_entry_connections_user ON entry_connections (user_id);
  CREATE INDEX IF NOT EXISTS idx_entry_connections_pair ON entry_connections (source_save_id, target_save_id);
`);

export const db = drizzle(sqlite, { schema });
export * from "./schema";
