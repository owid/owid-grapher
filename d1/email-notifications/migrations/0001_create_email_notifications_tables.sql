-- Migration number: 0001 	 2026-06-11T00:00:00.000Z
-- Timestamp convention: updatedAt defaults are applied on insert only. Every
-- UPDATE to a table with an updatedAt column must also set updatedAt in the
-- same statement because D1 does not update it automatically.

-- Identities known to the email preferences system. This includes readers who
-- only subscribe to the Mailchimp-owned OWID Brief so they can still request a
-- magic link and manage all of their email preferences in one place.
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    -- Whether notifications matching the user's preferences are active.
    -- The OWID Brief subscription state lives only in Mailchimp.
    emailNotificationsStatus TEXT NOT NULL DEFAULT 'unsubscribed'
        CHECK (emailNotificationsStatus IN ('subscribed', 'unsubscribed')),
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

-- Latest known Postmark suppression state for each address and message stream.
-- Reactivated addresses remain with isSuppressed = 0 so delayed older webhooks
-- cannot restore stale suppression state.
CREATE TABLE postmark_suppressions (
    email TEXT NOT NULL,
    messageStream TEXT NOT NULL,
    isSuppressed INTEGER NOT NULL CHECK (isSuppressed IN (0, 1)),
    -- Timestamp of the latest accepted Postmark SubscriptionChange event.
    postmarkChangedAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (email, messageStream)
);
