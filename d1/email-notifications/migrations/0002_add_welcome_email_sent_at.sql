-- Migration number: 0002 	 2026-11-18T00:00:00.000Z

-- When the address was welcomed, which happens once: when Postmark accepted
-- our full welcome email, or when we learned Mailchimp had already welcomed it
-- (a Mailchimp subscriber, including a migrated one). NULL until then, so a
-- retry after a failed send still gets it.
ALTER TABLE users ADD COLUMN welcomeEmailSentAt TEXT;

-- Until now, having notification preferences meant the welcome email had been
-- sent, when the preferences were first saved.
UPDATE users
SET welcomeEmailSentAt = (
        SELECT createdAt FROM notification_preferences
        WHERE notification_preferences.userId = users.id
    ),
    updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (SELECT userId FROM notification_preferences);
