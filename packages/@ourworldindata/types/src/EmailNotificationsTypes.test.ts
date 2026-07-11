import { expect, it, describe } from "vitest"
import { EmailNotificationsSubscribeRequestTypeObject } from "./EmailNotificationsTypes.js"
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
