import { Models } from "postmark"
import { POSTMARK_BROADCAST_MESSAGE_STREAM } from "./postmarkClient.js"

/**
 * The postmark.js webhook interface is a handwritten compile-time type and
 * does not reflect all payload variants. Postmark documents MessageID as null
 * for manual suppressions and reactivations, and SuppressionReason and Tag as
 * null for reactivations. Keep this override until the upstream SDK matches
 * the documented payload contract.
 * https://postmarkapp.com/developer/webhooks/subscription-change-webhook
 */
export type PostmarkSubscriptionChangeWebhook = Omit<
    Models.SubscriptionChangeWebhook,
    "MessageID" | "SuppressionReason" | "Tag"
> & {
    MessageID: string | null
    SuppressionReason: string | null
    Tag?: string | null
}

export type PostmarkWebhookEvent =
    | Models.DeliveryWebhook
    | PostmarkSubscriptionChangeWebhook

/**
 * Check the basic-auth credentials Postmark sends when the webhook URL is
 * configured as https://<username>:<secret>@host/path (Postmark has no HMAC
 * signatures). Only the password part is checked; the username is arbitrary.
 */
export function checkPostmarkWebhookAuthorization(
    header: string | null,
    secret: string
): boolean {
    if (!header?.startsWith("Basic ")) return false
    let credentials: string
    try {
        credentials = atob(header.slice("Basic ".length))
    } catch {
        return false
    }
    const colonIndex = credentials.indexOf(":")
    if (colonIndex === -1) return false

    const encoder = new TextEncoder()
    const suppliedSecret = encoder.encode(credentials.slice(colonIndex + 1))
    const expectedSecret = encoder.encode(secret)
    // Do not return early when the lengths differ, as that could leak the
    // secret's length through timing. Compare equal-length buffers either way.
    // https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/
    const lengthsMatch = suppliedSecret.byteLength === expectedSecret.byteLength
    return lengthsMatch
        ? crypto.subtle.timingSafeEqual(suppliedSecret, expectedSecret)
        : !crypto.subtle.timingSafeEqual(suppliedSecret, suppliedSecret)
}

/**
 * Apply a Postmark delivery or subscription-change event once.
 */
export async function applyPostmarkWebhookEvent(
    db: D1Database,
    event: PostmarkWebhookEvent
): Promise<void> {
    if (
        event.RecordType === "Delivery" &&
        event.MessageStream === POSTMARK_BROADCAST_MESSAGE_STREAM
    ) {
        // Sandbox delivery can beat the send API response, which means the
        // sender has not inserted its messages row yet. Do not acknowledge or
        // record the webhook in that case: Postmark will retry after the send
        // has been recorded.
        const message = await db
            .prepare("SELECT 1 FROM messages WHERE messageId = ?1")
            .bind(event.MessageID)
            .first()
        if (!message) {
            throw new Error(
                `Postmark delivery arrived before its message was recorded: ${event.MessageID}`
            )
        }
    }

    // D1 has no interactive transaction API: batch() is its atomic transaction
    // primitive, so each mutation must carry the idempotency check in SQL.
    // https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
    const idempotencyKey = getPostmarkWebhookIdempotencyKey(event)
    const statements = buildEventStatements(db, event, idempotencyKey)

    // Record completion last within the transaction. If any preceding
    // statement fails, D1 rolls the entire batch back and Postmark can retry.
    statements.push(
        buildRecordWebhookReceiptStatement(db, event, idempotencyKey)
    )

    await db.batch(statements)
}

function buildEventStatements(
    db: D1Database,
    event: PostmarkWebhookEvent,
    idempotencyKey: string
): D1PreparedStatement[] {
    switch (event.RecordType) {
        case "Delivery":
            return buildDeliveryStatements(db, event, idempotencyKey)
        case "SubscriptionChange":
            return buildSubscriptionChangeStatements(db, event, idempotencyKey)
    }
}

function buildDeliveryStatements(
    db: D1Database,
    event: Models.DeliveryWebhook,
    idempotencyKey: string
): D1PreparedStatement[] {
    if (event.MessageStream !== POSTMARK_BROADCAST_MESSAGE_STREAM) return []

    return [
        db
            .prepare(
                `UPDATE messages
                 SET status = 'delivered', deliveredAt = ?2
                 WHERE messageId = ?1
                     AND NOT EXISTS (
                         SELECT 1
                         FROM postmark_webhook_receipts
                         WHERE idempotencyKey = ?3
                     )`
            )
            .bind(event.MessageID, event.DeliveredAt, idempotencyKey),
    ]
}

function buildSubscriptionChangeStatements(
    db: D1Database,
    event: PostmarkSubscriptionChangeWebhook,
    idempotencyKey: string
): D1PreparedStatement[] {
    if (event.MessageStream !== POSTMARK_BROADCAST_MESSAGE_STREAM) return []

    const email = event.Recipient.trim().toLowerCase()
    const statements = [
        buildUpsertPostmarkSuppressionStatement(
            db,
            event,
            email,
            idempotencyKey
        ),
    ]
    if (event.SuppressSending && isRecipientUnsubscribe(event)) {
        statements.push(
            buildUnsubscribeUserStatement(db, event, email, idempotencyKey)
        )
    }
    return statements
}

/**
 * Postmark represents a recipient clicking its unsubscribe link as a
 * recipient-originated manual suppression. Other suppression causes affect
 * deliverability, not the user's subscription intent.
 */
function isRecipientUnsubscribe(
    event: PostmarkSubscriptionChangeWebhook
): boolean {
    return (
        event.Origin === "Recipient" &&
        event.SuppressionReason === Models.SuppressionReason.ManualSuppression
    )
}

function buildUpsertPostmarkSuppressionStatement(
    db: D1Database,
    event: PostmarkSubscriptionChangeWebhook,
    email: string,
    idempotencyKey: string
): D1PreparedStatement {
    return db
        .prepare(
            `INSERT INTO postmark_suppressions (
                 email,
                 messageStream,
                 isSuppressed,
                 postmarkChangedAt
             )
             SELECT ?1, ?2, ?3, ?4
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM postmark_webhook_receipts
                 WHERE idempotencyKey = ?5
             )
             ON CONFLICT (email, messageStream) DO UPDATE SET
                 isSuppressed = excluded.isSuppressed,
                 postmarkChangedAt = excluded.postmarkChangedAt,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE postmark_suppressions.postmarkChangedAt
                 < excluded.postmarkChangedAt`
        )
        .bind(
            email,
            event.MessageStream,
            Number(event.SuppressSending),
            event.ChangedAt,
            idempotencyKey
        )
}

function buildUnsubscribeUserStatement(
    db: D1Database,
    event: PostmarkSubscriptionChangeWebhook,
    email: string,
    idempotencyKey: string
): D1PreparedStatement {
    return db
        .prepare(
            `UPDATE users
             SET status = 'unsubscribed',
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE email = ?1
                 AND EXISTS (
                     SELECT 1
                     FROM postmark_suppressions
                     WHERE email = ?1
                         AND messageStream = ?2
                         AND postmarkChangedAt = ?3
                         AND isSuppressed = 1
                 )
                 AND NOT EXISTS (
                     SELECT 1
                     FROM postmark_webhook_receipts
                     WHERE idempotencyKey = ?4
                 )`
        )
        .bind(email, event.MessageStream, event.ChangedAt, idempotencyKey)
}

function buildRecordWebhookReceiptStatement(
    db: D1Database,
    event: PostmarkWebhookEvent,
    idempotencyKey: string
): D1PreparedStatement {
    return db
        .prepare(
            `INSERT INTO postmark_webhook_receipts (
                 idempotencyKey,
                 recordType,
                 messageId
             )
             VALUES (?1, ?2, ?3)
             ON CONFLICT (idempotencyKey) DO NOTHING`
        )
        .bind(idempotencyKey, event.RecordType, event.MessageID)
}

function getPostmarkWebhookIdempotencyKey(event: PostmarkWebhookEvent): string {
    switch (event.RecordType) {
        case "Delivery":
            return `${event.RecordType}:${event.MessageID}`
        case "SubscriptionChange":
            return [
                event.RecordType,
                event.MessageStream,
                event.Recipient.trim().toLowerCase(),
                event.ChangedAt,
                String(event.SuppressSending),
            ].join(":")
    }
}
