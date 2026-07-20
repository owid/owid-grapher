import {
    CommentTarget,
    CommentTargetType,
    CommentWithAuthor,
    DbInsertComment,
    DbRawComment,
    JsonString,
    parseCommentRow,
} from "@ourworldindata/types"
import * as db from "../db.js"

const TABLE_BY_TARGET_TYPE: Record<CommentTargetType, string> = {
    [CommentTargetType.Chart]: "charts",
    [CommentTargetType.Variable]: "variables",
    [CommentTargetType.MultiDim]: "multi_dim_data_pages",
}

export async function commentTargetExists(
    knex: db.KnexReadonlyTransaction,
    target: CommentTarget
): Promise<boolean> {
    const result = await db.knexRawFirst(
        knex,
        `SELECT 1 FROM ?? WHERE id = ?`,
        [TABLE_BY_TARGET_TYPE[target.targetType], target.targetId]
    )
    return Boolean(result)
}

export async function getCommentsForTarget(
    knex: db.KnexReadonlyTransaction,
    target: CommentTarget,
    { includeResolved = false }: { includeResolved?: boolean } = {}
): Promise<CommentWithAuthor[]> {
    // Replies never carry resolution state themselves, so when filtering out
    // resolved threads we look at the root comment's resolvedAt for them.
    const resolvedFilter = includeResolved
        ? ""
        : "AND COALESCE(root.resolvedAt, c.resolvedAt) IS NULL"
    const rows = await db.knexRaw<
        DbRawComment & {
            authorFullName: string
            resolvedByFullName: string | null
        }
    >(
        knex,
        `-- sql
        SELECT
            c.*,
            author.fullName AS authorFullName,
            resolver.fullName AS resolvedByFullName
        FROM comments c
        JOIN users author ON author.id = c.userId
        LEFT JOIN users resolver ON resolver.id = c.resolvedByUserId
        LEFT JOIN comments root ON root.id = c.parentId
        WHERE c.targetType = ? AND c.targetId = ?
        ${resolvedFilter}
        ORDER BY c.createdAt ASC, c.id ASC`,
        [target.targetType, target.targetId]
    )
    return rows.map((row) => ({
        ...parseCommentRow(row),
        authorFullName: row.authorFullName,
        resolvedByFullName: row.resolvedByFullName,
    }))
}

export async function getCommentById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<DbRawComment | undefined> {
    return await db.knexRawFirst<DbRawComment>(
        knex,
        `SELECT * FROM comments WHERE id = ?`,
        [id]
    )
}

export async function insertComment(
    knex: db.KnexReadWriteTransaction,
    comment: Pick<
        DbInsertComment,
        "targetType" | "targetId" | "content" | "userId"
    > & {
        anchor?: string | null
        viewState?: JsonString | null
        parentId?: number | null
    }
): Promise<number> {
    const result = await db.knexRawInsert(
        knex,
        `-- sql
        INSERT INTO comments
            (targetType, targetId, anchor, viewState, parentId, content, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            comment.targetType,
            comment.targetId,
            comment.anchor ?? null,
            comment.viewState ?? null,
            comment.parentId ?? null,
            comment.content,
            comment.userId,
        ]
    )
    return result.insertId
}

export async function setCommentResolved(
    knex: db.KnexReadWriteTransaction,
    id: number,
    resolvedByUserId: number | null
): Promise<void> {
    if (resolvedByUserId === null) {
        await db.knexRaw(
            knex,
            `UPDATE comments SET resolvedAt = NULL, resolvedByUserId = NULL WHERE id = ?`,
            [id]
        )
    } else {
        await db.knexRaw(
            knex,
            `UPDATE comments SET resolvedAt = NOW(), resolvedByUserId = ? WHERE id = ?`,
            [resolvedByUserId, id]
        )
    }
}

export async function deleteComment(
    knex: db.KnexReadWriteTransaction,
    id: number
): Promise<void> {
    await db.knexRaw(knex, `DELETE FROM comments WHERE id = ?`, [id])
}
