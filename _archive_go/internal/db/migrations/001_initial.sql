CREATE TABLE IF NOT EXISTS cards (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    intent      TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',
    title       TEXT NOT NULL,
    raw_text    TEXT NOT NULL,
    data        TEXT NOT NULL DEFAULT '{}',
    tags        TEXT NOT NULL DEFAULT '[]',
    due_at      DATETIME,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    archived_at DATETIME
);

CREATE TABLE IF NOT EXISTS attachments (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    card_id     TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    ai_caption  TEXT,
    path        TEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cards_intent ON cards(intent);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_card ON attachments(card_id);

CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
    title, raw_text, tags,
    content='cards',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, title, raw_text, tags) VALUES (new.rowid, new.title, new.raw_text, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, raw_text, tags) VALUES('delete', old.rowid, old.title, old.raw_text, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, title, raw_text, tags) VALUES('delete', old.rowid, old.title, old.raw_text, old.tags);
    INSERT INTO cards_fts(rowid, title, raw_text, tags) VALUES (new.rowid, new.title, new.raw_text, new.tags);
END;
