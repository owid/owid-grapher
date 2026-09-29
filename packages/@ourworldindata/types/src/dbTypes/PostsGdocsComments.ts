export const PostsGdocsCommentThreadsTableName = "posts_gdocs_comment_threads"
export const PostsGdocsCommentsTableName = "posts_gdocs_comments"

export type PostGdocCommentThreadStatus = "open" | "resolved" | "orphaned"

export type PostGdocCommentAnchorType = "range" | "block" | "document"

export interface DbInsertPostGdocCommentThread {
    id?: number
    gdocId: string
    status?: PostGdocCommentThreadStatus
    anchorType?: PostGdocCommentAnchorType
    anchorFrom?: number | null
    anchorTo?: number | null
    anchorText?: string | null
    createdBy?: number | null
    resolvedAt?: Date | null
    resolvedBy?: number | null
}

export type DbRawPostGdocCommentThread =
    Required<DbInsertPostGdocCommentThread> & {
        createdAt: Date
    }

export interface DbInsertPostGdocComment {
    id?: number
    threadId: number
    userId?: number | null
    text: string
}

export type DbRawPostGdocComment = Required<DbInsertPostGdocComment> & {
    createdAt: Date
    updatedAt: Date
}
