/**
 * Reset local test state for the email notifications send job, so
 * `yarn sendEmailNotifications <frequency> --local` always has something to
 * send without republishing content:
 *
 *   yarn resetEmailNotificationsTestState [slug]
 *
 * Clears last_sent_at for all subscribers in the LOCAL D1 database, and, when
 * a slug is given, bumps that post's publishedAt to now in the local MySQL
 * database so it falls inside every subscriber's frequency window.
 */
import { LATEST_FEED_TYPE_VALUES } from "@ourworldindata/types"
import * as db from "../db/db.js"
import { createLocalD1Client } from "../baker/emailNotifications/emailNotificationsD1.js"

// Must match the database_name in wrangler.jsonc and the send job's --local
// database (see baker/emailNotifications/sendEmailNotifications.ts).
const LOCAL_D1_DATABASE_NAME = "owid-email-notifications-staging"

async function resetLastSentAt(): Promise<void> {
    const d1 = createLocalD1Client(LOCAL_D1_DATABASE_NAME)
    const rows = await d1.query<{ user_id: number }>(
        "UPDATE notification_preferences SET last_sent_at = NULL RETURNING user_id"
    )
    console.log(
        `Cleared last_sent_at for ${rows.length} subscriber(s) in local D1`
    )
}

async function bumpPublishedAt(slug: string): Promise<void> {
    await db.knexReadWriteTransaction(async (trx) => {
        const post = await db.knexRawFirst<{
            id: string
            type: string
            published: number
        }>(trx, "SELECT id, type, published FROM posts_gdocs WHERE slug = ?", [
            slug,
        ])
        if (!post) throw new Error(`No gdoc found with slug "${slug}"`)
        if (!post.published) throw new Error(`Gdoc "${slug}" is not published`)
        if (!(LATEST_FEED_TYPE_VALUES as readonly string[]).includes(post.type))
            throw new Error(
                `Gdoc "${slug}" has type "${post.type}", but the send job only picks up: ${LATEST_FEED_TYPE_VALUES.join(", ")}`
            )
        await db.knexRaw(
            trx,
            "UPDATE posts_gdocs SET publishedAt = NOW() WHERE id = ?",
            [post.id]
        )
        console.log(
            `Bumped publishedAt to now for "${slug}" (${post.type}) in local MySQL`
        )
    })
}

async function main(): Promise<void> {
    const slug = process.argv[2]
    await resetLastSentAt()
    if (slug) {
        await bumpPublishedAt(slug)
    } else {
        console.log(
            "No slug given, so no content was touched. Pass a slug to also make a post 'fresh' for the send job: yarn resetEmailNotificationsTestState my-test-article"
        )
    }
    process.exit(0)
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
})
