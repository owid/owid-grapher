import {
    CommentAgentJobPayload,
    CommentTargetType,
    DbPlainJob,
    invokesAgent,
} from "@ourworldindata/types"

import * as db from "../db/db.js"
import {
    getAgentUserId,
    getCommentById,
    insertComment,
} from "../db/model/Comment.js"
import { markJobDone } from "../db/model/Jobs.js"

/**
 * What the agent is being asked to change, gathered from the comment rather than
 * from the request. A comment already records everything that matters - which
 * chart or multi-dim, which metadata field, which view - so the instruction is
 * the only free text involved.
 */
export interface CommentAgentContext {
    commentId: number
    /** The comment in full, mention included */
    instruction: string
    targetType: CommentTargetType
    targetId: number
    /** The target's identity outside this database, e.g. a catalog path */
    targetKey: string | null
    /** The metadata field the comment hangs off, if any */
    anchor: string | null
    /** For a multi-dim, the view the comment was left on */
    viewState: Record<string, string> | null
}

export interface CommentAgentResult {
    success: boolean
    /** What to say back in the thread */
    reply: string
}

/**
 * Stands in for the agent while the plumbing is proven end to end.
 *
 * Everything around this - noticing the invocation, queueing exactly one run per
 * comment, claiming it, writing the answer back into the thread - is the part
 * with unknowns in it, and none of it needs an API key. Replacing this function
 * is the last step, not the first.
 */
export async function runAgentStub(
    context: CommentAgentContext
): Promise<CommentAgentResult> {
    const where = context.targetKey
        ? `${context.targetType} \`${context.targetKey}\``
        : `${context.targetType} ${context.targetId}`
    const field = context.anchor ? ` field \`${context.anchor}\`` : ""
    const view = context.viewState
        ? `\nView: ${JSON.stringify(context.viewState)}`
        : ""

    return {
        success: true,
        reply:
            `This is a test, and will create a testing PR in ETL.\n\n` +
            `Asked: ${context.instruction || "(no instruction given)"}\n` +
            `Target: ${where}${field}${view}`,
    }
}

/**
 * Acts on one queued invocation: read the comment, do the work, answer in the
 * thread. The answer is a plain reply row, which is why this runs here rather
 * than anywhere that would have to call back into the admin to be heard.
 */
export async function processCommentAgentJob(
    job: DbPlainJob<CommentAgentJobPayload>,
    runAgent: (
        context: CommentAgentContext
    ) => Promise<CommentAgentResult> = runAgentStub
): Promise<{ success: boolean }> {
    const { commentId } = job.payload

    const context = await db.knexReadonlyTransaction(async (trx) => {
        const comment = await getCommentById(trx, commentId)
        if (!comment) return undefined
        // The comment must still be an invocation: it could have been edited or
        // deleted between being queued and being run.
        if (!invokesAgent(comment.content)) return undefined
        return {
            commentId,
            // The whole comment, since the mention can sit anywhere in it and
            // the surrounding sentence is usually the point
            instruction: comment.content.trim(),
            targetType: comment.targetType,
            targetId: comment.targetId,
            targetKey: comment.targetKey,
            anchor: comment.anchor,
            viewState: comment.viewState
                ? (JSON.parse(comment.viewState) as Record<string, string>)
                : null,
        } satisfies CommentAgentContext
    })

    if (!context) {
        // Nothing to act on any more. Done rather than failed: retrying will
        // not make the comment come back.
        await db.knexReadWriteTransaction(async (trx) => {
            await markJobDone(trx, job.id)
        })
        return { success: true }
    }

    const result = await runAgent(context)

    await db.knexReadWriteTransaction(async (trx) => {
        const agentUserId = await getAgentUserId(trx)
        if (agentUserId !== undefined) {
            await insertComment(trx, {
                targetType: context.targetType,
                targetId: context.targetId,
                parentId: commentId,
                content: result.reply,
                userId: agentUserId,
            })
        }
        await markJobDone(trx, job.id)
    })

    return { success: result.success }
}
