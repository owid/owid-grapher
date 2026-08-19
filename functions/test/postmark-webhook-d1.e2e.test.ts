import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Models } from "postmark"
import type { Env } from "../_common/env.js"
import { markReactivatedLocally } from "../_common/postmarkSuppressions.js"
import type {
    PostmarkSubscriptionChangeWebhook,
    PostmarkWebhookEvent,
} from "../_common/postmarkWebhook.js"
import { setUpTestHarness } from "./setUpTestHarness.js"

const SECRET = "webhook:secret"
const authorization = `Basic ${btoa(`postmark:${SECRET}`)}`

const server = setUpTestHarness("./functions/test/wrangler.e2e.jsonc")
const worker = server.getWorker<Env>()
let db: D1Database

interface DeliveryRow {
    status: string
    deliveredAt: string | null
}

interface CountRow {
    count: number
}

const clearDatabaseStatements = [
    "DROP TRIGGER IF EXISTS fail_suppression",
    "DELETE FROM notification_preferences",
    "DELETE FROM tokens",
    "DELETE FROM messages",
    "DELETE FROM users",
    "DELETE FROM postmark_webhook_receipts",
    "DELETE FROM postmark_suppressions",
    "DELETE FROM sqlite_sequence",
]

async function clearDatabase(): Promise<void> {
    await db.batch(
        clearDatabaseStatements.map((statement) => db.prepare(statement))
    )
}

async function runSql(sql: string, params: unknown[] = []): Promise<void> {
    await db
        .prepare(sql)
        .bind(...params)
        .run()
}

async function querySql<Row>(
    sql: string,
    params: unknown[] = []
): Promise<Row[]> {
    const result = await db
        .prepare(sql)
        .bind(...params)
        .all<Row>()
    return result.results
}

async function postWebhook(
    event: PostmarkWebhookEvent,
    authorizationHeader = authorization
) {
    return server.fetch("/api/email-notifications/postmark-webhook", {
        method: "POST",
        headers: {
            Authorization: authorizationHeader,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
    })
}

async function seedMessage(messageId: string): Promise<void> {
    await runSql(
        `INSERT INTO users (email, token)
         VALUES (?1, ?2)`,
        ["reader@example.com", "reader-token"]
    )
    await runSql(
        `INSERT INTO messages (userId, frequency, itemSlugs, messageId)
         VALUES (1, 'daily', '["example-article"]', ?1)`,
        [messageId]
    )
}

function makeDelivery(
    overrides: Partial<Models.DeliveryWebhook> = {}
): Models.DeliveryWebhook {
    return {
        RecordType: "Delivery",
        ServerID: 23,
        MessageStream: "broadcast",
        MessageID: "message-1",
        Recipient: "reader@example.com",
        DeliveredAt: "2026-07-29T10:00:00Z",
        Details: "Test delivery",
        Metadata: {},
        ...overrides,
    }
}

function makeSubscriptionChange(
    overrides: Partial<PostmarkSubscriptionChangeWebhook> = {}
): PostmarkSubscriptionChangeWebhook {
    return {
        RecordType: "SubscriptionChange",
        MessageID: "message-1",
        ServerID: 23,
        MessageStream: "broadcast",
        ChangedAt: "2026-07-29T11:00:00Z",
        Recipient: "Reader@Example.com",
        Origin: "Recipient",
        SuppressSending: true,
        SuppressionReason: Models.SuppressionReason.ManualSuppression,
        Tag: "email-notifications",
        Metadata: {},
        ...overrides,
    }
}

describe("Postmark webhook with local D1", () => {
    beforeAll(async () => {
        await worker.applyD1Migrations("EMAIL_NOTIFICATIONS_DB")
        const env = await worker.getEnv()
        if (!env.EMAIL_NOTIFICATIONS_DB) {
            throw new Error("Missing EMAIL_NOTIFICATIONS_DB binding")
        }
        db = env.EMAIL_NOTIFICATIONS_DB
    })

    beforeEach(async () => {
        await clearDatabase()
    })

    it("marks the matching message as delivered", async () => {
        await seedMessage("delivery-message")

        const response = await postWebhook(
            makeDelivery({ MessageID: "delivery-message" })
        )

        expect(response.status).toBe(200)
        await expect(
            querySql<DeliveryRow>(
                `SELECT status, deliveredAt
                 FROM messages
                 WHERE messageId = ?1`,
                ["delivery-message"]
            )
        ).resolves.toEqual([
            {
                status: "delivered",
                deliveredAt: "2026-07-29T10:00:00Z",
            },
        ])
        await expect(
            querySql<{
                idempotencyKey: string
                recordType: string
                messageId: string
            }>(
                `SELECT idempotencyKey, recordType, messageId
                 FROM postmark_webhook_receipts`
            )
        ).resolves.toEqual([
            {
                idempotencyKey: "Delivery:delivery-message",
                recordType: "Delivery",
                messageId: "delivery-message",
            },
        ])
    })

    it("retries a delivery that arrives before its message is recorded", async () => {
        const event = makeDelivery({ MessageID: "early-delivery" })

        const earlyResponse = await postWebhook(event)

        expect(earlyResponse.status).toBe(500)
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_webhook_receipts"
            )
        ).resolves.toEqual([{ count: 0 }])

        await seedMessage("early-delivery")
        const retriedResponse = await postWebhook(event)

        expect(retriedResponse.status).toBe(200)
        await expect(
            querySql<DeliveryRow>(
                `SELECT status, deliveredAt
                 FROM messages
                 WHERE messageId = ?1`,
                ["early-delivery"]
            )
        ).resolves.toEqual([
            {
                status: "delivered",
                deliveredAt: "2026-07-29T10:00:00Z",
            },
        ])
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_webhook_receipts"
            )
        ).resolves.toEqual([{ count: 1 }])
    })

    it("records a Postmark recipient unsubscribe locally", async () => {
        await runSql(
            `INSERT INTO users (email, token, status)
             VALUES ('reader@example.com', 'reader-token', 'subscribed')`
        )

        const response = await postWebhook(makeSubscriptionChange())

        expect(response.status).toBe(200)
        await expect(
            querySql<{ status: string }>(
                `SELECT status FROM users WHERE email = 'reader@example.com'`
            )
        ).resolves.toEqual([{ status: "unsubscribed" }])
        await expect(
            querySql<{ email: string; isSuppressed: number }>(
                `SELECT email, isSuppressed FROM postmark_suppressions`
            )
        ).resolves.toEqual([{ email: "reader@example.com", isSuppressed: 1 }])
    })

    it("mirrors non-unsubscribe suppressions without changing user intent", async () => {
        await runSql(
            `INSERT INTO users (email, token, status)
             VALUES ('reader@example.com', 'reader-token', 'subscribed')`
        )

        const response = await postWebhook(
            makeSubscriptionChange({
                Origin: "Admin",
                SuppressionReason: Models.SuppressionReason.SpamComplaint,
            })
        )

        expect(response.status).toBe(200)
        await expect(
            querySql<{ status: string }>(
                `SELECT status FROM users WHERE email = 'reader@example.com'`
            )
        ).resolves.toEqual([{ status: "subscribed" }])
        await expect(
            querySql<{ email: string; isSuppressed: number }>(
                `SELECT email, isSuppressed FROM postmark_suppressions`
            )
        ).resolves.toEqual([{ email: "reader@example.com", isSuppressed: 1 }])
    })

    it("retains a tombstone on reactivation without opting the user back in", async () => {
        await runSql(
            `INSERT INTO users (email, token, status)
             VALUES ('reader@example.com', 'reader-token', 'unsubscribed')`
        )
        await runSql(
            `INSERT INTO postmark_suppressions
                 (email, messageStream, isSuppressed, postmarkChangedAt)
             VALUES
                 ('reader@example.com', 'broadcast', 1, '2026-07-29T10:00:00Z')`
        )

        const response = await postWebhook(
            makeSubscriptionChange({
                MessageID: null,
                Origin: "Customer",
                SuppressSending: false,
                SuppressionReason: null,
                Tag: null,
            })
        )

        expect(response.status).toBe(200)
        await expect(
            querySql<{ status: string }>(
                `SELECT status FROM users WHERE email = 'reader@example.com'`
            )
        ).resolves.toEqual([{ status: "unsubscribed" }])
        await expect(
            querySql<{ isSuppressed: number; postmarkChangedAt: string }>(
                `SELECT isSuppressed, postmarkChangedAt
                 FROM postmark_suppressions`
            )
        ).resolves.toEqual([
            {
                isSuppressed: 0,
                postmarkChangedAt: "2026-07-29T11:00:00Z",
            },
        ])
        await expect(
            querySql<{ messageId: string | null }>(
                "SELECT messageId FROM postmark_webhook_receipts"
            )
        ).resolves.toEqual([{ messageId: null }])
    })

    it("locally mirrors an API reactivation without advancing Postmark's timestamp", async () => {
        const suppressionResponse = await postWebhook(makeSubscriptionChange())
        expect(suppressionResponse.status).toBe(200)

        await markReactivatedLocally(
            db,
            "reader@example.com",
            "2026-07-29T11:00:00Z"
        )

        await expect(
            querySql<{ isSuppressed: number; postmarkChangedAt: string }>(
                `SELECT isSuppressed, postmarkChangedAt
                 FROM postmark_suppressions`
            )
        ).resolves.toEqual([
            {
                isSuppressed: 0,
                postmarkChangedAt: "2026-07-29T11:00:00Z",
            },
        ])
    })

    it("does not let a local API reactivation overwrite a newer webhook", async () => {
        const firstSuppressionResponse = await postWebhook(
            makeSubscriptionChange({
                ChangedAt: "2026-07-29T11:00:00Z",
            })
        )
        const newerSuppressionResponse = await postWebhook(
            makeSubscriptionChange({
                ChangedAt: "2026-07-29T12:00:00Z",
            })
        )
        expect(firstSuppressionResponse.status).toBe(200)
        expect(newerSuppressionResponse.status).toBe(200)

        await markReactivatedLocally(
            db,
            "reader@example.com",
            "2026-07-29T11:00:00Z"
        )

        await expect(
            querySql<{ isSuppressed: number; postmarkChangedAt: string }>(
                `SELECT isSuppressed, postmarkChangedAt
                 FROM postmark_suppressions`
            )
        ).resolves.toEqual([
            {
                isSuppressed: 1,
                postmarkChangedAt: "2026-07-29T12:00:00Z",
            },
        ])
    })

    it("ignores a stale suppression delivered after a newer reactivation", async () => {
        await runSql(
            `INSERT INTO users (email, token, status)
             VALUES ('reader@example.com', 'reader-token', 'subscribed')`
        )

        const reactivationResponse = await postWebhook(
            makeSubscriptionChange({
                MessageID: null,
                ChangedAt: "2026-07-29T12:00:00Z",
                Origin: "Customer",
                SuppressSending: false,
                SuppressionReason: null,
                Tag: null,
            })
        )
        const staleSuppressionResponse = await postWebhook(
            makeSubscriptionChange({
                ChangedAt: "2026-07-29T11:00:00Z",
            })
        )

        expect(reactivationResponse.status).toBe(200)
        expect(staleSuppressionResponse.status).toBe(200)
        await expect(
            querySql<{ status: string }>(
                `SELECT status FROM users WHERE email = 'reader@example.com'`
            )
        ).resolves.toEqual([{ status: "subscribed" }])
        await expect(
            querySql<{ isSuppressed: number; postmarkChangedAt: string }>(
                `SELECT isSuppressed, postmarkChangedAt
                 FROM postmark_suppressions`
            )
        ).resolves.toEqual([
            {
                isSuppressed: 0,
                postmarkChangedAt: "2026-07-29T12:00:00Z",
            },
        ])
    })

    it("ignores a stale reactivation delivered after a newer suppression", async () => {
        const suppressionResponse = await postWebhook(
            makeSubscriptionChange({
                ChangedAt: "2026-07-29T12:00:00Z",
            })
        )
        const staleReactivationResponse = await postWebhook(
            makeSubscriptionChange({
                MessageID: null,
                ChangedAt: "2026-07-29T11:00:00Z",
                Origin: "Customer",
                SuppressSending: false,
                SuppressionReason: null,
                Tag: null,
            })
        )

        expect(suppressionResponse.status).toBe(200)
        expect(staleReactivationResponse.status).toBe(200)
        await expect(
            querySql<{ isSuppressed: number; postmarkChangedAt: string }>(
                `SELECT isSuppressed, postmarkChangedAt
                 FROM postmark_suppressions`
            )
        ).resolves.toEqual([
            {
                isSuppressed: 1,
                postmarkChangedAt: "2026-07-29T12:00:00Z",
            },
        ])
    })

    it("ignores subscription changes from other message streams", async () => {
        const response = await postWebhook(
            makeSubscriptionChange({ MessageStream: "outbound" })
        )

        expect(response.status).toBe(200)
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_suppressions"
            )
        ).resolves.toEqual([{ count: 0 }])
    })

    it("distinguishes a subscription change from delivery of the same message", async () => {
        await seedMessage("shared-message")

        const deliveryResponse = await postWebhook(
            makeDelivery({ MessageID: "shared-message" })
        )
        const subscriptionResponse = await postWebhook(
            makeSubscriptionChange({ MessageID: "shared-message" })
        )

        expect(deliveryResponse.status).toBe(200)
        expect(subscriptionResponse.status).toBe(200)
        await expect(
            querySql<{
                idempotencyKey: string
                recordType: string
                messageId: string
            }>(
                `SELECT idempotencyKey, recordType, messageId
                 FROM postmark_webhook_receipts
                 ORDER BY idempotencyKey`
            )
        ).resolves.toEqual([
            {
                idempotencyKey: "Delivery:shared-message",
                recordType: "Delivery",
                messageId: "shared-message",
            },
            {
                idempotencyKey:
                    "SubscriptionChange:broadcast:reader@example.com:2026-07-29T11:00:00Z:true",
                recordType: "SubscriptionChange",
                messageId: "shared-message",
            },
        ])
        await expect(
            querySql<{ status: string }>(
                `SELECT status FROM users WHERE email = 'reader@example.com'`
            )
        ).resolves.toEqual([{ status: "unsubscribed" }])
    })

    it("does not apply an already processed event again", async () => {
        await seedMessage("duplicate-message")
        const firstResponse = await postWebhook(
            makeDelivery({ MessageID: "duplicate-message" })
        )
        expect(firstResponse.status).toBe(200)

        const secondResponse = await postWebhook(
            makeDelivery({
                MessageID: "duplicate-message",
                DeliveredAt: "2026-07-30T10:00:00Z",
            })
        )

        expect(secondResponse.status).toBe(200)
        await expect(
            querySql<DeliveryRow>(
                `SELECT status, deliveredAt
                 FROM messages
                 WHERE messageId = ?1`,
                ["duplicate-message"]
            )
        ).resolves.toEqual([
            {
                status: "delivered",
                deliveredAt: "2026-07-29T10:00:00Z",
            },
        ])
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_webhook_receipts"
            )
        ).resolves.toEqual([{ count: 1 }])
    })

    it("returns 500 and can retry after a D1 failure", async () => {
        await runSql(
            `CREATE TRIGGER fail_suppression
             BEFORE INSERT ON postmark_suppressions
             BEGIN
                 SELECT RAISE(FAIL, 'simulated D1 failure');
             END`
        )

        const event = makeSubscriptionChange({
            MessageID: "retry-message",
            ChangedAt: "2026-07-29T12:00:00Z",
        })

        const failedResponse = await postWebhook(event)
        expect(failedResponse.status).toBe(500)
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_suppressions"
            )
        ).resolves.toEqual([{ count: 0 }])
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_webhook_receipts"
            )
        ).resolves.toEqual([{ count: 0 }])

        await runSql("DROP TRIGGER fail_suppression")
        const retriedResponse = await postWebhook(event)

        expect(retriedResponse.status).toBe(200)
        await expect(
            querySql<{ email: string; isSuppressed: number }>(
                `SELECT email, isSuppressed FROM postmark_suppressions`
            )
        ).resolves.toEqual([{ email: "reader@example.com", isSuppressed: 1 }])
        await expect(
            querySql<CountRow>(
                "SELECT COUNT(*) AS count FROM postmark_webhook_receipts"
            )
        ).resolves.toEqual([{ count: 1 }])
    })

    it("returns 500 so Postmark retries a payload parsing failure", async () => {
        const response = await server.fetch(
            "/api/email-notifications/postmark-webhook",
            {
                method: "POST",
                headers: { Authorization: authorization },
                body: "{",
            }
        )

        expect(response.status).toBe(500)
    })

    it("returns 403 for invalid credentials", async () => {
        const response = await postWebhook(makeDelivery(), "Basic invalid")

        expect(response.status).toBe(403)
    })

    it.each(["postmark", "anything"])(
        "accepts the correct password with the username %s",
        async (username) => {
            const response = await postWebhook(
                makeDelivery({ MessageStream: "outbound" }),
                `Basic ${btoa(`${username}:${SECRET}`)}`
            )

            expect(response.status).toBe(200)
        }
    )

    it.each([
        { name: "missing", header: undefined },
        { name: "a bearer token", header: `Bearer ${SECRET}` },
        { name: "invalid base64", header: "Basic not-base64!!!" },
        {
            name: "credentials without a colon",
            header: `Basic ${btoa(SECRET)}`,
        },
    ])("returns 403 for $name credentials", async ({ header }) => {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        if (header) headers.Authorization = header

        const response = await server.fetch(
            "/api/email-notifications/postmark-webhook",
            {
                method: "POST",
                headers,
                body: JSON.stringify(makeDelivery()),
            }
        )

        expect(response.status).toBe(403)
    })
})
