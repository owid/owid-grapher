import { useState } from "react"
import cx from "clsx"
import { CommentWithAuthor } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import { CommentComposer } from "./CommentComposer.js"
import { CommentThreadData } from "./useComments.js"

function CommentItem({
    comment,
    canDelete,
    onDelete,
}: {
    comment: CommentWithAuthor
    canDelete: boolean
    onDelete: () => void
}): React.ReactElement {
    const createdAt = dayjs(comment.createdAt)
    return (
        <div className="comment-item">
            <div className="comment-item__header">
                <span className="comment-item__author">
                    {comment.authorFullName}
                </span>
                <time className="comment-item__time" title={createdAt.format()}>
                    {createdAt.fromNow()}
                </time>
            </div>
            <div className="comment-item__content">{comment.content}</div>
            {canDelete && (
                <button
                    type="button"
                    className="comment-item__delete"
                    onClick={onDelete}
                >
                    Delete
                </button>
            )}
        </div>
    )
}

export function CommentThread({
    thread,
    currentUserId,
    anchorLabel,
    onReply,
    onSetResolved,
    onDeleteComment,
}: {
    thread: CommentThreadData
    currentUserId: number
    anchorLabel?: string
    onReply: (content: string) => Promise<unknown>
    onSetResolved: (resolved: boolean) => void
    onDeleteComment: (id: number) => void
}): React.ReactElement {
    const [isReplying, setIsReplying] = useState(false)
    const { root, replies } = thread
    const isResolved = root.resolvedAt !== null

    const deleteComment = (comment: CommentWithAuthor) => {
        if (window.confirm("Delete this comment?")) onDeleteComment(comment.id)
    }

    return (
        <div
            className={cx("comment-thread", {
                "comment-thread--resolved": isResolved,
            })}
        >
            {anchorLabel && (
                <div className="comment-thread__anchor">on: {anchorLabel}</div>
            )}
            <CommentItem
                comment={root}
                canDelete={root.userId === currentUserId}
                onDelete={() => deleteComment(root)}
            />
            {replies.map((reply) => (
                <div key={reply.id} className="comment-thread__reply">
                    <CommentItem
                        comment={reply}
                        canDelete={reply.userId === currentUserId}
                        onDelete={() => deleteComment(reply)}
                    />
                </div>
            ))}
            {isResolved && root.resolvedByFullName && (
                <div className="comment-thread__resolved-by">
                    Resolved by {root.resolvedByFullName}
                </div>
            )}
            <div className="comment-thread__actions">
                {!isResolved && (
                    <button
                        type="button"
                        className="comment-thread__action"
                        onClick={() => setIsReplying(!isReplying)}
                    >
                        Reply
                    </button>
                )}
                <button
                    type="button"
                    className="comment-thread__action"
                    onClick={() => onSetResolved(!isResolved)}
                >
                    {isResolved ? "Reopen" : "Resolve"}
                </button>
            </div>
            {isReplying && (
                <CommentComposer
                    placeholder="Reply..."
                    submitLabel="Reply"
                    autoFocus
                    onSubmit={async (content) => {
                        await onReply(content)
                        setIsReplying(false)
                    }}
                />
            )}
        </div>
    )
}
