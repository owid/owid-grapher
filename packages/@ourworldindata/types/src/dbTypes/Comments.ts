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
 * Matches the mention anywhere in a comment - "can @claude fix this?" invokes it
 * just as "@claude fix this" does. Requiring it to open the comment would have
 * been safer against a stray run, but the failure it creates is worse: you write
 * a perfectly reasonable sentence, nothing happens, and nothing tells you why.
 * Silence is the one outcome a person can't debug.
 *
 * The composer says whether a comment will invoke the agent before it is posted,
 * so a mention that merely discusses the agent is visible as such rather than
 * being guessed at here.
 *
 * Not preceded by a word character, so an email address doesn't match, and not
 * followed by one, so "@claudette" doesn't either.
 */
const AGENT_MENTION_PATTERN = /(^|[^\w@])@claude(?![\w-])/i

/** Whether a comment asks the agent to act */
export function invokesAgent(content: string): boolean {
    return AGENT_MENTION_PATTERN.test(content)
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
