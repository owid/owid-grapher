import { expect, it, describe } from "vitest"
import {
    EmailNotificationsSubscriber,
    areWebhooksMissing,
    NotificationEmailItem,
    fillPostmarkTemplate,
    filterItemsForSubscriber,
    formatItemDate,
    getWindowStart,
    groupSubscribersByItems,
    parseSubscriberRow,
} from "./emailNotificationsUtils.js"

const NOW = new Date("2026-07-01T06:00:00Z")

const makeSubscriber = (
    overrides: Partial<EmailNotificationsSubscriber> = {}
): EmailNotificationsSubscriber => ({
    userId: 1,
    email: "user@example.com",
    token: "token",
    topicTags: ["Health"],
    contentTypes: ["article", "data-insight", "data-update", "announcement"],
    frequency: "weekly",
    lastSentAt: null,
    ...overrides,
})

const makeItem = (
    overrides: Partial<NotificationEmailItem> = {}
): NotificationEmailItem => ({
    type: "article",
    latestType: "article",
    slug: "test-article",
    title: "Test article",
    url: "https://ourworldindata.org/test-article",
    publishedAt: new Date("2026-06-30T12:00:00Z"),
    topicNames: ["Vaccination", "Health"],
    authors: [],
    ...overrides,
})

describe(parseSubscriberRow, () => {
    it("parses a D1 row into a subscriber", () => {
        expect(
            parseSubscriberRow({
                userId: 7,
                email: "user@example.com",
                token: "token",
                topicTags: '["Health"]',
                contentTypes: '["article", "data-update"]',
                frequency: "daily",
                lastSentAt: "2026-06-30T06:00:00.000Z",
            })
        ).toEqual({
            userId: 7,
            email: "user@example.com",
            token: "token",
            topicTags: ["Health"],
            contentTypes: ["article", "data-update"],
            frequency: "daily",
            lastSentAt: new Date("2026-06-30T06:00:00.000Z"),
        })
    })
})

describe(getWindowStart, () => {
    it("uses the last sent date when available", () => {
        const lastSentAt = new Date("2026-06-20T06:00:00Z")
        expect(getWindowStart(makeSubscriber({ lastSentAt }), NOW)).toEqual(
            lastSentAt
        )
    })

    it("falls back to one frequency interval before now", () => {
        expect(
            getWindowStart(makeSubscriber({ frequency: "daily" }), NOW)
        ).toEqual(new Date("2026-06-30T06:00:00Z"))
        expect(
            getWindowStart(makeSubscriber({ frequency: "weekly" }), NOW)
        ).toEqual(new Date("2026-06-24T06:00:00Z"))
    })
})

describe(filterItemsForSubscriber, () => {
    it("includes items published since the last sent email", () => {
        const subscriber = makeSubscriber({
            lastSentAt: new Date("2026-06-24T06:00:00Z"),
        })
        const newItem = makeItem()
        const oldItem = makeItem({
            publishedAt: new Date("2026-06-20T12:00:00Z"),
        })
        expect(
            filterItemsForSubscriber([newItem, oldItem], subscriber, NOW)
        ).toEqual([newItem])
    })

    it("excludes items outside the subscribed content types", () => {
        const subscriber = makeSubscriber({
            contentTypes: ["data-insight"],
        })
        expect(filterItemsForSubscriber([makeItem()], subscriber, NOW)).toEqual(
            []
        )
        expect(
            filterItemsForSubscriber(
                [makeItem({ type: "data-insight" })],
                subscriber,
                NOW
            )
        ).toHaveLength(1)
    })

    it("matches subscribed topics against any of the item's topic names", () => {
        const item = makeItem({ topicNames: ["Vaccination", "Health"] })
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: ["Health"] }),
                NOW
            )
        ).toEqual([item])
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: ["Energy and Environment"] }),
                NOW
            )
        ).toEqual([])
    })

    it("filters data updates by topic like other tagged content", () => {
        const item = makeItem({
            type: "data-update",
            topicNames: ["Energy and Environment"],
        })
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: ["Health"] }),
                NOW
            )
        ).toEqual([])
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: ["Energy and Environment"] }),
                NOW
            )
        ).toEqual([item])
    })

    it("treats empty topic tags as a subscription to all topics", () => {
        const item = makeItem({ topicNames: ["Vaccination", "Health"] })
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: [] }),
                NOW
            )
        ).toEqual([item])
    })

    it("does not topic-filter announcements", () => {
        const item = makeItem({ type: "announcement", topicNames: [] })
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: ["Health"] }),
                NOW
            )
        ).toEqual([item])
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({
                    topicTags: ["Health"],
                    contentTypes: ["article"],
                }),
                NOW
            )
        ).toEqual([])
    })

    it("excludes tagged items when none of the subscriber's topics match", () => {
        const item = makeItem({ topicNames: [] })
        expect(
            filterItemsForSubscriber(
                [item],
                makeSubscriber({ topicTags: ["Health"] }),
                NOW
            )
        ).toEqual([])
    })
})

describe(formatItemDate, () => {
    it("formats a date in the send year without the year", () => {
        expect(
            formatItemDate(
                new Date("2026-08-03T09:00:00Z"),
                new Date("2026-08-07T06:00:00Z")
            )
        ).toBe("August 3")
    })

    it("includes the year for content from a previous year", () => {
        expect(
            formatItemDate(
                new Date("2025-12-28T09:00:00Z"),
                new Date("2026-01-04T06:00:00Z")
            )
        ).toBe("December 28, 2025")
    })
})

describe(groupSubscribersByItems, () => {
    const article = makeItem({ slug: "article" })
    const dataInsight = makeItem({ slug: "data-insight", type: "data-insight" })

    it("puts subscribers who get the same items into one group", () => {
        const allTypes = makeSubscriber({ userId: 1 })
        const sameAsFirst = makeSubscriber({ userId: 2 })
        const insightsOnly = makeSubscriber({
            userId: 3,
            contentTypes: ["data-insight"],
        })

        const groups = groupSubscribersByItems(
            [article, dataInsight],
            [allTypes, insightsOnly, sameAsFirst],
            NOW
        )

        expect(groups).toEqual([
            {
                items: [article, dataInsight],
                subscribers: [allTypes, sameAsFirst],
            },
            { items: [dataInsight], subscribers: [insightsOnly] },
        ])
    })

    it("separates subscribers whose send windows differ", () => {
        // A subscriber who was last sent an email after the article was
        // published only gets the newer data insight.
        const olderArticle = makeItem({
            slug: "older-article",
            publishedAt: new Date("2026-06-26T12:00:00Z"),
        })
        const neverSent = makeSubscriber({ userId: 1 })
        const recentlySent = makeSubscriber({
            userId: 2,
            lastSentAt: new Date("2026-06-28T06:00:00Z"),
        })

        const groups = groupSubscribersByItems(
            [olderArticle, dataInsight],
            [neverSent, recentlySent],
            NOW
        )

        expect(groups).toEqual([
            { items: [olderArticle, dataInsight], subscribers: [neverSent] },
            { items: [dataInsight], subscribers: [recentlySent] },
        ])
    })

    it("leaves out subscribers without new items", () => {
        const groups = groupSubscribersByItems(
            [article],
            [makeSubscriber({ contentTypes: ["data-insight"] })],
            NOW
        )
        expect(groups).toEqual([])
    })
})

describe(fillPostmarkTemplate, () => {
    it("HTML-escapes double-brace values and inserts triple-brace values raw", () => {
        expect(
            fillPostmarkTemplate("<p>{{email}}</p> {{{email}}} {{ missing }}", {
                email: "o'brien&co@example.com",
            })
        ).toBe("<p>o&#39;brien&amp;co@example.com</p> o'brien&co@example.com ")
    })
})

describe(areWebhooksMissing, () => {
    const lastSentAt = new Date("2026-07-01T06:00:00Z")
    const twoHoursLater = new Date("2026-07-01T08:00:00Z")

    it("reports when no webhook arrived since a send that's over an hour old", () => {
        expect(
            areWebhooksMissing({
                lastSentAt,
                lastWebhookAt: new Date("2026-06-30T06:05:00Z"),
                now: twoHoursLater,
            })
        ).toBe(true)
        expect(
            areWebhooksMissing({
                lastSentAt,
                lastWebhookAt: null,
                now: twoHoursLater,
            })
        ).toBe(true)
    })

    it("doesn't report when a webhook arrived after the last send", () => {
        expect(
            areWebhooksMissing({
                lastSentAt,
                lastWebhookAt: new Date("2026-07-01T06:05:00Z"),
                now: twoHoursLater,
            })
        ).toBe(false)
    })

    it("gives webhooks for a recent send time to arrive", () => {
        expect(
            areWebhooksMissing({
                lastSentAt,
                lastWebhookAt: null,
                now: new Date("2026-07-01T06:30:00Z"),
            })
        ).toBe(false)
    })

    it("doesn't report before anything was sent", () => {
        expect(
            areWebhooksMissing({
                lastSentAt: null,
                lastWebhookAt: null,
                now: twoHoursLater,
            })
        ).toBe(false)
    })
})
