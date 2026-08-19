import { POSTMARK_BROADCAST_MESSAGE_STREAM } from "./postmarkClient.js"

export interface PostmarkSuppressionState {
    isSuppressed: number
    postmarkChangedAt: string
}

export async function findLocalSuppressionState(
    db: D1Database,
    email: string
): Promise<PostmarkSuppressionState | null> {
    return await db
        .prepare(
            `SELECT isSuppressed, postmarkChangedAt
             FROM postmark_suppressions
             WHERE email = ?1
                 AND messageStream = ?2`
        )
        .bind(email, POSTMARK_BROADCAST_MESSAGE_STREAM)
        .first<PostmarkSuppressionState>()
}

/**
 * Mirror a successful reactivation API call without advancing Postmark's
 * event timestamp. The timestamp guard prevents this local update from
 * overwriting a webhook that arrived while the API call was in flight.
 */
export async function markReactivatedLocally(
    db: D1Database,
    email: string,
    observedPostmarkChangedAt: string
): Promise<void> {
    await db
        .prepare(
            `UPDATE postmark_suppressions
             SET isSuppressed = 0,
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE email = ?1
                 AND messageStream = ?2
                 AND postmarkChangedAt = ?3`
        )
        .bind(
            email,
            POSTMARK_BROADCAST_MESSAGE_STREAM,
            observedPostmarkChangedAt
        )
        .run()
}
