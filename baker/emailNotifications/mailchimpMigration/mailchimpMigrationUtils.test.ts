/**
 * The decisions behind moving Mailchimp newsletter subscribers to email
 * notifications: who migrates when (engagement tiers and cohorts), what an
 * address ends up subscribed to, and where its window of new content starts
 * so the handover from Mailchimp neither drops nor repeats content.
 */
import { describe, expect, it } from "vitest"
import { EmailNotificationsPreferences } from "@ourworldindata/types"
import {
    MailchimpEngagement,
    MailchimpMemberState,
    NotificationsUserState,
    assignCohorts,
    classifyEngagement,
    getCutoverTime,
    getLatestDailyCheck,
    planMigration,
} from "./mailchimpMigrationUtils.js"

const NOW = new Date("2026-12-01T12:00:00Z")
const daysAgo = (days: number): Date =>
    new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

describe(classifyEngagement, () => {
    const makeEngagement = (
        overrides: Partial<MailchimpEngagement>
    ): MailchimpEngagement => ({
        lastOpenAt: null,
        lastRealOpenAt: null,
        hasClicked: false,
        optedInAt: daysAgo(1000),
        ...overrides,
    })

    it("puts recent openers who have clicked first", () => {
        const engagement = makeEngagement({
            lastOpenAt: daysAgo(10),
            lastRealOpenAt: daysAgo(10),
            hasClicked: true,
        })
        expect(classifyEngagement(engagement, NOW)).toBe(1)
    })

    it("doesn't count a recent open by a mail privacy proxy as the reader's own", () => {
        const engagement = makeEngagement({
            lastOpenAt: daysAgo(10),
            lastRealOpenAt: daysAgo(200),
            hasClicked: true,
        })
        expect(classifyEngagement(engagement, NOW)).toBe(2)
    })

    it("puts recent openers who never clicked second", () => {
        const engagement = makeEngagement({
            lastOpenAt: daysAgo(89),
            lastRealOpenAt: daysAgo(89),
        })
        expect(classifyEngagement(engagement, NOW)).toBe(2)
    })

    it("puts those who last opened within a year third", () => {
        const engagement = makeEngagement({ lastOpenAt: daysAgo(300) })
        expect(classifyEngagement(engagement, NOW)).toBe(3)
    })

    it("treats those without an open in a year as unengaged", () => {
        expect(classifyEngagement(makeEngagement({}), NOW)).toBe(4)
        expect(
            classifyEngagement(
                makeEngagement({ lastOpenAt: daysAgo(400), hasClicked: true }),
                NOW
            )
        ).toBe(4)
    })

    it("doesn't treat a new subscriber without opens as unengaged", () => {
        const engagement = makeEngagement({ optedInAt: daysAgo(30) })
        expect(classifyEngagement(engagement, NOW)).toBe(3)
    })
})

describe(assignCohorts, () => {
    const makeMembers = (
        count: number,
        engagementTier: 1 | 2 | 3 | 4
    ): { email: string; engagementTier: 1 | 2 | 3 | 4 }[] =>
        Array.from({ length: count }, (_, index) => ({
            email: `tier${engagementTier}-${index}@example.com`,
            engagementTier,
        }))

    const members = [
        ...makeMembers(20, 3),
        ...makeMembers(30, 1),
        ...makeMembers(7, 4),
        ...makeMembers(50, 2),
    ]

    it("sizes the cohorts by the cumulative shares of the engaged addresses", () => {
        const cohorts = assignCohorts(members, [0.1, 0.5, 1])
        const sizes = [1, 2, 3].map(
            (cohort) =>
                [...cohorts.values()].filter((value) => value === cohort).length
        )
        expect(sizes).toEqual([10, 40, 50])
    })

    it("migrates more engaged addresses before less engaged ones", () => {
        const cohorts = assignCohorts(members, [0.1, 0.5, 1])
        const cohortsOfTier = (tier: number): number[] =>
            members
                .filter((member) => member.engagementTier === tier)
                .map((member) => cohorts.get(member.email)!)
        // 30 tier-1 addresses fill cohort 1 (10) and half of cohort 2 (40).
        expect(new Set(cohortsOfTier(1))).toEqual(new Set([1, 2]))
        // The 20 tier-3 addresses are the last ones of cohort 3.
        expect(new Set(cohortsOfTier(3))).toEqual(new Set([3]))
    })

    it("holds unengaged addresses back", () => {
        const cohorts = assignCohorts(members, [0.1, 0.5, 1])
        expect(
            members
                .filter((member) => member.engagementTier === 4)
                .map((member) => cohorts.get(member.email))
        ).toEqual(Array(7).fill(null))
    })

    it("assigns the same cohorts whatever order the addresses come in", () => {
        expect(assignCohorts([...members].reverse(), [0.1, 0.5, 1])).toEqual(
            assignCohorts(members, [0.1, 0.5, 1])
        )
    })
})

describe(getLatestDailyCheck, () => {
    it("is today's check once the hour has passed", () => {
        expect(
            getLatestDailyCheck(
                new Date("2026-12-01T16:30:00Z"),
                16,
                "Europe/London"
            )
        ).toEqual(new Date("2026-12-01T16:00:00Z"))
    })

    it("is yesterday's check before the hour", () => {
        expect(
            getLatestDailyCheck(
                new Date("2026-12-01T15:59:00Z"),
                16,
                "Europe/London"
            )
        ).toEqual(new Date("2026-11-30T16:00:00Z"))
    })

    it("follows the time zone's daylight saving time", () => {
        // 16:00 in London is 15:00 UTC during British Summer Time.
        expect(
            getLatestDailyCheck(
                new Date("2026-07-01T15:30:00Z"),
                16,
                "Europe/London"
            )
        ).toEqual(new Date("2026-07-01T15:00:00Z"))
    })

    it("finds yesterday's check across a daylight saving change", () => {
        // Clocks went back on 25 October 2026: the check on the 24th was at
        // 15:00 UTC, an hour earlier than on the 25th.
        expect(
            getLatestDailyCheck(
                new Date("2026-10-25T10:00:00Z"),
                16,
                "Europe/London"
            )
        ).toEqual(new Date("2026-10-24T15:00:00Z"))
    })
})

describe(getCutoverTime, () => {
    const latestChecks = {
        dataInsights: new Date("2026-12-01T16:00:00Z"),
        articles: new Date("2026-12-01T18:00:00Z"),
    }

    it("starts at the last feed check of the address's newsletter", () => {
        expect(
            getCutoverTime(
                { dataInsights: false, articles: true },
                latestChecks
            )
        ).toEqual(latestChecks.articles)
    })

    it("starts at the earlier check for an address on both, so nothing is dropped", () => {
        expect(
            getCutoverTime({ dataInsights: true, articles: true }, latestChecks)
        ).toEqual(latestChecks.dataInsights)
    })
})

describe(planMigration, () => {
    const onDataInsights: MailchimpMemberState = {
        isSubscribed: true,
        dataInsights: true,
        articles: false,
    }
    const healthArticlesWeekly: EmailNotificationsPreferences = {
        topicTags: ["Health"],
        contentTypes: ["article"],
        frequency: "weekly",
    }
    const makeUser = (
        overrides: Partial<NotificationsUserState>
    ): NotificationsUserState => ({
        isSubscribed: true,
        preferences: null,
        isSuppressedInPostmark: false,
        ...overrides,
    })

    it("subscribes a new address to a daily email of its newsletters on all topics", () => {
        expect(
            planMigration(
                { isSubscribed: true, dataInsights: true, articles: true },
                undefined
            )
        ).toEqual({
            action: "migrate",
            newsletters: { dataInsights: true, articles: true },
            preferences: {
                topicTags: [],
                contentTypes: ["data-insight", "article"],
                frequency: "daily",
            },
            previousPreferences: null,
        })
    })

    it("migrates an address that is only an identity, like a new one", () => {
        const briefOnlyUser = makeUser({ isSubscribed: false })
        expect(planMigration(onDataInsights, briefOnlyUser)).toMatchObject({
            action: "migrate",
            preferences: { contentTypes: ["data-insight"], frequency: "daily" },
            previousPreferences: null,
        })
    })

    it("broadens an existing subscription, keeps its frequency and remembers what it was", () => {
        const user = makeUser({ preferences: healthArticlesWeekly })
        expect(planMigration(onDataInsights, user)).toEqual({
            action: "migrate",
            newsletters: { dataInsights: true, articles: false },
            preferences: {
                topicTags: [],
                contentTypes: ["article", "data-insight"],
                frequency: "weekly",
            },
            previousPreferences: healthArticlesWeekly,
        })
    })

    it("skips an address that unsubscribed from email notifications", () => {
        const user = makeUser({
            isSubscribed: false,
            preferences: healthArticlesWeekly,
        })
        expect(planMigration(onDataInsights, user)).toEqual({
            action: "skip",
            reason: "unsubscribed-from-notifications",
        })
    })

    it("skips an address Postmark doesn't deliver to", () => {
        const user = makeUser({ isSuppressedInPostmark: true })
        expect(planMigration(onDataInsights, user)).toEqual({
            action: "skip",
            reason: "suppressed-in-postmark",
        })
    })

    it.each<[string, MailchimpMemberState | undefined]>([
        ["is no longer subscribed in Mailchimp", undefined],
        [
            "turned both newsletters off",
            { isSubscribed: true, dataInsights: false, articles: false },
        ],
    ])("skips an address that %s", (_description, mailchimp) => {
        expect(planMigration(mailchimp, undefined)).toEqual({
            action: "skip",
            reason: "left-mailchimp",
        })
    })
})
