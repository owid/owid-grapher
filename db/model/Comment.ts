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

/**
 * The target's identity outside this database. Auto-increment ids only mean
 * something in the database that issued them, and staging is a clone of
 * production that then diverges, so a comment records a portable key too:
 * a chart's config UUID, or a multi-dim's catalog path.
 *
 * Null when the target has none, which costs portability for that comment but
 * never blocks writing it.
 */
export async function getCommentTargetKey(
    knex: db.KnexReadonlyTransaction,
    target: CommentTarget
): Promise<string | null> {
    const queryByType: Record<CommentTargetType, string> = {
        [CommentTargetType.Chart]:
            "SELECT configId AS `key` FROM charts WHERE id = ?",
        [CommentTargetType.MultiDim]:
            "SELECT catalogPath AS `key` FROM multi_dim_data_pages WHERE id = ?",
    }
    const row = await db.knexRawFirst<{ key: string | null }>(
        knex,
        queryByType[target.targetType],
        [target.targetId]
    )
    return row?.key ?? null
}

/** Someone a comment mentioned, and how to reach them */
export interface MentionedUser {
    id: number
    fullName: string
    /** Null when we hold no Slack id for them, so they can't be notified */
    slackId: string | null
}

/**
 * Resolves mentioned GitHub handles to active users.
 *
 * githubUsername is stored as the Tailscale identity - "edomt@github" - so the
 * handle is what precedes the @. Matching is case-insensitive because handles are
 * written however people remember them (CGiattino, eoo-owid), and only active
 * users are considered: mentioning someone who has left should do nothing rather
 * than fail.
 */
export async function getUsersByGithubHandle(
    knex: db.KnexReadonlyTransaction,
    handles: string[]
): Promise<MentionedUser[]> {
    if (!handles.length) return []
    return await db.knexRaw<MentionedUser>(
        knex,
        `-- sql
        SELECT id, fullName, slackId
        FROM users
        WHERE isActive = 1
          AND LOWER(SUBSTRING_INDEX(githubUsername, '@', 1)) IN (?)
        `,
        [handles.map((handle) => handle.toLowerCase())]
    )
}

/** The account that owns the agent's replies; see the migration that inserts it */
export const AGENT_USER_EMAIL = "claude-agent@owid.invalid"

/**
 * The agent's user id. Absent only if the migration hasn't run, which the caller
 * should treat as "agent replies are not available here" rather than crashing.
 */
export async function getAgentUserId(
    knex: db.KnexReadonlyTransaction
): Promise<number | undefined> {
    const row = await db.knexRawFirst<{ id: number }>(
        knex,
        `SELECT id FROM users WHERE email = ?`,
        [AGENT_USER_EMAIL]
    )
    return row?.id
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
    const targetKey = await getCommentTargetKey(knex, {
        targetType: comment.targetType,
        targetId: comment.targetId,
    })
    const result = await db.knexRawInsert(
        knex,
        `-- sql
        INSERT INTO comments
            (targetType, targetId, targetKey, anchor, viewState, parentId, content, userId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            comment.targetType,
            comment.targetId,
            targetKey,
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
