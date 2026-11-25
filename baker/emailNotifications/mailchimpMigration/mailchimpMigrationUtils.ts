import { createHash } from "crypto"
import {
    EmailNotificationsContentType,
    EmailNotificationsPreferences,
    mergeEmailNotificationsPreferences,
} from "@ourworldindata/types"
import * as _ from "lodash-es"

const DAY_MS = 24 * 60 * 60 * 1000

/** The two Mailchimp RSS newsletters an address can be subscribed to. */
export interface MailchimpNewsletters {
    dataInsights: boolean
    articles: boolean
}

// --- Engagement ---

/**
 * 1: opened (not just via a mail privacy proxy) in the last 90 days and has
 *    clicked at some point
 * 2: opened in the last 90 days
 * 3: opened in the last year, or too new to judge
 * 4: unengaged
 */
export type EngagementTier = 1 | 2 | 3 | 4

/** Addresses in this tier are held back from the migration. */
export const UNENGAGED_TIER: EngagementTier = 4

const RECENT_MS = 90 * DAY_MS
export const ENGAGEMENT_WINDOW_MS = 365 * DAY_MS

export interface MailchimpEngagement {
    /** Latest open of any campaign in the engagement window. */
    lastOpenAt: Date | null
    /**
     * Latest open that wasn't a mail privacy proxy (e.g. Apple Mail)
     * fetching the email on its own.
     */
    lastRealOpenAt: Date | null
    /** Whether the address has ever clicked a link in a campaign. */
    hasClicked: boolean
    optedInAt: Date | null
}

export function classifyEngagement(
    engagement: MailchimpEngagement,
    now: Date
): EngagementTier {
    const isWithin = (date: Date | null, ms: number): boolean =>
        date !== null && now.getTime() - date.getTime() <= ms
    if (isWithin(engagement.lastRealOpenAt, RECENT_MS) && engagement.hasClicked)
        return 1
    if (isWithin(engagement.lastOpenAt, RECENT_MS)) return 2
    if (isWithin(engagement.lastOpenAt, ENGAGEMENT_WINDOW_MS)) return 3
    // New subscribers have received too few emails to count as unengaged.
    if (isWithin(engagement.optedInAt, RECENT_MS)) return 3
    return 4
}

// --- Cohorts ---

/**
 * Cumulative share of the engaged addresses that has migrated after each
 * step of the ramp: roughly doubling, so mailbox providers see the volume
 * from the new sending IPs grow gradually.
 */
export const COHORT_CUMULATIVE_SHARES = [0.02, 0.05, 0.1, 0.2, 0.4, 0.7, 1]

/**
 * The cohort of addresses that show up after the ramp was planned: new
 * Mailchimp signups and held-back addresses that became engaged.
 */
export const SWEEP_COHORT = COHORT_CUMULATIVE_SHARES.length + 1

/**
 * Split the engaged addresses into the cohorts of the ramp, most engaged
 * first. Within a tier the order is by a hash of the address, so every cohort
 * gets a representative mix of mailbox providers and the split is the same on
 * every run. Unengaged addresses get no cohort.
 */
export function assignCohorts(
    members: { email: string; engagementTier: EngagementTier }[],
    cumulativeShares: number[] = COHORT_CUMULATIVE_SHARES
): Map<string, number | null> {
    const [unengaged, engaged] = _.partition(
        members,
        (member) => member.engagementTier === UNENGAGED_TIER
    )
    const ordered = _.sortBy(engaged, [
        (member): number => member.engagementTier,
        (member): string =>
            createHash("sha256").update(member.email).digest("hex"),
    ])
    const cohorts = new Map<string, number | null>(
        unengaged.map((member) => [member.email, null])
    )
    let cohortIndex = 0
    for (const [index, member] of ordered.entries()) {
        while (
            cohortIndex < cumulativeShares.length - 1 &&
            index >= Math.round(cumulativeShares[cohortIndex] * ordered.length)
        )
            cohortIndex++
        cohorts.set(member.email, cohortIndex + 1)
    }
    return cohorts
}

// --- Cutover ---

/** The offset of a time zone from UTC at a given instant. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    }).formatToParts(date)
    const get = (type: string): number =>
        Number(parts.find((part) => part.type === type)?.value)
    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second")
    )
    return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * The latest time at or before `now` when it was `hour` o'clock in the time
 * zone: when a Mailchimp RSS campaign scheduled daily at that hour last
 * checked its feed. Everything published before it has gone out via
 * Mailchimp; nothing published after it has.
 */
export function getLatestDailyCheck(
    now: Date,
    hour: number,
    timeZone: string
): Date {
    const offsetMs = getTimeZoneOffsetMs(now, timeZone)
    const localNow = new Date(now.getTime() + offsetMs)
    const localCheck = Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate(),
        hour
    )
    for (const daysBack of [0, 1]) {
        const localCandidate = localCheck - daysBack * DAY_MS
        // The offset on the candidate's day can differ from today's around a
        // daylight saving change.
        const candidate = new Date(
            localCandidate -
                getTimeZoneOffsetMs(
                    new Date(localCandidate - offsetMs),
                    timeZone
                )
        )
        if (candidate <= now) return candidate
    }
    throw new Error("No daily check found within a day")
}

/**
 * Where a migrated address's window of new content starts: the last feed
 * check of its Mailchimp newsletters. For an address on both, the earlier of
 * the two checks — repeating an item Mailchimp already sent is better than
 * dropping one it didn't.
 */
export function getCutoverTime(
    newsletters: MailchimpNewsletters,
    latestChecks: { dataInsights: Date; articles: Date }
): Date {
    const checks = [
        ...(newsletters.dataInsights ? [latestChecks.dataInsights] : []),
        ...(newsletters.articles ? [latestChecks.articles] : []),
    ]
    if (checks.length === 0)
        throw new Error("The address is on neither newsletter")
    return new Date(Math.min(...checks.map((check) => check.getTime())))
}

// --- Planning ---

/**
 * What a Mailchimp newsletter subscription is as notification preferences:
 * every topic, the matching content type, and a daily email, which is how
 * often the RSS campaigns check their feeds.
 */
export function makeMigratedPreferences(
    newsletters: MailchimpNewsletters
): EmailNotificationsPreferences {
    const contentTypes: EmailNotificationsContentType[] = [
        ...(newsletters.dataInsights ? (["data-insight"] as const) : []),
        ...(newsletters.articles ? (["article"] as const) : []),
    ]
    return { topicTags: [], contentTypes, frequency: "daily" }
}

/** What Mailchimp says about an address right now. */
export interface MailchimpMemberState extends MailchimpNewsletters {
    isSubscribed: boolean
}

/** What the email notifications database says about an address. */
export interface NotificationsUserState {
    isSubscribed: boolean
    /** null when the address has never set notification preferences. */
    preferences: EmailNotificationsPreferences | null
    isSuppressedInPostmark: boolean
}

export const SKIP_REASONS = [
    // Unsubscribed, bounced or removed in Mailchimp since the snapshot, or
    // turned both newsletters off.
    "left-mailchimp",
    // Turned email notifications off after having used them.
    "unsubscribed-from-notifications",
    // Postmark doesn't deliver to the address (hard bounce, spam complaint
    // or unsubscribe).
    "suppressed-in-postmark",
] as const

export type SkipReason = (typeof SKIP_REASONS)[number]

export type MigrationPlan =
    | {
          action: "migrate"
          newsletters: MailchimpNewsletters
          preferences: EmailNotificationsPreferences
          /** To restore on rollback; null when there were none. */
          previousPreferences: EmailNotificationsPreferences | null
      }
    | { action: "skip"; reason: SkipReason }

/**
 * Decide what migrating an address does, from its current state in Mailchimp
 * and in the email notifications database.
 *
 * An address that already uses email notifications keeps its frequency and
 * gets its subscription broadened by the Mailchimp newsletters, like when it
 * submits the subscribe form again. An address known to the database only as
 * an identity (e.g. an OWID Brief subscriber) is migrated like a new one. But
 * one that set preferences and then unsubscribed has opted out of
 * notifications, which the migration respects.
 */
export function planMigration(
    mailchimp: MailchimpMemberState | undefined,
    user: NotificationsUserState | undefined
): MigrationPlan {
    if (
        !mailchimp?.isSubscribed ||
        (!mailchimp.dataInsights && !mailchimp.articles)
    )
        return { action: "skip", reason: "left-mailchimp" }
    if (user?.isSuppressedInPostmark)
        return { action: "skip", reason: "suppressed-in-postmark" }
    if (user?.preferences && !user.isSubscribed)
        return { action: "skip", reason: "unsubscribed-from-notifications" }

    const newsletters = _.pick(mailchimp, ["dataInsights", "articles"])
    const migrated = makeMigratedPreferences(newsletters)
    const previousPreferences = user?.preferences ?? null
    return {
        action: "migrate",
        newsletters,
        preferences: previousPreferences
            ? {
                  ...mergeEmailNotificationsPreferences(
                      previousPreferences,
                      migrated
                  ),
                  frequency: previousPreferences.frequency,
              }
            : migrated,
        previousPreferences,
    }
}
