-- Migration number: 0002 	 2026-07-10T00:00:00.000Z
-- Purpose-scoped, expiring tokens for the confirm-changes and magic-link
-- flows. Unlike the permanent users.token (the low-privilege identifier in
-- email footer links, which can only unsubscribe or request a magic link),
-- these carry privileges (applying preference changes, editing preferences),
-- so they expire and confirm tokens are single-use.
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'magic-link')),
    -- For 'confirm' tokens: JSON of the preferences chosen in the subscribe
    -- form, held here until the token is confirmed, then applied to
    -- notification_preferences. NULL for magic-link tokens.
    payload TEXT CHECK (payload IS NULL OR json_valid(payload)),
    expires_at TEXT NOT NULL,
    -- Set when a single-use token is consumed. NULL while unused.
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX tokens_user_id ON tokens (user_id);
