import { JsonString } from "../domainTypes/Various.js"

export const CommentsTableName = "comments"

export type CommentTargetType = "chart" | "variable" | "multidim"

export interface DbInsertComment {
    id?: number
    targetType: CommentTargetType
    targetId: string
    viewState?: JsonString | null
    fieldPath?: string | null
    content: string
    threadId?: number | null
    userId: number
    createdAt?: Date
    updatedAt?: Date | null
    resolvedAt?: Date | null
    resolvedBy?: number | null
}

export type DbRawComment = Required<DbInsertComment>

export interface DbEnrichedComment extends Omit<DbRawComment, "viewState"> {
    viewState: Record<string, string> | null
}

export function parseCommentViewState(
    viewState: JsonString | null
): Record<string, string> | null {
    if (!viewState) return null
    return JSON.parse(viewState)
}

export function serializeCommentViewState(
    viewState: Record<string, string> | null
): JsonString | null {
    if (!viewState) return null
    return JSON.stringify(viewState)
}

export function parseCommentsRow(row: DbRawComment): DbEnrichedComment {
    return {
        ...row,
        viewState: parseCommentViewState(row.viewState),
    }
}

export function serializeCommentsRow(row: DbEnrichedComment): DbRawComment {
    return {
        ...row,
        viewState: serializeCommentViewState(row.viewState),
    }
}

export interface DbCommentWithUser extends DbEnrichedComment {
    userFullName: string
    userEmail: string
    resolvedByFullName?: string | null
}
