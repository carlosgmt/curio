-- Lists: organizational containers for cards
CREATE TABLE IF NOT EXISTS lists (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name        TEXT NOT NULL UNIQUE,
    icon        TEXT,                    -- emoji or lucide icon name
    color       TEXT,                    -- hex color for UI
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_default  INTEGER NOT NULL DEFAULT 0, -- 1 = inbox
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Auto-sort rules: intent → list mapping
CREATE TABLE IF NOT EXISTS list_rules (
    id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    intent      TEXT NOT NULL UNIQUE,    -- one intent maps to at most one list
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_list_rules_intent ON list_rules(intent);

-- Seed default lists and rules
INSERT INTO lists (id, name, icon, sort_order, is_default) VALUES
    ('inbox',    'Inbox',    'inbox',         0, 1),
    ('tasks',    'Tasks',    'check-square',  1, 0),
    ('calendar', 'Calendar', 'calendar',      2, 0),
    ('kitchen',  'Kitchen',  'chef-hat',      3, 0),
    ('notes',    'Notes',    'sticky-note',   4, 0),
    ('money',    'Money',    'wallet',        5, 0),
    ('style',    'Style',    'shirt',         6, 0);

INSERT INTO list_rules (list_id, intent) VALUES
    ('tasks',    'todo'),
    ('tasks',    'reminder'),
    ('tasks',    'habit'),
    ('tasks',    'goal'),
    ('calendar', 'event'),
    ('calendar', 'countdown'),
    ('kitchen',  'recipe'),
    ('notes',    'note'),
    ('notes',    'link'),
    ('notes',    'contact'),
    ('money',    'expense'),
    ('money',    'split'),
    ('style',    'apparel'),
    ('style',    'outfit');

-- Add list_id FK to cards
ALTER TABLE cards ADD COLUMN list_id TEXT REFERENCES lists(id) DEFAULT 'inbox';
CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
