import { expect, it, describe } from "vitest"
import {
    PostmarkSubscriptionChangeEventTypeObject,
    checkPostmarkWebhookAuthorization,
} from "./postmarkWebhook.js"

describe(checkPostmarkWebhookAuthorization, () => {
    const SECRET = "s3cret-token"
    const makeHeader = (username: string, password: string): string =>
        `Basic ${btoa(`${username}:${password}`)}`

    it("accepts the correct password with any username", () => {
        expect(
            checkPostmarkWebhookAuthorization(
                makeHeader("postmark", SECRET),
                SECRET
            )
        ).toBe(true)
        expect(
            checkPostmarkWebhookAuthorization(
                makeHeader("anything", SECRET),
                SECRET
            )
        ).toBe(true)
    })

    it("accepts a password containing a colon", () => {
        expect(
            checkPostmarkWebhookAuthorization(
                makeHeader("user", "with:colon"),
                "with:colon"
            )
        ).toBe(true)
    })

    it("rejects a wrong password", () => {
        expect(
            checkPostmarkWebhookAuthorization(
                makeHeader("postmark", "wrong"),
                SECRET
            )
        ).toBe(false)
    })

    it("rejects a missing or malformed header", () => {
        expect(checkPostmarkWebhookAuthorization(null, SECRET)).toBe(false)
        expect(checkPostmarkWebhookAuthorization("", SECRET)).toBe(false)
        expect(
            checkPostmarkWebhookAuthorization(`Bearer ${SECRET}`, SECRET)
        ).toBe(false)
        expect(
            checkPostmarkWebhookAuthorization("Basic not-base64!!!", SECRET)
        ).toBe(false)
        // Credentials without a colon separator.
        expect(
            checkPostmarkWebhookAuthorization(`Basic ${btoa(SECRET)}`, SECRET)
        ).toBe(false)
    })
})

describe("PostmarkSubscriptionChangeEventTypeObject validation", () => {
    const suppression = {
        RecordType: "SubscriptionChange",
        MessageID: "883953f4-6105-42a2-a16a-77a8eac79483",
        ServerID: 123456,
        MessageStream: "broadcast",
        ChangedAt: "2026-07-17T10:53:34.416071Z",
        Recipient: "bounced-address@example.com",
        Origin: "Recipient",
        SuppressSending: true,
        SuppressionReason: "HardBounce",
        Tag: "email-notifications",
        Metadata: {},
    }

    it("accepts a suppression event with extra fields", () => {
        const result =
            PostmarkSubscriptionChangeEventTypeObject.safeParse(suppression)
        expect(result.success).toBe(true)
    })

    it("accepts a reactivation event with null reason and message id", () => {
        const result = PostmarkSubscriptionChangeEventTypeObject.safeParse({
            ...suppression,
            MessageID: null,
            SuppressSending: false,
            SuppressionReason: null,
        })
        expect(result.success).toBe(true)
    })

    it("accepts an unknown suppression reason", () => {
        const result = PostmarkSubscriptionChangeEventTypeObject.safeParse({
            ...suppression,
            SuppressionReason: "SomeNewReason",
        })
        expect(result.success).toBe(true)
    })

    it("rejects other webhook record types", () => {
        const result = PostmarkSubscriptionChangeEventTypeObject.safeParse({
            ...suppression,
            RecordType: "Bounce",
        })
        expect(result.success).toBe(false)
    })

    it("rejects a missing recipient", () => {
        const { Recipient: _, ...withoutRecipient } = suppression
        const result =
            PostmarkSubscriptionChangeEventTypeObject.safeParse(
                withoutRecipient
            )
        expect(result.success).toBe(false)
    })
})
