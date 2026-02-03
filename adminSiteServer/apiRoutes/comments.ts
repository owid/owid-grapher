import {
    CommentsTableName,
    DbInsertComment,
    DbCommentWithUser,
    JsonError,
    parseCommentsRow,
    serializeCommentViewState,
    CommentTargetType,
    UsersTableName,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import e from "express"

export interface CommentsListParams {
    targetType: CommentTargetType
    targetId: string
    viewState?: string
    fieldPath?: string
    includeResolved?: boolean
}

export async function getComments(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{ comments: DbCommentWithUser[] }> {
    const { targetType, targetId, viewState, fieldPath, includeResolved } =
        req.query as unknown as CommentsListParams

    if (!targetType || !targetId) {
        throw new JsonError("targetType and targetId are required", 400)
    }

    let query = trx(CommentsTableName)
        .select(
            `${CommentsTableName}.*`,
            `${UsersTableName}.fullName as userFullName`,
            `${UsersTableName}.email as userEmail`
        )
        .leftJoin(
            UsersTableName,
            `${CommentsTableName}.userId`,
            `${UsersTableName}.id`
        )
        .where({
            [`${CommentsTableName}.targetType`]: targetType,
            [`${CommentsTableName}.targetId`]: targetId,
        })
        .orderBy(`${CommentsTableName}.createdAt`, "desc")

    if (fieldPath) {
        query = query.where(`${CommentsTableName}.fieldPath`, fieldPath)
    }

    if (viewState) {
        query = query.whereRaw(
            `JSON_CONTAINS(${CommentsTableName}.viewState, ?)`,
            [viewState]
        )
    }

    if (!includeResolved || includeResolved === "false") {
        query = query.whereNull(`${CommentsTableName}.resolvedAt`)
    }

    const rawComments = await query
    const comments = rawComments.map((row) => ({
        ...parseCommentsRow(row),
        userFullName: row.userFullName,
        userEmail: row.userEmail,
    }))

    res.set("Cache-Control", "no-store")
    return { comments }
}

export async function getCommentById(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{ comment: DbCommentWithUser | null }> {
    const id = Number(req.params.id)

    if (!id) {
        throw new JsonError("Comment ID is required", 400)
    }

    const row = await trx(CommentsTableName)
        .select(
            `${CommentsTableName}.*`,
            `${UsersTableName}.fullName as userFullName`,
            `${UsersTableName}.email as userEmail`
        )
        .leftJoin(
            UsersTableName,
            `${CommentsTableName}.userId`,
            `${UsersTableName}.id`
        )
        .where(`${CommentsTableName}.id`, id)
        .first()

    if (!row) {
        return { comment: null }
    }

    const comment = {
        ...parseCommentsRow(row),
        userFullName: row.userFullName,
        userEmail: row.userEmail,
    }

    res.set("Cache-Control", "no-store")
    return { comment }
}

export async function createComment(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: boolean; id: number }> {
    const { targetType, targetId, viewState, fieldPath, content, threadId } =
        req.body

    if (!targetType || !targetId || !content) {
        throw new JsonError(
            "targetType, targetId, and content are required",
            400
        )
    }

    const comment: DbInsertComment = {
        targetType,
        targetId,
        viewState: viewState ? serializeCommentViewState(viewState) : null,
        fieldPath: fieldPath || null,
        content,
        threadId: threadId || null,
        userId: res.locals.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
    }

    const result = await trx(CommentsTableName).insert(comment)
    const id = result[0]

    return { success: true, id }
}

export async function updateComment(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: boolean }> {
    const id = Number(req.params.id)
    const { content } = req.body

    if (!id) {
        throw new JsonError("Comment ID is required", 400)
    }

    if (!content) {
        throw new JsonError("Content is required", 400)
    }

    const existingComment = await trx(CommentsTableName).where({ id }).first()

    if (!existingComment) {
        throw new JsonError("Comment not found", 404)
    }

    if (existingComment.userId !== res.locals.user.id) {
        throw new JsonError("You can only edit your own comments", 403)
    }

    await trx(CommentsTableName)
        .update({
            content,
            updatedAt: new Date(),
        })
        .where({ id })

    return { success: true }
}

export async function resolveComment(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: boolean }> {
    const id = Number(req.params.id)

    if (!id) {
        throw new JsonError("Comment ID is required", 400)
    }

    const existingComment = await trx(CommentsTableName).where({ id }).first()

    if (!existingComment) {
        throw new JsonError("Comment not found", 404)
    }

    await trx(CommentsTableName)
        .update({
            resolvedAt: new Date(),
            resolvedBy: res.locals.user.id,
            updatedAt: new Date(),
        })
        .where({ id })

    return { success: true }
}

export async function unresolveComment(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: boolean }> {
    const id = Number(req.params.id)

    if (!id) {
        throw new JsonError("Comment ID is required", 400)
    }

    const existingComment = await trx(CommentsTableName).where({ id }).first()

    if (!existingComment) {
        throw new JsonError("Comment not found", 404)
    }

    await trx(CommentsTableName)
        .update({
            resolvedAt: null,
            resolvedBy: null,
            updatedAt: new Date(),
        })
        .where({ id })

    return { success: true }
}

export async function deleteComment(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
): Promise<{ success: boolean }> {
    const id = Number(req.params.id)

    if (!id) {
        throw new JsonError("Comment ID is required", 400)
    }

    const existingComment = await trx(CommentsTableName).where({ id }).first()

    if (!existingComment) {
        throw new JsonError("Comment not found", 404)
    }

    if (existingComment.userId !== res.locals.user.id) {
        throw new JsonError("You can only delete your own comments", 403)
    }

    await trx(CommentsTableName).delete().where({ id })

    return { success: true }
}

export async function getUnresolvedCommentsCount(
    req: Request,
    res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
): Promise<{ count: number }> {
    const { targetType, targetId } = req.query as unknown as {
        targetType?: CommentTargetType
        targetId?: string
    }

    let query = trx(CommentsTableName)
        .count("* as count")
        .whereNull("resolvedAt")

    if (targetType) {
        query = query.where("targetType", targetType)
    }

    if (targetId) {
        query = query.where("targetId", targetId)
    }

    const result = await query.first()
    const count = Number(result?.count || 0)

    res.set("Cache-Control", "no-store")
    return { count }
}
