import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";
import { lists, listRules } from "./schema";

const DB_PATH = process.env.DATABASE_PATH ?? "./data/memory.db";

try {
  mkdirSync(dirname(DB_PATH), { recursive: true });
} catch {
  // Directory already exists or permissions handled
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");

// Ensure tables exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL UNIQUE,
    icon text,
    color text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_default integer DEFAULT 0 NOT NULL,
    created_at text DEFAULT (datetime('now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS list_rules (
    id text PRIMARY KEY NOT NULL,
    list_id text NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    intent text NOT NULL UNIQUE,
    created_at text DEFAULT (datetime('now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cards (
    id text PRIMARY KEY NOT NULL,
    list_id text DEFAULT 'inbox' NOT NULL REFERENCES lists(id),
    intent text NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    title text NOT NULL,
    raw_text text NOT NULL,
    data text DEFAULT '{}' NOT NULL,
    tags text DEFAULT '[]' NOT NULL,
    parent_id text REFERENCES cards(id) ON DELETE CASCADE,
    subtype text,
    due_at text,
    created_at text DEFAULT (datetime('now')) NOT NULL,
    updated_at text DEFAULT (datetime('now')) NOT NULL,
    archived_at text
  );

  CREATE INDEX IF NOT EXISTS idx_cards_intent ON cards (intent);
  CREATE INDEX IF NOT EXISTS idx_cards_status ON cards (status);
  CREATE INDEX IF NOT EXISTS idx_cards_list ON cards (list_id);
  CREATE INDEX IF NOT EXISTS idx_cards_created ON cards (created_at);

  CREATE TABLE IF NOT EXISTS custom_types (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    description text,
    icon text DEFAULT 'Sparkles' NOT NULL,
    color text DEFAULT 'oklch(0.65 0.18 270)' NOT NULL,
    fields text DEFAULT '[]' NOT NULL,
    patterns text DEFAULT '[]' NOT NULL,
    created_at text DEFAULT (datetime('now')) NOT NULL,
    updated_at text DEFAULT (datetime('now')) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id text PRIMARY KEY NOT NULL,
    card_id text NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes integer NOT NULL,
    ai_caption text,
    path text NOT NULL,
    created_at text DEFAULT (datetime('now')) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_attachments_card ON attachments (card_id);

  CREATE TABLE IF NOT EXISTS card_events (
    id text PRIMARY KEY NOT NULL,
    card_id text NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    actor text DEFAULT 'user' NOT NULL,
    action text NOT NULL,
    diff text,
    created_at text DEFAULT (datetime('now')) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_card ON card_events (card_id);

  CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
    title, raw_text, tags,
    content='cards',
    content_rowid='rowid'
  );

  CREATE TRIGGER IF NOT EXISTS cards_fts_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, title, raw_text, tags)
    VALUES (new.rowid, new.title, new.raw_text, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS cards_fts_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, raw_text, tags)
    VALUES ('delete', old.rowid, old.title, old.raw_text, old.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS cards_fts_au AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, raw_text, tags)
    VALUES ('delete', old.rowid, old.title, old.raw_text, old.tags);
    INSERT INTO cards_fts(rowid, title, raw_text, tags)
    VALUES (new.rowid, new.title, new.raw_text, new.tags);
  END;
`);

try { sqlite.exec("ALTER TABLE cards ADD COLUMN parent_id text REFERENCES cards(id) ON DELETE CASCADE;"); } catch {}
try { sqlite.exec("ALTER TABLE cards ADD COLUMN subtype text;"); } catch {}
try { sqlite.exec("CREATE INDEX IF NOT EXISTS idx_cards_parent ON cards (parent_id);"); } catch {}

export const db = drizzle(sqlite, { schema });
export { sqlite };

// Seed default lists if empty
const countRow = sqlite.prepare("SELECT count(*) as c FROM lists").get() as { c: number };
if (countRow?.c === 0) {
  sqlite.exec(`
    INSERT INTO lists (id, name, icon, sort_order, is_default) VALUES
      ('inbox', 'Inbox', 'inbox', 0, 1),
      ('tasks', 'Tasks', 'check-square', 1, 0),
      ('calendar', 'Calendar', 'calendar', 2, 0),
      ('kitchen', 'Kitchen', 'chef-hat', 3, 0),
      ('notes', 'Notes', 'sticky-note', 4, 0),
      ('money', 'Money', 'wallet', 5, 0),
      ('style', 'Style', 'shirt', 6, 0);

    INSERT INTO list_rules (id, list_id, intent) VALUES
      ('r-todo', 'tasks', 'todo'),
      ('r-reminder', 'tasks', 'reminder'),
      ('r-habit', 'tasks', 'habit'),
      ('r-goal', 'tasks', 'goal'),
      ('r-event', 'calendar', 'event'),
      ('r-countdown', 'calendar', 'countdown'),
      ('r-recipe', 'kitchen', 'recipe'),
      ('r-note', 'notes', 'note'),
      ('r-link', 'notes', 'link'),
      ('r-contact', 'notes', 'contact'),
      ('r-expense', 'money', 'expense'),
      ('r-split', 'money', 'split'),
      ('r-apparel', 'style', 'apparel'),
      ('r-outfit', 'style', 'outfit');
  `);
}

