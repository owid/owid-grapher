import { JsonString } from "../domainTypes/Various.js"

export const CommentsTableName = "comments"

/**
 * A comment is always attached to something a reader sees: a chart or a
 * multi-dim view. Indicators are deliberately not commentable - metadata is
 * commented on as the chart presents it, and working out that a value comes
 * from an indicator is left to whoever triages the comment.
 */
export enum CommentTargetType {
    Chart = "chart",
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

/** How a comment asks the agent to act */
export const AGENT_MENTION = "@claude"

/**
 * The instruction in a comment that invokes the agent, or null if it doesn't.
 *
 * Deliberately strict: the mention has to open the comment. Someone writing "I
 * think @claude got this wrong" is discussing the agent, not summoning it, and a
 * comment box that spends money and opens pull requests on a substring match is
 * a trap. Opening with the mention is a thing you can only do on purpose.
 */
export function parseAgentInvocation(content: string): string | null {
    const trimmed = content.trimStart()
    if (!trimmed.toLowerCase().startsWith(AGENT_MENTION)) return null
    const instruction = trimmed.slice(AGENT_MENTION.length)
    // Require a break after the mention so "@claudette" isn't a match
    if (instruction && !/^[\s,:.!?]/.test(instruction)) return null
    // Drop whatever separates the mention from the instruction
    return instruction.replace(/^[\s,:.!?]+/, "").trim()
}

export interface DbInsertComment {
    id?: number
    targetType: CommentTargetType
    targetId: number
    /** Portable identity of the target, resolved when the comment is written */
    targetKey?: string | null
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
