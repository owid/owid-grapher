-- Migration number: 0002 	 2026-07-10T00:00:00.000Z
-- Double opt-in support: a 'pending' user status for addresses that have not
-- yet confirmed, and purpose-scoped expiring tokens for the confirm and
-- magic-link flows. The permanent users.token stays as the low-privilege
-- identifier in email footer links (unsubscribe / request a magic link).

PRAGMA defer_foreign_keys = true;

-- SQLite can't alter a CHECK constraint, so rebuild the users table to allow
-- the 'pending' status. New users start as pending and become subscribed when
-- they confirm.
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'subscribed', 'unsubscribed')),
    -- Secret token identifying the user in email footer links. Long-lived and
    -- low-privilege: it can only unsubscribe or request a magic link.
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO users_new (id, email, status, token, created_at, updated_at)
    SELECT id, email, status, token, created_at, updated_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

-- Purpose-scoped, expiring tokens. Unlike the permanent users.token, these
-- carry privileges (applying preference changes, editing preferences), so
-- they expire and confirm tokens are single-use.
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'magic-link')),
    -- For 'confirm' tokens: JSON of the preferences chosen in the subscribe
    -- form, held here as pending until the token is confirmed, then applied
    -- to notification_preferences. NULL for magic-link tokens.
    payload TEXT CHECK (payload IS NULL OR json_valid(payload)),
    expires_at TEXT NOT NULL,
    -- Set when a single-use token is consumed. NULL while unused.
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX tokens_user_id ON tokens (user_id);
