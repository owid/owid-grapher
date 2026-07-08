-- Migration number: 0001 	 2026-06-11T00:00:00.000Z
-- Users of the email notifications system. The email is the identifier users
-- enter in the subscribe form; everything else hangs off the user id so we
-- can later add magic links, confirmation tokens, etc. without touching this
-- table.
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    -- Users are subscribed immediately (single opt-in) and can unsubscribe
    -- via the link in every email.
    status TEXT NOT NULL DEFAULT 'subscribed'
        CHECK (status IN ('subscribed', 'unsubscribed')),
    -- Secret token identifying the user in unsubscribe/manage links.
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row of notification preferences per user. Kept separate from users so
-- we can support multiple notification configurations per user later.
CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    -- JSON array of topic tag names. An empty array means "all topics".
    topic_tags TEXT NOT NULL CHECK (json_valid(topic_tags)),
    -- JSON array of OwidGdocType values (article, data-insight, announcement).
    content_types TEXT NOT NULL CHECK (json_valid(content_types)),
    frequency TEXT NOT NULL
        CHECK (frequency IN ('daily', 'weekly')),
    -- When the last notification email was sent to this user. Used by the
    -- send job to determine the window of new content to include. NULL until
    -- the first email is sent.
    last_sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Log of sent notification emails, for debugging and analytics (Postmark
-- tracks opens/clicks; this records what each email contained).
CREATE TABLE sent_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    frequency TEXT NOT NULL,
    -- JSON array of the content slugs included in the email.
    item_slugs TEXT NOT NULL CHECK (json_valid(item_slugs)),
    postmark_message_id TEXT,
    sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
