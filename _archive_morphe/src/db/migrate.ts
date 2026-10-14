import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./index";

console.log("Running Drizzle migrations...");
migrate(db, { migrationsFolder: "./drizzle" });

// FTS5 virtual table (not expressible in Drizzle schema)
sqlite.exec(`
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

console.log("Migrations complete.");
