import { expect, it, describe } from "vitest"
import { OwidGdocType } from "@ourworldindata/types"
import {
    EmailNotificationsSubscriber,
    NotificationEmailItem,
    filterItemsForSubscriber,
    getWindowStart,
    parseSubscriberRow,
} from "./emailNotificationsUtils.js"

const NOW = new Date("2026-07-01T06:00:00Z")

const makeSubscriber = (
    overrides: Partial<EmailNotificationsSubscriber> = {}
): EmailNotificationsSubscriber => ({
    userId: 1,
    email: "user@example.com",
    token: "token",
    topicTags: [],
    contentTypes: [
        OwidGdocType.Article,
        OwidGdocType.DataInsight,
        OwidGdocType.Announcement,
    ],
    frequency: "weekly",
    lastSentAt: null,
    ...overrides,
})

const makeItem = (
    overrides: Partial<NotificationEmailItem> = {}
): NotificationEmailItem => ({
    type: OwidGdocType.Article,
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
                user_id: 7,
                email: "user@example.com",
                token: "token",
                topic_tags: '["Health"]',
                content_types: '["article"]',
                frequency: "daily",
                last_sent_at: "2026-06-30T06:00:00.000Z",
            })
        ).toEqual({
            userId: 7,
            email: "user@example.com",
            token: "token",
            topicTags: ["Health"],
            contentTypes: [OwidGdocType.Article],
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
            contentTypes: [OwidGdocType.DataInsight],
        })
        expect(filterItemsForSubscriber([makeItem()], subscriber, NOW)).toEqual(
            []
        )
        expect(
            filterItemsForSubscriber(
                [makeItem({ type: OwidGdocType.DataInsight })],
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

    it("treats an empty topic list as all topics", () => {
        const item = makeItem({ topicNames: [] })
        expect(filterItemsForSubscriber([item], makeSubscriber(), NOW)).toEqual(
            [item]
        )
    })
})
