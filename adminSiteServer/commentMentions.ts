import {
    CommentTargetType,
    JsonError,
    findMentionedCandidates,
} from "@ourworldindata/types"

import * as db from "../db/db.js"
import { getMentionableUsers } from "../db/model/Comment.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import {
    ADMIN_BASE_URL,
    COMMENT_MENTION_NOTIFICATIONS,
} from "../settings/serverSettings.js"
import { postToSlack } from "./apiRoutes/slack.js"

/** Where to send someone so they land on the comment, not just the page */
async function previewUrl(
    trx: db.KnexReadonlyTransaction,
    targetType: CommentTargetType,
    targetId: number
): Promise<string> {
    if (targetType === CommentTargetType.Chart) {
        return `${ADMIN_BASE_URL}/admin/charts/${targetId}/preview`
    }
    // One admin route resolves both chart and multi-dim slugs, and a multi-dim
    // has no id-based preview, so it goes by slug.
    const row = await db.knexRawFirst<{ slug: string }>(
        trx,
        `SELECT slug FROM multi_dim_data_pages WHERE id = ?`,
        [targetId]
    )
    return row
        ? `${ADMIN_BASE_URL}/admin/grapher/${row.slug}`
        : `${ADMIN_BASE_URL}/admin`
}

/**
 * Tells the people a comment mentioned, over Slack.
 *
 * Sending is opt-in per environment (COMMENT_MENTION_NOTIFICATIONS). When it is
 * off the message is logged instead, which is the right default now that Slack
 * ids reach staging: a staging server is otherwise perfectly able to DM the
 * whole team while someone tries the feature out.
 *
 * A mention nobody can deliver is not an error - someone may have no Slack id
 * recorded, or the handle may match nobody - so this reports what it did rather
 * than failing the comment that triggered it.
 */
export async function notifyMentionedUsers({
    trx,
    content,
    authorName,
    authorUserId,
    targetType,
    targetId,
    anchor,
}: {
    trx: db.KnexReadonlyTransaction
    content: string
    authorName: string
    authorUserId: number
    targetType: CommentTargetType
    targetId: number
    anchor: string | null
}): Promise<void> {
    // Matched against the actual list of people: a name has spaces, so there is
    // no telling where "@Pablo Rosado" ends without knowing the names.
    const users = findMentionedCandidates(
        content,
        await getMentionableUsers(trx)
    )
    if (!users.length) return

    const url = await previewUrl(trx, targetType, targetId)
    const where = anchor ? `the ${anchor} field` : "a chart"

    for (const user of users) {
        // Mentioning yourself shouldn't ping you
        if (user.id === authorUserId) continue
        if (!user.slackId) {
            console.log(
                `[comment mentions] no Slack id for ${user.fullName}; not notified`
            )
            continue
        }

        const text =
            `*${authorName}* mentioned you in a comment on ${where}:\n` +
            `> ${content.replace(/\n/g, "\n> ")}\n${url}`

        if (!COMMENT_MENTION_NOTIFICATIONS) {
            console.log(
                `[comment mentions] would notify ${user.fullName} (${user.slackId}): ${url}`
            )
            continue
        }

        try {
            await postToSlack({ channel: user.slackId, text })
        } catch (error) {
            // The comment is already saved; a failed notification must not
            // undo it, but it shouldn't vanish either.
            void logErrorAndMaybeCaptureInSentry(
                error instanceof JsonError || error instanceof Error
                    ? error
                    : new Error(String(error))
            )
        }
    }
}
