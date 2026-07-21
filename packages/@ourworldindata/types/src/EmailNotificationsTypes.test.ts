import { expect, it, describe } from "vitest"
import {
    EmailNotificationsPreferences,
    EmailNotificationsSubscribeRequestTypeObject,
    mergeEmailNotificationsPreferences,
} from "./EmailNotificationsTypes.js"
import { OwidGdocType } from "./gdocTypes/Gdoc.js"

describe("EmailNotificationsSubscribeRequestTypeObject validation", () => {
    const validRequest = {
        email: "user@example.com",
        notifications: {
            topicTags: ["Energy", "Climate Change"],
            contentTypes: [OwidGdocType.Article, OwidGdocType.DataInsight],
            frequency: "weekly",
        },
        subscribeToOwidBrief: true,
    }

    it("accepts a valid request", () => {
        const result =
            EmailNotificationsSubscribeRequestTypeObject.safeParse(validRequest)
        expect(result.success).toBe(true)
    })

    it("accepts a request without notifications if subscribing to the OWID Brief", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            email: "user@example.com",
            subscribeToOwidBrief: true,
        })
        expect(result.success).toBe(true)
    })

    it("accepts an empty topic tags array (means all topics)", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: { ...validRequest.notifications, topicTags: [] },
        })
        expect(result.success).toBe(true)
    })

    it("rejects a request with neither notifications nor the OWID Brief", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            email: "user@example.com",
            subscribeToOwidBrief: false,
        })
        expect(result.success).toBe(false)
    })

    it("rejects an invalid email", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            email: "not-an-email",
        })
        expect(result.success).toBe(false)
    })

    it("rejects an invalid content type", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                contentTypes: ["homepage"],
            },
        })
        expect(result.success).toBe(false)
    })

    it("rejects empty content types when notifications are configured", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                contentTypes: [],
            },
        })
        expect(result.success).toBe(false)
    })

    it("rejects an invalid frequency", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                frequency: "hourly",
            },
        })
        expect(result.success).toBe(false)
    })

    it("rejects too many topic tags", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                topicTags: Array.from({ length: 65 }, (_, i) => `Topic ${i}`),
            },
        })
        expect(result.success).toBe(false)
    })
})

describe(mergeEmailNotificationsPreferences, () => {
    const existing: EmailNotificationsPreferences = {
        topicTags: ["Energy"],
        contentTypes: [OwidGdocType.Article],
        frequency: "weekly",
    }

    it("unions topic tags and content types without duplicates", () => {
        const merged = mergeEmailNotificationsPreferences(existing, {
            topicTags: ["Energy", "Climate Change"],
            contentTypes: [OwidGdocType.Article, OwidGdocType.DataInsight],
            frequency: "weekly",
        })
        expect(merged).toEqual({
            topicTags: ["Energy", "Climate Change"],
            contentTypes: [OwidGdocType.Article, OwidGdocType.DataInsight],
            frequency: "weekly",
        })
    })

    it("treats an empty topic tags array (all topics) as winning the union", () => {
        const allTopics = mergeEmailNotificationsPreferences(existing, {
            ...existing,
            topicTags: [],
        })
        expect(allTopics.topicTags).toEqual([])

        const existingAllTopics = mergeEmailNotificationsPreferences(
            { ...existing, topicTags: [] },
            existing
        )
        expect(existingAllTopics.topicTags).toEqual([])
    })

    it("takes the incoming frequency", () => {
        expect(
            mergeEmailNotificationsPreferences(existing, {
                ...existing,
                frequency: "daily",
            }).frequency
        ).toBe("daily")
        expect(
            mergeEmailNotificationsPreferences(
                { ...existing, frequency: "daily" },
                existing
            ).frequency
        ).toBe("weekly")
    })
})
