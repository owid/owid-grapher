import {
    CommentTargetType,
    JsonError,
    serializeCommentViewState,
} from "@ourworldindata/types"
import * as z from "zod"
import * as db from "../../db/db.js"
import {
    commentTargetExists,
    deleteComment,
    getCommentById,
    getCommentsForTarget,
    insertComment,
    setCommentResolved,
} from "../../db/model/Comment.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

const targetSchema = z.object({
    targetType: z.enum(CommentTargetType),
    targetId: z.coerce.number().int().positive(),
})

const getCommentsSchema = targetSchema.extend({
    includeResolved: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
})

const createRootCommentSchema = targetSchema.extend({
    content: z.string().trim().min(1),
    anchor: z.string().max(255).nullish(),
    viewState: z.record(z.string(), z.string()).nullish(),
})

const createReplySchema = z.object({
    parentId: z.number().int().positive(),
    content: z.string().trim().min(1),
})

const setResolvedSchema = z.object({
    resolved: z.boolean(),
})

function parseOrThrow<T extends z.ZodType>(
    schema: T,
    value: unknown
): z.infer<T> {
    const result = schema.safeParse(value)
    if (!result.success) {
        throw new JsonError(`Invalid request: ${result.error.message}`, 400)
    }
    return result.data
}

export async function getComments(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const { targetType, targetId, includeResolved } = parseOrThrow(
        getCommentsSchema,
        req.query
    )
    const comments = await getCommentsForTarget(
        trx,
        { targetType, targetId },
        { includeResolved }
    )
    return { comments, currentUserId: res.locals.user.id }
}

export async function createComment(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    // Replies only carry the parent reference and their content; the target is
    // inherited from the root comment and anchor/viewState stay on the root.
    if ("parentId" in req.body) {
        const { parentId, content } = parseOrThrow(createReplySchema, req.body)
        const parent = await getCommentById(trx, parentId)
        if (!parent) throw new JsonError("Parent comment not found", 404)
        if (parent.parentId !== null) {
            throw new JsonError(
                "Comments can only be nested one level deep; reply to the root comment of the thread instead",
                400
            )
        }
        const id = await insertComment(trx, {
            targetType: parent.targetType,
            targetId: parent.targetId,
            parentId,
            content,
            userId: res.locals.user.id,
        })
        return { success: true, id }
    }

    const { targetType, targetId, content, anchor, viewState } = parseOrThrow(
        createRootCommentSchema,
        req.body
    )
    if (!(await commentTargetExists(trx, { targetType, targetId }))) {
        throw new JsonError(
            `No ${targetType} with id ${targetId} exists to comment on`,
            404
        )
    }
    const id = await insertComment(trx, {
        targetType,
        targetId,
        anchor,
        viewState: serializeCommentViewState(viewState ?? null),
        content,
        userId: res.locals.user.id,
    })
    return { success: true, id }
}

export async function setCommentResolvedState(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.commentId)
    const { resolved } = parseOrThrow(setResolvedSchema, req.body)
    const comment = await getCommentById(trx, id)
    if (!comment) throw new JsonError("Comment not found", 404)
    if (comment.parentId !== null) {
        throw new JsonError(
            "Only root comments of a thread can be resolved",
            400
        )
    }
    await setCommentResolved(trx, id, resolved ? res.locals.user.id : null)
    return { success: true }
}

export async function deleteCommentById(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = expectInt(req.params.commentId)
    const comment = await getCommentById(trx, id)
    if (!comment) throw new JsonError("Comment not found", 404)
    const user = res.locals.user
    if (comment.userId !== user.id && !user.isSuperuser) {
        throw new JsonError("You can only delete your own comments", 403)
    }
    await deleteComment(trx, id)
    return { success: true }
}
