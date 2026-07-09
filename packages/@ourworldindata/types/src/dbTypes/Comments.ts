import { JsonString } from "../domainTypes/Various.js"

export const CommentsTableName = "comments"

export enum CommentTargetType {
    Chart = "chart",
    Variable = "variable",
    MultiDim = "multiDim",
}

/** Identifies the entity a comment (thread) is attached to */
export interface CommentTarget {
    targetType: CommentTargetType
    targetId: number
}

/**
 * Dimension choices identifying the multi-dim view a comment was made on,
 * e.g. { metric: "cases", frequency: "weekly" }
 */
export type CommentViewState = Record<string, string>

export interface DbInsertComment {
    id?: number
    targetType: CommentTargetType
    targetId: number
    anchor?: string | null
    viewState?: JsonString | null
    parentId?: number | null
    content: string
    userId: number
    resolvedAt?: Date | null
    resolvedByUserId?: number | null
    createdAt?: Date
    updatedAt?: Date
}

export type DbRawComment = Required<DbInsertComment>

export type DbEnrichedComment = Omit<DbRawComment, "viewState"> & {
    viewState: CommentViewState | null
}

export function parseCommentViewState(
    viewState: JsonString | null
): CommentViewState | null {
    return viewState ? JSON.parse(viewState) : null
}

export function serializeCommentViewState(
    viewState: CommentViewState | null
): JsonString | null {
    return viewState ? JSON.stringify(viewState) : null
}

export function parseCommentRow(row: DbRawComment): DbEnrichedComment {
    return { ...row, viewState: parseCommentViewState(row.viewState) }
}

export function serializeCommentRow(row: DbEnrichedComment): DbRawComment {
    return { ...row, viewState: serializeCommentViewState(row.viewState) }
}

/** A comment joined with author information, as returned by the admin API */
export type CommentWithAuthor = DbEnrichedComment & {
    authorFullName: string
    resolvedByFullName: string | null
}
