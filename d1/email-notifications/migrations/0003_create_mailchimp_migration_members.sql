-- Migration number: 0003 	 2026-11-23T00:00:00.000Z

-- Working state of the gradual move of the Mailchimp "Data Insights" and
-- "Article Updates" RSS newsletters to email notifications (see
-- baker/emailNotifications/mailchimpMigration). One row per Mailchimp
-- subscriber of either newsletter. Temporary: drop the table once the
-- migration is finished.
CREATE TABLE mailchimp_migration_members (
    email TEXT PRIMARY KEY,
    -- Which of the two newsletters the address had in Mailchimp when it was
    -- last snapshotted (before migrating) or when it was migrated.
    dataInsights INTEGER NOT NULL CHECK (dataInsights IN (0, 1)),
    articles INTEGER NOT NULL CHECK (articles IN (0, 1)),
    -- 1 (most engaged) to 4 (unengaged), from Mailchimp activity.
    engagementTier INTEGER NOT NULL CHECK (engagementTier BETWEEN 1 AND 4),
    -- The step of the ramp the address migrates in. NULL while it's held
    -- back for being unengaged.
    cohort INTEGER,
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'migrated', 'skipped')),
    -- Why a 'skipped' address wasn't migrated.
    skipReason TEXT,
    -- JSON of the notification preferences the address had before it was
    -- migrated, to restore on rollback. NULL when the migration created the
    -- subscription.
    previousPreferences TEXT CHECK (
        previousPreferences IS NULL OR json_valid(previousPreferences)
    ),
    migratedAt TEXT,
    -- When the newsletters were turned off in Mailchimp. A migrated address
    -- without it still gets the Mailchimp emails; rerunning the cohort
    -- retries.
    mailchimpUpdatedAt TEXT,
    rolledBackAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX mailchimp_migration_members_cohort_status
    ON mailchimp_migration_members (cohort, status);
