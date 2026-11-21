import { describe, expect, it } from "vitest"
import { EmailNotificationsSubscribeRequestTypeObject } from "@ourworldindata/types/email-notifications-schemas"

describe("EmailNotificationsSubscribeRequestTypeObject validation", () => {
    const validRequest = {
        email: "user@example.com",
        captchaToken: "test-token",
        notifications: {
            topicTags: ["Energy and Environment", "Health"],
            contentTypes: ["article", "data-insight"],
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
            captchaToken: "test-token",
            subscribeToOwidBrief: true,
        })
        expect(result.success).toBe(true)
    })

    it("accepts data updates as a content type", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                contentTypes: ["data-update"],
            },
        })
        expect(result.success).toBe(true)
    })

    it("accepts empty topic tags (meaning all topics)", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                topicTags: [],
            },
        })
        expect(result.success).toBe(true)
    })

    it("rejects a request with neither notifications nor the OWID Brief", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            email: "user@example.com",
            captchaToken: "test-token",
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

    it("rejects topic tags that aren't top-level topic areas", () => {
        const result = EmailNotificationsSubscribeRequestTypeObject.safeParse({
            ...validRequest,
            notifications: {
                ...validRequest.notifications,
                topicTags: ["Health", "Climate Change"],
            },
        })
        expect(result.success).toBe(false)
    })
})
