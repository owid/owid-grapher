import {
    CommentTargetType,
    CommentViewState,
    JsonError,
    findMentionedCandidates,
} from "@ourworldindata/types"

import * as db from "../db/db.js"
import { getMentionableUsers } from "../db/model/Comment.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import {
    ADMIN_BASE_URL,
    SLACK_BOT_OAUTH_TOKEN,
} from "../settings/serverSettings.js"
import { postToSlack } from "./apiRoutes/slack.js"

/**
 * Where to send someone so they land on the comment, not just the page.
 *
 * The view matters as much as the page: a multi-dim comment lives on one view,
 * and a link without the dimension params opens the default one, where the
 * comment isn't shown at all. `comment` marks the link as one that exists to
 * show a comment, which is what turns comment mode on at the other end.
 */
async function previewUrl(
    trx: db.KnexReadonlyTransaction,
    {
        commentId,
        targetType,
        targetId,
        viewState,
    }: {
        commentId: number
        targetType: CommentTargetType
        targetId: number
        viewState: CommentViewState | null
    }
): Promise<string> {
    const params = new URLSearchParams(viewState ?? {})
    params.set("comment", String(commentId))
    const query = `?${params.toString()}`

    if (targetType === CommentTargetType.Chart) {
        return `${ADMIN_BASE_URL}/admin/charts/${targetId}/preview${query}`
    }
    // One admin route resolves both chart and multi-dim slugs, and a multi-dim
    // has no id-based preview, so it goes by slug.
    const row = await db.knexRawFirst<{ slug: string }>(
        trx,
        `SELECT slug FROM multi_dim_data_pages WHERE id = ?`,
        [targetId]
    )
    return row
        ? `${ADMIN_BASE_URL}/admin/grapher/${row.slug}${query}`
        : `${ADMIN_BASE_URL}/admin`
}

/**
 * Tells the people a comment mentioned, over Slack.
 *
 * Sends wherever a Slack token is configured, and logs the message where one
 * isn't - local dev, mainly. That is not a safety gate: the comment API is only
 * reachable by staff over Tailscale, so the only person who can trigger a
 * message is a colleague. The message names where it came from, because a DM
 * from a branch's staging server otherwise looks exactly like one from
 * production while linking somewhere that may not exist next week.
 *
 * A mention nobody can deliver is not an error - someone may have no Slack id
 * recorded, or the handle may match nobody - so this reports what it did rather
 * than failing the comment that triggered it.
 */
export async function notifyMentionedUsers({
    trx,
    commentId,
    content,
    authorName,
    targetType,
    targetId,
    anchor,
    viewState,
}: {
    trx: db.KnexReadonlyTransaction
    commentId: number
    content: string
    authorName: string
    targetType: CommentTargetType
    targetId: number
    anchor: string | null
    /** For a multi-dim, the view the comment hangs off; on a reply, the root's */
    viewState: CommentViewState | null
}): Promise<void> {
    // Matched against the actual list of people: a name has spaces, so there is
    // no telling where "@Pablo Rosado" ends without knowing the names.
    const users = findMentionedCandidates(
        content,
        await getMentionableUsers(trx)
    )
    if (!users.length) return

    const url = await previewUrl(trx, {
        commentId,
        targetType,
        targetId,
        viewState,
    })
    const where = anchor ? `the ${anchor} field` : "a chart"
    // e.g. "staging-site-internal-comments-2" - tells you which environment
    // you are being sent to before you click
    const origin = ADMIN_BASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")

    for (const user of users) {
        // Mentioning yourself notifies you, same as mentioning anyone else.
        // Quietly skipping it would be one more mention that does nothing and
        // says nothing about why.
        if (!user.slackId) {
            console.log(
                `[comment mentions] no Slack id for ${user.fullName}; not notified`
            )
            continue
        }

        const text =
            `*${authorName}* mentioned you in a comment on ${where}` +
            ` (${origin}):\n` +
            `> ${content.replace(/\n/g, "\n> ")}\n${url}`

        if (!SLACK_BOT_OAUTH_TOKEN) {
            console.log(
                `[comment mentions] no Slack token configured; would have sent to ${user.fullName}: ${url}`
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
