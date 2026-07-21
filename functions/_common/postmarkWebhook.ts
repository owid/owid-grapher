import * as z from "zod/mini"

/**
 * Payload of Postmark's subscription-change webhook, fired when an address
 * is added to or removed from a message stream's suppression list (hard
 * bounce, spam complaint, manual suppression, or reactivation).
 * https://postmarkapp.com/developer/webhooks/subscription-change-webhook
 * Fields we don't use (MessageID, ServerID, MessageStream, Origin, Tag,
 * Metadata) are ignored.
 */
export const PostmarkSubscriptionChangeEventTypeObject = z.object({
    RecordType: z.literal("SubscriptionChange"),
    Recipient: z.string().check(z.minLength(1)),
    SuppressSending: z.boolean(),
    // 'HardBounce', 'SpamComplaint' or 'ManualSuppression'; null on
    // reactivations. Deliberately not an enum so a new Postmark reason can't
    // make us drop the event.
    SuppressionReason: z.optional(z.nullable(z.string())),
    // ISO 8601 timestamp of the change.
    ChangedAt: z.string().check(z.minLength(1)),
})

export type PostmarkSubscriptionChangeEvent = z.infer<
    typeof PostmarkSubscriptionChangeEventTypeObject
>

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
    return timingSafeStringEqual(credentials.slice(colonIndex + 1), secret)
}

function timingSafeStringEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return diff === 0
}

/**
 * Mirror a suppression change into users.suppressed_at/suppression_reason.
 * Idempotent (Postmark retries failed deliveries), and guarded on ChangedAt
 * so a late-arriving older event can't overwrite a newer one. Postmark
 * tracks suppressions per message stream, but we keep a single flag: a
 * suppression on either of our streams suppresses the user, a reactivation
 * on either clears it. An unknown recipient is a no-op.
 */
export async function applySubscriptionChange(
    db: D1Database,
    event: PostmarkSubscriptionChangeEvent
): Promise<void> {
    const email = event.Recipient.trim().toLowerCase()
    if (event.SuppressSending) {
        await db
            .prepare(
                `UPDATE users
                 SET suppressed_at = ?2,
                     suppression_reason = ?3,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE email = ?1
                     AND (suppressed_at IS NULL OR suppressed_at <= ?2)`
            )
            .bind(email, event.ChangedAt, event.SuppressionReason ?? null)
            .run()
    } else {
        await db
            .prepare(
                `UPDATE users
                 SET suppressed_at = NULL,
                     suppression_reason = NULL,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE email = ?1 AND suppressed_at <= ?2`
            )
            .bind(email, event.ChangedAt)
            .run()
    }
}
