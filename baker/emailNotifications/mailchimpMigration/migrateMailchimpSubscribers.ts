/**
 * Gradually moves the subscribers of the Mailchimp "Data Insights" and
 * "Article Updates" RSS newsletters to email notifications, which are sent
 * via Postmark. The move is spread over cohorts so that mailbox providers see
 * the volume from Postmark's IPs grow gradually, most engaged readers first.
 *
 *   yarn migrateMailchimpSubscribers snapshot
 *       Record who is on the newsletters and how engaged they are, and split
 *       them into cohorts. Safe to rerun: once cohorts have started
 *       migrating, it only adds newcomers to a final sweep cohort.
 *   yarn migrateMailchimpSubscribers migrate <cohort>
 *       Subscribe a cohort to email notifications, then turn its newsletters
 *       off in Mailchimp. Run it right after Mailchimp's daily sends. Safe
 *       to rerun: it picks up where it stopped.
 *   yarn migrateMailchimpSubscribers rollback <cohort>
 *       Put a migrated cohort back on the Mailchimp newsletters.
 *   yarn migrateMailchimpSubscribers status
 *       Progress per cohort and Postmark's delivery statistics.
 *
 * --dry-run reports what snapshot, migrate or rollback would do without
 * writing anywhere. --local uses the local wrangler D1 database, for trying
 * the commands out: Mailchimp is still read from the real account, but never
 * changed.
 */
import * as _ from "lodash-es"
import { Models, ServerClient } from "postmark"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { EmailNotificationsPreferences } from "@ourworldindata/types"
import {
    POSTMARK_API_BASE_URL,
    POSTMARK_SERVER_TOKEN,
} from "../../../settings/serverSettings.js"
import {
    D1Client,
    batchWithRetry,
    createLocalD1Client,
    createRemoteD1Client,
    queryWithRetry,
} from "../emailNotificationsD1.js"
import {
    fetchLatestOpens,
    fetchRssSchedule,
    fetchSentCampaignIds,
    fetchSubscribedMembers,
    setNewsletters as setNewslettersInMailchimp,
} from "./mailchimpApi.js"
import {
    ENGAGEMENT_WINDOW_MS,
    EngagementTier,
    MailchimpNewsletters,
    MigrationPlan,
    NotificationsUserState,
    SWEEP_COHORT,
    SkipReason,
    UNENGAGED_TIER,
    assignCohorts,
    classifyEngagement,
    getCutoverTime,
    getLatestDailyCheck,
    planMigration,
} from "./mailchimpMigrationUtils.js"

// Must match the database_name in wrangler.jsonc; only used with --local.
const LOCAL_D1_DATABASE_NAME = "owid-email-notifications-staging"

// How many addresses go into one D1 statement and one Mailchimp update
// request (which takes up to 500). A JSON row is up to about 300 bytes, and
// with --local the rows are inlined into the SQL, which SQLite limits to
// 100 KB.
const CHUNK_SIZE = 250

const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"

interface Options {
    dryRun: boolean
    local: boolean
}

function createD1Client(local: boolean): D1Client {
    return local
        ? createLocalD1Client(LOCAL_D1_DATABASE_NAME)
        : createRemoteD1Client()
}

/**
 * Turn newsletters on or off in Mailchimp and return the addresses it didn't
 * update. A local run leaves the real Mailchimp account alone.
 */
async function setNewsletters(
    members: ({ email: string } & MailchimpNewsletters)[],
    enabled: boolean,
    local: boolean
): Promise<Set<string>> {
    if (!local) return setNewslettersInMailchimp(members, enabled)
    console.log(
        `Local run: left Mailchimp unchanged memberCount=${members.length}`
    )
    return new Set()
}

// --- snapshot ---

interface SnapshotMember extends MailchimpNewsletters {
    email: string
    engagementTier: EngagementTier
    cohort: number | null
}

async function hasMigrationStarted(d1: D1Client): Promise<boolean> {
    const rows = await queryWithRetry<{ startedCount: number }>(
        d1,
        `SELECT COUNT(*) AS startedCount
         FROM mailchimp_migration_members
         WHERE status != 'planned' OR rolledBackAt IS NOT NULL`
    )
    return (rows[0]?.startedCount ?? 0) > 0
}

async function snapshot({
    dryRun,
    local,
    engagementDays,
}: Options & { engagementDays: number }): Promise<void> {
    const d1 = createD1Client(local)
    const now = new Date()

    const members = (await fetchSubscribedMembers()).filter(
        (member) => member.dataInsights || member.articles
    )
    const campaignIds = await fetchSentCampaignIds(
        new Date(now.getTime() - engagementDays * 24 * 60 * 60 * 1000)
    )
    console.log(
        `Fetching opens memberCount=${members.length} campaignCount=${campaignIds.length}`
    )
    const opensByEmail = await fetchLatestOpens(campaignIds)

    const classified = members.map((member) => ({
        ...member,
        engagementTier: classifyEngagement(
            {
                lastOpenAt: opensByEmail.get(member.email)?.lastOpenAt ?? null,
                lastRealOpenAt:
                    opensByEmail.get(member.email)?.lastRealOpenAt ?? null,
                hasClicked: member.hasClicked,
                optedInAt: member.optedInAt,
            },
            now
        ),
    }))

    // Once cohorts have started migrating, the plan is fixed: addresses
    // without a cohort yet go to the sweep cohort instead of reshuffling
    // everyone.
    const isStarted = await hasMigrationStarted(d1)
    const rampCohorts = assignCohorts(classified)
    const snapshotMembers: SnapshotMember[] = classified.map((member) => ({
        email: member.email,
        dataInsights: member.dataInsights,
        articles: member.articles,
        engagementTier: member.engagementTier,
        cohort: !isStarted
            ? (rampCohorts.get(member.email) ?? null)
            : member.engagementTier === UNENGAGED_TIER
              ? null
              : SWEEP_COHORT,
    }))

    console.log(`Snapshot taken isStarted=${isStarted}`)
    console.table(
        _.mapValues(
            _.groupBy(snapshotMembers, (member) => member.engagementTier),
            (tierMembers) => ({
                members: tierMembers.length,
                dataInsights: tierMembers.filter((m) => m.dataInsights).length,
                articles: tierMembers.filter((m) => m.articles).length,
            })
        )
    )
    if (!isStarted)
        console.table(
            _.countBy(snapshotMembers, (member) => member.cohort ?? "held back")
        )
    if (dryRun) return

    if (!isStarted)
        await d1.batch([{ sql: "DELETE FROM mailchimp_migration_members" }])
    for (const chunk of _.chunk(snapshotMembers, CHUNK_SIZE)) {
        await batchWithRetry(d1, [
            {
                sql: `INSERT INTO mailchimp_migration_members
                          (email, dataInsights, articles, engagementTier,
                           cohort)
                      SELECT value ->> '$.email',
                          value ->> '$.dataInsights',
                          value ->> '$.articles',
                          value ->> '$.engagementTier',
                          value ->> '$.cohort'
                      FROM json_each(?1)
                      -- SQLite needs a WHERE before ON CONFLICT in
                      -- INSERT ... SELECT.
                      WHERE true
                      -- A skipped address that is on the newsletters again
                      -- (it rejoined Mailchimp, say) is planned again, in
                      -- this snapshot's cohort: its old one has already
                      -- run. Migrating rechecks why it was skipped, so one
                      -- that's still unsubscribed or suppressed is skipped
                      -- again.
                      ON CONFLICT (email) DO UPDATE SET
                          dataInsights = excluded.dataInsights,
                          articles = excluded.articles,
                          engagementTier = excluded.engagementTier,
                          cohort = CASE
                              WHEN mailchimp_migration_members.status = 'skipped'
                                  THEN excluded.cohort
                              ELSE COALESCE(
                                  mailchimp_migration_members.cohort,
                                  excluded.cohort
                              )
                          END,
                          status = 'planned',
                          skipReason = NULL,
                          updatedAt = ${SQL_NOW}
                      WHERE mailchimp_migration_members.status
                          IN ('planned', 'skipped')`,
                params: [JSON.stringify(chunk)],
            },
        ])
    }
    console.log(`Snapshot stored memberCount=${snapshotMembers.length}`)
}

// --- migrate ---

interface CohortRow {
    email: string
    status: "planned" | "migrated"
    dataInsights: number
    articles: number
}

interface UserStateRow {
    email: string
    emailNotificationsStatus: string | null
    topicTags: string | null
    contentTypes: string | null
    frequency: string | null
    isSuppressed: number
}

async function fetchUserStates(
    d1: D1Client,
    emails: string[]
): Promise<Map<string, NotificationsUserState>> {
    const states = new Map<string, NotificationsUserState>()
    for (const chunk of _.chunk(emails, CHUNK_SIZE)) {
        const rows = await queryWithRetry<UserStateRow>(
            d1,
            `SELECT users.email, users.emailNotificationsStatus,
                    notification_preferences.topicTags,
                    notification_preferences.contentTypes,
                    notification_preferences.frequency,
                    EXISTS (
                        SELECT 1
                        FROM postmark_suppressions
                        WHERE postmark_suppressions.email = users.email
                            AND postmark_suppressions.messageStream = 'broadcast'
                            AND postmark_suppressions.isSuppressed = 1
                    ) AS isSuppressed
             FROM users
             LEFT JOIN notification_preferences
                 ON notification_preferences.userId = users.id
             WHERE users.email IN (SELECT value FROM json_each(?1))`,
            [JSON.stringify(chunk)]
        )
        for (const row of rows) {
            states.set(row.email, {
                isSubscribed: row.emailNotificationsStatus === "subscribed",
                preferences:
                    row.topicTags && row.contentTypes && row.frequency
                        ? ({
                              topicTags: JSON.parse(row.topicTags),
                              contentTypes: JSON.parse(row.contentTypes),
                              frequency: row.frequency,
                          } as EmailNotificationsPreferences)
                        : null,
                isSuppressedInPostmark: row.isSuppressed === 1,
            })
        }
    }
    return states
}

type PlannedMigration = Extract<MigrationPlan, { action: "migrate" }> & {
    email: string
}

/**
 * Subscribe a chunk of addresses to email notifications and record it, all
 * or nothing. Rerunning it changes nothing.
 */
async function subscribeToNotifications(
    d1: D1Client,
    chunk: PlannedMigration[],
    latestChecks: { dataInsights: Date; articles: Date },
    now: Date
): Promise<void> {
    const rows = JSON.stringify(
        chunk.map((plan) => ({
            email: plan.email,
            token: crypto.randomUUID(),
            topicTags: JSON.stringify(plan.preferences.topicTags),
            contentTypes: JSON.stringify(plan.preferences.contentTypes),
            frequency: plan.preferences.frequency,
            lastSentAt: getCutoverTime(
                plan.newsletters,
                latestChecks
            ).toISOString(),
            dataInsights: plan.newsletters.dataInsights,
            articles: plan.newsletters.articles,
            previousPreferences:
                plan.previousPreferences &&
                JSON.stringify(plan.previousPreferences),
        }))
    )
    await batchWithRetry(d1, [
        {
            // Mailchimp already welcomed these subscribers, so a later form
            // signup sends the short confirmation, not the full welcome. That
            // stays true after a rollback, so the rollback leaves it set.
            sql: `INSERT INTO users
                      (email, token, emailNotificationsStatus,
                          welcomeEmailSentAt)
                  SELECT value ->> '$.email',
                      value ->> '$.token', 'subscribed', ${SQL_NOW}
                  FROM json_each(?1)
                  WHERE true
                  ON CONFLICT (email) DO UPDATE SET
                      emailNotificationsStatus = 'subscribed',
                      welcomeEmailSentAt = COALESCE(
                          users.welcomeEmailSentAt,
                          excluded.welcomeEmailSentAt
                      ),
                      updatedAt = ${SQL_NOW}`,
            params: [rows],
        },
        {
            // An address that already gets notifications keeps its window, so
            // it doesn't miss content it was about to get.
            sql: `INSERT INTO notification_preferences
                      (userId, topicTags, contentTypes, frequency, lastSentAt)
                  SELECT users.id, value ->> '$.topicTags',
                      value ->> '$.contentTypes',
                      value ->> '$.frequency',
                      value ->> '$.lastSentAt'
                  FROM json_each(?1)
                  JOIN users ON users.email = value ->> '$.email'
                  WHERE true
                  ON CONFLICT (userId) DO UPDATE SET
                      topicTags = excluded.topicTags,
                      contentTypes = excluded.contentTypes,
                      frequency = excluded.frequency,
                      lastSentAt = COALESCE(
                          notification_preferences.lastSentAt,
                          excluded.lastSentAt
                      ),
                      updatedAt = ${SQL_NOW}`,
            params: [rows],
        },
        {
            sql: `UPDATE mailchimp_migration_members
                  SET status = 'migrated',
                      migratedAt = ?2,
                      dataInsights = value ->> '$.dataInsights',
                      articles = value ->> '$.articles',
                      previousPreferences =
                          value ->> '$.previousPreferences',
                      updatedAt = ${SQL_NOW}
                  FROM json_each(?1)
                  WHERE mailchimp_migration_members.email =
                          value ->> '$.email'
                      AND mailchimp_migration_members.status = 'planned'`,
            params: [rows, now.toISOString()],
        },
    ])
}

/**
 * Turn the newsletters off in Mailchimp for addresses that now get email
 * notifications. Returns how many Mailchimp didn't update; those keep
 * getting both until the cohort is rerun.
 */
async function turnOffMailchimpNewsletters(
    d1: D1Client,
    members: ({ email: string } & MailchimpNewsletters)[],
    local: boolean
): Promise<number> {
    let failedCount = 0
    for (const chunk of _.chunk(members, CHUNK_SIZE)) {
        const failedEmails = await setNewsletters(chunk, false, local)
        failedCount += failedEmails.size
        const updatedEmails = chunk
            .map((member) => member.email)
            .filter((email) => !failedEmails.has(email))
        await batchWithRetry(d1, [
            {
                sql: `UPDATE mailchimp_migration_members
                      SET mailchimpUpdatedAt = ${SQL_NOW},
                          updatedAt = ${SQL_NOW}
                      WHERE email IN (SELECT value FROM json_each(?1))`,
                params: [JSON.stringify(updatedEmails)],
            },
        ])
    }
    return failedCount
}

async function markSkipped(
    d1: D1Client,
    plans: { email: string; reason: SkipReason }[]
): Promise<void> {
    for (const [reason, skipped] of Object.entries(
        _.groupBy(plans, (plan) => plan.reason)
    )) {
        for (const chunk of _.chunk(skipped, CHUNK_SIZE)) {
            await batchWithRetry(d1, [
                {
                    sql: `UPDATE mailchimp_migration_members
                          SET status = 'skipped', skipReason = ?2,
                              updatedAt = ${SQL_NOW}
                          WHERE email IN (SELECT value FROM json_each(?1))
                              AND status = 'planned'`,
                    params: [
                        JSON.stringify(chunk.map((plan) => plan.email)),
                        reason,
                    ],
                },
            ])
        }
    }
}

async function migrate(
    cohort: number,
    { dryRun, local }: Options
): Promise<void> {
    const d1 = createD1Client(local)
    const now = new Date()

    const cohortRows = await queryWithRetry<CohortRow>(
        d1,
        `SELECT email, status, dataInsights, articles
         FROM mailchimp_migration_members
         WHERE cohort = ?1
             AND (status = 'planned'
                 OR (status = 'migrated' AND mailchimpUpdatedAt IS NULL))`,
        [cohort]
    )
    if (cohortRows.length === 0) {
        console.log(`Nothing left to migrate cohort=${cohort}`)
        return
    }
    const [plannedRows, unfinishedRows] = _.partition(
        cohortRows,
        (row) => row.status === "planned"
    )

    // The snapshot may be days old: decide from who is on the newsletters
    // and who uses email notifications right now.
    const mailchimpMembers = _.keyBy(
        await fetchSubscribedMembers(),
        (member) => member.email
    )
    const userStates = await fetchUserStates(
        d1,
        plannedRows.map((row) => row.email)
    )
    const plans = plannedRows.map((row) => ({
        email: row.email,
        ...planMigration(
            mailchimpMembers[row.email],
            userStates.get(row.email)
        ),
    }))
    const toMigrate = plans.filter(
        (plan): plan is PlannedMigration => plan.action === "migrate"
    )
    const toSkip = plans.filter((plan) => plan.action === "skip")

    const schedule = await fetchRssSchedule()
    const latestChecks = _.mapValues(schedule.hours, (hour) =>
        getLatestDailyCheck(now, hour, schedule.timeZone)
    )

    console.log(
        `Cohort planned cohort=${cohort} migrateCount=${toMigrate.length} alreadyUsingNotificationsCount=${toMigrate.filter((plan) => plan.previousPreferences).length} unfinishedMailchimpCount=${unfinishedRows.length} skipCounts=${JSON.stringify(_.countBy(toSkip, (plan) => plan.reason))} contentSince=${JSON.stringify(_.mapValues(latestChecks, (check) => check.toISOString()))}`
    )
    if (dryRun) return

    await markSkipped(d1, toSkip)

    // Deliberate ordering: subscribe first, turn Mailchimp off after. A
    // crash between the two leaves addresses on both until the rerun — a
    // duplicate email is preferable to the reverse order, where they would
    // get nothing.
    let migratedCount = 0
    let skippedCount = toSkip.length
    let mailchimpFailedCount = 0
    for (const chunk of _.chunk(toMigrate, CHUNK_SIZE)) {
        // A large cohort takes minutes, so plan each chunk again from fresh
        // states: an address that unsubscribed from email notifications or
        // got suppressed in the meantime is skipped, not subscribed again.
        const chunkStates = await fetchUserStates(
            d1,
            chunk.map((plan) => plan.email)
        )
        const chunkPlans = chunk.map((plan) => ({
            email: plan.email,
            ...planMigration(
                mailchimpMembers[plan.email],
                chunkStates.get(plan.email)
            ),
        }))
        const chunkToMigrate = chunkPlans.filter(
            (plan): plan is PlannedMigration => plan.action === "migrate"
        )
        const chunkToSkip = chunkPlans.filter((plan) => plan.action === "skip")
        await markSkipped(d1, chunkToSkip)
        skippedCount += chunkToSkip.length
        if (chunkToMigrate.length === 0) continue

        await subscribeToNotifications(d1, chunkToMigrate, latestChecks, now)
        migratedCount += chunkToMigrate.length
        mailchimpFailedCount += await turnOffMailchimpNewsletters(
            d1,
            chunkToMigrate.map((plan) => ({
                email: plan.email,
                ...plan.newsletters,
            })),
            local
        )
    }
    mailchimpFailedCount += await turnOffMailchimpNewsletters(
        d1,
        unfinishedRows.map((row) => ({
            email: row.email,
            dataInsights: row.dataInsights === 1,
            articles: row.articles === 1,
        })),
        local
    )

    console.log(
        `Cohort migrated cohort=${cohort} migratedCount=${migratedCount} skippedCount=${skippedCount}`
    )
    if (mailchimpFailedCount > 0)
        throw new Error(
            `Mailchimp didn't update ${mailchimpFailedCount} address(es), which now get both emails; rerun the cohort to retry`
        )
}

// --- rollback ---

interface RollbackRow {
    email: string
    dataInsights: number
    articles: number
    previousPreferences: string | null
    emailNotificationsStatus: string | null
    isSuppressed: number
}

// Whoever unsubscribed since migrating has opted out, and whoever Postmark
// suppressed since (a hard bounce or a spam complaint) shouldn't be emailed
// again, so neither is put back on the Mailchimp newsletters.
function rollbackSkipReason(row: RollbackRow): SkipReason | undefined {
    if (row.emailNotificationsStatus !== "subscribed")
        return "unsubscribed-from-notifications"
    if (row.isSuppressed === 1) return "suppressed-in-postmark"
    return undefined
}

async function rollback(
    cohort: number,
    { dryRun, local }: Options
): Promise<void> {
    const d1 = createD1Client(local)
    const rows = await queryWithRetry<RollbackRow>(
        d1,
        `SELECT mailchimp_migration_members.email,
                mailchimp_migration_members.dataInsights,
                mailchimp_migration_members.articles,
                mailchimp_migration_members.previousPreferences,
                users.emailNotificationsStatus,
                EXISTS (
                    SELECT 1
                    FROM postmark_suppressions
                    WHERE postmark_suppressions.email = mailchimp_migration_members.email
                        AND postmark_suppressions.messageStream = 'broadcast'
                        AND postmark_suppressions.isSuppressed = 1
                ) AS isSuppressed
         FROM mailchimp_migration_members
         LEFT JOIN users ON users.email = mailchimp_migration_members.email
         WHERE mailchimp_migration_members.cohort = ?1
             AND mailchimp_migration_members.status = 'migrated'`,
        [cohort]
    )
    const [toRestore, toSkip] = _.partition(
        rows,
        (row) => rollbackSkipReason(row) === undefined
    )
    const skipCounts = _.countBy(toSkip, rollbackSkipReason)
    console.log(
        `Rollback planned cohort=${cohort} restoreCount=${toRestore.length} skipCounts=${JSON.stringify(skipCounts)}`
    )
    if (dryRun) return

    for (const [reason, skipped] of Object.entries(
        _.groupBy(toSkip, rollbackSkipReason)
    )) {
        for (const chunk of _.chunk(skipped, CHUNK_SIZE)) {
            await batchWithRetry(d1, [
                {
                    sql: `UPDATE mailchimp_migration_members
                          SET status = 'skipped', skipReason = ?2,
                              updatedAt = ${SQL_NOW}
                          WHERE email IN (SELECT value FROM json_each(?1))`,
                    params: [
                        JSON.stringify(chunk.map((row) => row.email)),
                        reason,
                    ],
                },
            ])
        }
    }

    // Deliberate ordering, as when migrating: Mailchimp back on first, so a
    // crash leaves addresses on both rather than on neither.
    let mailchimpFailedCount = 0
    for (const chunk of _.chunk(toRestore, CHUNK_SIZE)) {
        const failedEmails = await setNewsletters(
            chunk.map((row) => ({
                email: row.email,
                dataInsights: row.dataInsights === 1,
                articles: row.articles === 1,
            })),
            true,
            local
        )
        mailchimpFailedCount += failedEmails.size
        const restored = JSON.stringify(
            chunk
                .filter((row) => !failedEmails.has(row.email))
                .map((row) => ({
                    email: row.email,
                    previousPreferences: row.previousPreferences,
                }))
        )
        await batchWithRetry(d1, [
            {
                // The migration created these subscriptions. Without
                // preferences the address is a plain identity again, which
                // a later migration treats as new.
                sql: `DELETE FROM notification_preferences
                      WHERE userId IN (
                          SELECT users.id
                          FROM json_each(?1)
                          JOIN users
                              ON users.email = value ->> '$.email'
                          WHERE value ->> '$.previousPreferences'
                              IS NULL
                      )`,
                params: [restored],
            },
            {
                sql: `UPDATE users
                      SET emailNotificationsStatus = 'unsubscribed',
                          updatedAt = ${SQL_NOW}
                      WHERE email IN (
                          SELECT value ->> '$.email'
                          FROM json_each(?1)
                          WHERE value ->> '$.previousPreferences'
                              IS NULL
                      )`,
                params: [restored],
            },
            {
                // These already used email notifications: back to the
                // preferences they had.
                sql: `UPDATE notification_preferences
                      SET topicTags = value ->> '$.previousPreferences' ->> '$.topicTags',
                          contentTypes = value ->> '$.previousPreferences' ->> '$.contentTypes',
                          frequency = value ->> '$.previousPreferences' ->> '$.frequency',
                          updatedAt = ${SQL_NOW}
                      FROM json_each(?1)
                      JOIN users
                          ON users.email = value ->> '$.email'
                      WHERE notification_preferences.userId = users.id
                          AND value ->> '$.previousPreferences'
                              IS NOT NULL`,
                params: [restored],
            },
            {
                sql: `UPDATE mailchimp_migration_members
                      SET status = 'planned', migratedAt = NULL,
                          mailchimpUpdatedAt = NULL,
                          previousPreferences = NULL,
                          rolledBackAt = ${SQL_NOW},
                          updatedAt = ${SQL_NOW}
                      WHERE email IN (
                          SELECT value ->> '$.email'
                          FROM json_each(?1)
                      )`,
                params: [restored],
            },
        ])
    }

    console.log(
        `Cohort rolled back cohort=${cohort} restoredCount=${toRestore.length - mailchimpFailedCount}`
    )
    if (mailchimpFailedCount > 0)
        throw new Error(
            `Mailchimp didn't update ${mailchimpFailedCount} address(es), which still get email notifications; rerun the rollback to retry`
        )
}

// --- status ---

async function status({ local }: Options): Promise<void> {
    const d1 = createD1Client(local)
    const cohorts = await queryWithRetry<Record<string, number | null>>(
        d1,
        `SELECT mailchimp_migration_members.cohort,
                COUNT(*) AS members,
                SUM(status = 'planned') AS planned,
                SUM(status = 'migrated') AS migrated,
                SUM(status = 'skipped') AS skipped,
                SUM(status = 'migrated' AND mailchimpUpdatedAt IS NULL)
                    AS stillOnMailchimp,
                SUM(status = 'migrated'
                    AND users.emailNotificationsStatus = 'unsubscribed')
                    AS unsubscribedSince,
                SUM(status = 'migrated' AND EXISTS (
                    SELECT 1
                    FROM postmark_suppressions
                    WHERE postmark_suppressions.email = users.email
                        AND postmark_suppressions.messageStream = 'broadcast'
                        AND postmark_suppressions.isSuppressed = 1
                )) AS suppressedSince
         FROM mailchimp_migration_members
         LEFT JOIN users ON users.email = mailchimp_migration_members.email
         GROUP BY mailchimp_migration_members.cohort
         ORDER BY mailchimp_migration_members.cohort IS NULL,
             mailchimp_migration_members.cohort`
    )
    console.table(
        cohorts.map((row) => ({ ...row, cohort: row.cohort ?? "held back" }))
    )

    if (!POSTMARK_SERVER_TOKEN) {
        console.log("POSTMARK_SERVER_TOKEN is not set; skipping its statistics")
        return
    }
    const { protocol, host } = new URL(POSTMARK_API_BASE_URL)
    const postmark = new ServerClient(
        POSTMARK_SERVER_TOKEN,
        new Models.ClientOptions.Configuration(protocol === "https:", host)
    )
    const toDate = new Date()
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const overview = await postmark.getOutboundOverview({
        messageStream: "broadcast",
        fromDate: fromDate.toISOString().slice(0, 10),
        toDate: toDate.toISOString().slice(0, 10),
    })
    console.log("Postmark broadcast stream, last 7 days:")
    console.table(
        _.pick(overview, [
            "Sent",
            "Bounced",
            "BounceRate",
            "SpamComplaints",
            "SpamComplaintsRate",
            "UniqueOpens",
        ])
    )
}

// --- CLI ---

async function run(command: () => Promise<void>): Promise<void> {
    try {
        await command()
        process.exit(0)
    } catch (error) {
        console.error(
            `Mailchimp migration failed error=${JSON.stringify(error instanceof Error ? error.message : String(error))}`
        )
        process.exit(1)
    }
}

const cohortPositional = {
    type: "number",
    demandOption: true,
    describe: "The cohort number, as listed by the status command",
} as const

void yargs(hideBin(process.argv))
    .option("dry-run", {
        type: "boolean",
        default: false,
        describe: "Report what would happen without writing anywhere",
    })
    .option("local", {
        type: "boolean",
        default: false,
        describe:
            "Use the local wrangler D1 database instead of the remote one",
    })
    .command(
        "snapshot",
        "Record the newsletter subscribers and split them into cohorts",
        (yargs) =>
            yargs.option("engagement-days", {
                type: "number",
                default: ENGAGEMENT_WINDOW_MS / (24 * 60 * 60 * 1000),
                describe:
                    "How far back to look for opens. Fetching a year takes over an hour; a shorter window is only for trying the command out, since it makes more addresses look unengaged",
            }),
        (argv) => run(() => snapshot(argv))
    )
    .command(
        "migrate <cohort>",
        "Move a cohort from the Mailchimp newsletters to email notifications",
        (yargs) => yargs.positional("cohort", cohortPositional),
        (argv) => run(() => migrate(argv.cohort, argv))
    )
    .command(
        "rollback <cohort>",
        "Put a migrated cohort back on the Mailchimp newsletters",
        (yargs) => yargs.positional("cohort", cohortPositional),
        (argv) => run(() => rollback(argv.cohort, argv))
    )
    .command(
        "status",
        "Show the progress per cohort and Postmark's delivery statistics",
        (yargs) => yargs,
        (argv) => run(() => status(argv))
    )
    .demandCommand(1)
    .help()
    .alias("help", "h")
    .strict().argv
