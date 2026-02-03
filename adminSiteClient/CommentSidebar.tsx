import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faComment,
    faCheck,
    faUndo,
    faTrash,
    faTimes,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons"
import {
    CommentTargetType,
    DbCommentWithUser,
} from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { dayjs } from "@ourworldindata/utils"

interface CommentSidebarProps {
    admin: Admin
    targetType: CommentTargetType
    targetId: string
    viewState?: Record<string, string>
    fieldPath?: string
    isOpen: boolean
    onClose: () => void
}

interface CommentFormProps {
    onSubmit: (content: string) => Promise<void>
    onCancel?: () => void
    placeholder?: string
    submitLabel?: string
    initialValue?: string
}

function CommentForm({
    onSubmit,
    onCancel,
    placeholder = "Add a comment...",
    submitLabel = "Comment",
    initialValue = "",
}: CommentFormProps) {
    const [content, setContent] = useState(initialValue)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) return

        setIsSubmitting(true)
        try {
            await onSubmit(content.trim())
            setContent("")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="comment-form">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                rows={3}
                disabled={isSubmitting}
            />
            <div className="comment-form-actions">
                {onCancel && (
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={!content.trim() || isSubmitting}
                >
                    {isSubmitting ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                        submitLabel
                    )}
                </button>
            </div>
        </form>
    )
}

interface CommentItemProps {
    comment: DbCommentWithUser
    currentUserEmail: string
    onResolve: (id: number) => Promise<void>
    onUnresolve: (id: number) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

function CommentItem({
    comment,
    currentUserEmail,
    onResolve,
    onUnresolve,
    onDelete,
}: CommentItemProps) {
    const [isActing, setIsActing] = useState(false)
    const isOwner = comment.userEmail === currentUserEmail
    const isResolved = !!comment.resolvedAt

    const handleAction = async (action: () => Promise<void>) => {
        setIsActing(true)
        try {
            await action()
        } finally {
            setIsActing(false)
        }
    }

    return (
        <div className={`comment-item ${isResolved ? "resolved" : ""}`}>
            <div className="comment-header">
                <span className="comment-author">{comment.userFullName}</span>
                <span className="comment-time">
                    {dayjs(comment.createdAt).fromNow()}
                </span>
            </div>
            {comment.fieldPath && (
                <div className="comment-field-path">
                    <small>on: {comment.fieldPath}</small>
                </div>
            )}
            <div className="comment-content">{comment.content}</div>
            <div className="comment-actions">
                {!isResolved ? (
                    <button
                        className="btn btn-link btn-sm"
                        onClick={() => handleAction(() => onResolve(comment.id))}
                        disabled={isActing}
                        title="Mark as resolved"
                    >
                        <FontAwesomeIcon icon={faCheck} /> Resolve
                    </button>
                ) : (
                    <button
                        className="btn btn-link btn-sm"
                        onClick={() => handleAction(() => onUnresolve(comment.id))}
                        disabled={isActing}
                        title="Reopen"
                    >
                        <FontAwesomeIcon icon={faUndo} /> Reopen
                    </button>
                )}
                {isOwner && (
                    <button
                        className="btn btn-link btn-sm text-danger"
                        onClick={() => handleAction(() => onDelete(comment.id))}
                        disabled={isActing}
                        title="Delete comment"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                )}
            </div>
            {isResolved && comment.resolvedByFullName && (
                <div className="comment-resolved-by">
                    <small>
                        Resolved by {comment.resolvedByFullName}
                    </small>
                </div>
            )}
        </div>
    )
}

export function CommentSidebar({
    admin,
    targetType,
    targetId,
    viewState,
    fieldPath,
    isOpen,
    onClose,
}: CommentSidebarProps) {
    const [comments, setComments] = useState<DbCommentWithUser[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResolved, setShowResolved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchComments = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                targetType,
                targetId,
                includeResolved: String(showResolved),
            })
            if (viewState) {
                params.set("viewState", JSON.stringify(viewState))
            }
            if (fieldPath) {
                params.set("fieldPath", fieldPath)
            }
            const response = await admin.getJSON(
                `/api/comments.json?${params.toString()}`
            )
            setComments(response.comments || [])
        } catch (err) {
            setError("Failed to load comments")
            console.error("Error fetching comments:", err)
        } finally {
            setIsLoading(false)
        }
    }, [admin, targetType, targetId, viewState, fieldPath, showResolved])

    useEffect(() => {
        if (isOpen) {
            void fetchComments()
        }
    }, [isOpen, fetchComments])

    const handleCreateComment = async (content: string) => {
        try {
            await admin.requestJSON(
                "/api/comments",
                {
                    targetType,
                    targetId,
                    viewState,
                    fieldPath,
                    content,
                },
                "POST"
            )
            await fetchComments()
        } catch (err) {
            console.error("Error creating comment:", err)
            throw err
        }
    }

    const handleResolve = async (id: number) => {
        try {
            await admin.requestJSON(`/api/comments/${id}/resolve`, {}, "POST")
            await fetchComments()
        } catch (err) {
            console.error("Error resolving comment:", err)
        }
    }

    const handleUnresolve = async (id: number) => {
        try {
            await admin.requestJSON(`/api/comments/${id}/unresolve`, {}, "POST")
            await fetchComments()
        } catch (err) {
            console.error("Error unresolving comment:", err)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this comment?")) return
        try {
            await admin.requestJSON(`/api/comments/${id}`, {}, "DELETE")
            await fetchComments()
        } catch (err) {
            console.error("Error deleting comment:", err)
        }
    }

    if (!isOpen) return null

    return (
        <div className="comment-sidebar">
            <div className="comment-sidebar-header">
                <h4>
                    <FontAwesomeIcon icon={faComment} /> Comments
                </h4>
                <button
                    className="btn btn-link"
                    onClick={onClose}
                    title="Close"
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>

            <div className="comment-sidebar-controls">
                <label>
                    <input
                        type="checkbox"
                        checked={showResolved}
                        onChange={(e) => setShowResolved(e.target.checked)}
                    />{" "}
                    Show resolved
                </label>
            </div>

            <div className="comment-sidebar-new">
                <CommentForm onSubmit={handleCreateComment} />
            </div>

            <div className="comment-sidebar-list">
                {isLoading ? (
                    <div className="comment-loading">
                        <FontAwesomeIcon icon={faSpinner} spin /> Loading...
                    </div>
                ) : error ? (
                    <div className="comment-error">{error}</div>
                ) : comments.length === 0 ? (
                    <div className="comment-empty">No comments yet</div>
                ) : (
                    comments.map((comment) => (
                        <CommentItem
                            key={comment.id}
                            comment={comment}
                            currentUserEmail={admin.email}
                            onResolve={handleResolve}
                            onUnresolve={handleUnresolve}
                            onDelete={handleDelete}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

export function CommentToggleButton({
    onClick,
    commentCount = 0,
}: {
    onClick: () => void
    commentCount?: number
}) {
    return (
        <button
            className="comment-toggle-btn btn btn-outline-secondary"
            onClick={onClick}
            title="Toggle comments"
        >
            <FontAwesomeIcon icon={faComment} />
            {commentCount > 0 && (
                <span className="comment-badge">{commentCount}</span>
            )}
        </button>
    )
}
