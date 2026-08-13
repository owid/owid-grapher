-- Migration number: 0001 	 2026-06-11T00:00:00.000Z
-- Users of the email notifications system. The email is the identifier users
-- enter in the subscribe form; everything else hangs off the user id.
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    -- Users are subscribed immediately (single opt-in) and can unsubscribe
    -- via the link in every email.
    status TEXT NOT NULL DEFAULT 'subscribed'
        CHECK (status IN ('subscribed', 'unsubscribed')),
    -- Secret token identifying the user in unsubscribe/manage links.
    token TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One row of notification preferences per user. Kept separate from users so
-- we can support multiple notification configurations per user later.
CREATE TABLE notification_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    -- JSON array of topic tag names. An empty array means "all topics".
    topicTags TEXT NOT NULL CHECK (json_valid(topicTags)),
    -- JSON array of OwidGdocType values (article, data-insight, announcement).
    contentTypes TEXT NOT NULL CHECK (json_valid(contentTypes)),
    frequency TEXT NOT NULL
        CHECK (frequency IN ('daily', 'weekly')),
    -- When the last notification email was sent to this user. Used by the
    -- send job to determine the window of new content to include. NULL until
    -- the first email is sent.
    lastSentAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Short-lived magic-link tokens for the update-preferences page. Unlike the
-- permanent users.token (the low-privilege identifier in email footer links,
-- which can only unsubscribe or request a magic link), these prove recent
-- control of the inbox and allow viewing and editing preferences, so they
-- expire.
CREATE TABLE tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX tokens_userId ON tokens (userId);

-- Notification emails submitted to Postmark. Delivery webhooks update the
-- status and deliveredAt fields.
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    frequency TEXT NOT NULL,
    -- JSON array of the content slugs included in the email.
    itemSlugs TEXT NOT NULL CHECK (json_valid(itemSlugs)),
    messageId TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'delivered')),
    deliveredAt TEXT,
    sentAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Receipt ledger used only to make Postmark webhook processing idempotent.
-- The application-generated key includes the record type because delivery and
-- subscription-change events can refer to the same Postmark MessageID.
-- Subscription changes may have no MessageID at all.
CREATE TABLE postmark_webhook_receipts (
    idempotencyKey TEXT PRIMARY KEY,
    recordType TEXT NOT NULL,
    -- Raw Postmark message ID for correlation. NULL for subscription changes
    -- such as manual suppressions and reactivations that are not tied to a
    -- particular sent message.
    messageId TEXT,
    processedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Mirror of Postmark's broadcast-stream suppression list. Subscription-change
-- webhooks add normalized addresses when Postmark suppresses them and remove
-- them on reactivation.
CREATE TABLE suppressed_addresses (
    email TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
