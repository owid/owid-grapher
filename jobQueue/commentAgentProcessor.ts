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
    getCommentsForTarget,
    insertComment,
} from "../db/model/Comment.js"
import { markJobDone } from "../db/model/Jobs.js"

/**
 * What the agent is being asked to change, gathered from the comment rather than
 * from the request. A comment already records everything that matters - which
 * chart or multi-dim, which metadata field, which view - so the instruction is
 * the only free text involved.
 */
/** One comment in the thread the agent was called into */
export interface CommentAgentThreadEntry {
    author: string
    content: string
    /** Whether the agent wrote it, so it can tell its own words apart */
    isAgent: boolean
    /** Whether this is the comment that invoked the run */
    isInvocation: boolean
}

export interface CommentAgentContext {
    commentId: number
    /**
     * The thread's root. Answers attach here, not to the comment that asked: a
     * thread is one level deep, and a reply whose parent is itself a reply is
     * rendered by nothing - it would be stored and then never seen.
     */
    rootCommentId: number
    /** The comment in full, mention included */
    instruction: string
    /**
     * The whole thread in order, the agent's own replies included. Without it a
     * follow-up starts cold: "I meant per capita" makes no sense on its own, and
     * the agent would have no idea what it had just said.
     */
    thread: CommentAgentThreadEntry[]
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
            `Target: ${where}${field}${view}\n` +
            `Thread: ${context.thread.length} comment(s) in context`,
    }
}

/** Answers in the thread, as a reply to the comment that asked */
async function postReply(
    context: CommentAgentContext,
    content: string
): Promise<void> {
    await db.knexReadWriteTransaction(async (trx) => {
        const agentUserId = await getAgentUserId(trx)
        // Absent only if the migration hasn't run, in which case the agent has
        // no identity to answer under and staying quiet is all that's left
        if (agentUserId === undefined) return
        await insertComment(trx, {
            targetType: context.targetType,
            targetId: context.targetId,
            parentId: context.rootCommentId,
            content,
            userId: agentUserId,
        })
    })
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
        // A thread is a root plus its replies - the schema allows no deeper
        // nesting - so this is every comment hanging off the same root.
        const rootId = comment.parentId ?? comment.id
        const agentUserId = await getAgentUserId(trx)
        const all = await getCommentsForTarget(
            trx,
            { targetType: comment.targetType, targetId: comment.targetId },
            { includeResolved: true }
        )
        const thread: CommentAgentThreadEntry[] = all
            .filter((c) => c.id === rootId || c.parentId === rootId)
            .map((c) => ({
                author: c.authorFullName,
                content: c.content,
                isAgent: c.userId === agentUserId,
                isInvocation: c.id === commentId,
            }))

        return {
            commentId,
            rootCommentId: rootId,
            // The whole comment, since the mention can sit anywhere in it and
            // the surrounding sentence is usually the point
            instruction: comment.content.trim(),
            thread,
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

    let result: CommentAgentResult
    try {
        result = await runAgent(context)
    } catch (error) {
        // Say so in the thread. A run that fails quietly is indistinguishable
        // from one nobody ever picked up, which is the one outcome the person
        // waiting can't act on. The job is marked failed by the caller, and that
        // is terminal, so this reply can't be written twice.
        const message = error instanceof Error ? error.message : String(error)
        await postReply(context, `I couldn't do this.\n\n${message}`)
        throw error
    }

    await db.knexReadWriteTransaction(async (trx) => {
        await markJobDone(trx, job.id)
    })
    await postReply(context, result.reply)

    return { success: result.success }
}
