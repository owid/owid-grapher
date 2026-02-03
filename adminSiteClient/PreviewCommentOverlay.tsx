import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faComment,
    faCheck,
    faUndo,
    faTrash,
    faTimes,
    faSpinner,
} from "@fortawesome/free-solid-svg-icons"
import { CommentTargetType, DbCommentWithUser } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"

// Field definitions for data pages
const COMMENTABLE_FIELDS = [
    { path: "title", label: "Title", selector: ".key-data-description-short__title" },
    { path: "source", label: "Source", selector: ".key-data__title:contains('Source')" },
    { path: "lastUpdated", label: "Last updated", selector: ".key-data__title:contains('Last updated')" },
    { path: "nextUpdate", label: "Next expected update", selector: ".key-data__title:contains('Next expected update')" },
    { path: "dateRange", label: "Date range", selector: ".key-data__title:contains('Date range')" },
    { path: "unit", label: "Unit", selector: ".key-data__title:contains('Unit')" },
    { path: "unitConversionFactor", label: "Unit conversion factor", selector: ".key-data__title:contains('Unit conversion factor')" },
    { path: "links", label: "Links", selector: ".key-data__title:contains('Links')" },
    { path: "descriptionKey", label: "Key description", selector: ".key-info__key-description" },
    { path: "descriptionFromProducer", label: "Description from producer", selector: ".expandable-toggle__label:contains('producer')" },
] as const

type FieldPath = typeof COMMENTABLE_FIELDS[number]["path"] | null

interface CommentFormProps {
    onSubmit: (content: string) => Promise<void>
    onCancel?: () => void
    placeholder?: string
    submitLabel?: string
}

function CommentForm({
    onSubmit,
    onCancel,
    placeholder = "Add a comment...",
    submitLabel = "Comment",
}: CommentFormProps) {
    const [content, setContent] = useState("")
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
        <form onSubmit={handleSubmit} className="preview-comment-form">
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                rows={3}
                disabled={isSubmitting}
            />
            <div className="preview-comment-form-actions">
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

    const fieldLabel = COMMENTABLE_FIELDS.find(f => f.path === comment.fieldPath)?.label

    return (
        <div className={`preview-comment-item ${isResolved ? "resolved" : ""}`}>
            <div className="preview-comment-header">
                <span className="preview-comment-author">{comment.userFullName}</span>
                <span className="preview-comment-time">
                    {dayjs(comment.createdAt).fromNow()}
                </span>
            </div>
            {fieldLabel && (
                <div className="preview-comment-field">
                    <small>on: {fieldLabel}</small>
                </div>
            )}
            <div className="preview-comment-content">{comment.content}</div>
            <div className="preview-comment-actions">
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
                <div className="preview-comment-resolved-by">
                    <small>
                        Resolved by {comment.resolvedByFullName}
                    </small>
                </div>
            )}
        </div>
    )
}

interface PreviewCommentOverlayProps {
    targetType: CommentTargetType
    targetId: string
    currentUserEmail: string
    adminBaseUrl: string
}

export function PreviewCommentOverlay({
    targetType,
    targetId,
    currentUserEmail,
    adminBaseUrl,
}: PreviewCommentOverlayProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [comments, setComments] = useState<DbCommentWithUser[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResolved, setShowResolved] = useState(false)
    const [selectedField, setSelectedField] = useState<FieldPath>(null)
    const [error, setError] = useState<string | null>(null)
    const sidebarRef = useRef<HTMLDivElement>(null)

    const fetchComments = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                targetType,
                targetId,
                includeResolved: String(showResolved),
            })
            if (selectedField) {
                params.set("fieldPath", selectedField)
            }
            const response = await fetch(
                `${adminBaseUrl}/api/comments.json?${params.toString()}`,
                { credentials: "include" }
            )
            if (!response.ok) throw new Error("Failed to fetch comments")
            const data = await response.json()
            setComments(data.comments || [])
        } catch (err) {
            setError("Failed to load comments")
            console.error("Error fetching comments:", err)
        } finally {
            setIsLoading(false)
        }
    }, [adminBaseUrl, targetType, targetId, selectedField, showResolved])

    useEffect(() => {
        if (isOpen) {
            void fetchComments()
        }
    }, [isOpen, fetchComments])

    const handleCreateComment = async (content: string) => {
        try {
            const response = await fetch(`${adminBaseUrl}/api/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    targetType,
                    targetId,
                    fieldPath: selectedField,
                    content,
                }),
            })
            if (!response.ok) throw new Error("Failed to create comment")
            await fetchComments()
        } catch (err) {
            console.error("Error creating comment:", err)
            throw err
        }
    }

    const handleResolve = async (id: number) => {
        try {
            const response = await fetch(`${adminBaseUrl}/api/comments/${id}/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: "{}",
            })
            if (!response.ok) throw new Error("Failed to resolve comment")
            await fetchComments()
        } catch (err) {
            console.error("Error resolving comment:", err)
        }
    }

    const handleUnresolve = async (id: number) => {
        try {
            const response = await fetch(`${adminBaseUrl}/api/comments/${id}/unresolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: "{}",
            })
            if (!response.ok) throw new Error("Failed to unresolve comment")
            await fetchComments()
        } catch (err) {
            console.error("Error unresolving comment:", err)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this comment?")) return
        try {
            const response = await fetch(`${adminBaseUrl}/api/comments/${id}`, {
                method: "DELETE",
                credentials: "include",
            })
            if (!response.ok) throw new Error("Failed to delete comment")
            await fetchComments()
        } catch (err) {
            console.error("Error deleting comment:", err)
        }
    }

    // Group comments by field
    const commentsByField = comments.reduce((acc, comment) => {
        const field = comment.fieldPath || "_page"
        if (!acc[field]) acc[field] = []
        acc[field].push(comment)
        return acc
    }, {} as Record<string, DbCommentWithUser[]>)

    const filteredComments = selectedField
        ? comments.filter(c => c.fieldPath === selectedField)
        : comments

    return (
        <>
            {/* Floating toggle button */}
            <button
                className="preview-comment-toggle"
                onClick={() => setIsOpen(!isOpen)}
                title="Toggle comments"
            >
                <FontAwesomeIcon icon={faComment} />
                {comments.length > 0 && (
                    <span className="preview-comment-badge">{comments.length}</span>
                )}
            </button>

            {/* Sidebar */}
            {isOpen && (
                <div className="preview-comment-sidebar" ref={sidebarRef}>
                    <div className="preview-comment-sidebar-header">
                        <h4>
                            <FontAwesomeIcon icon={faComment} /> Comments
                        </h4>
                        <button
                            className="btn btn-link"
                            onClick={() => setIsOpen(false)}
                            title="Close"
                        >
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    </div>

                    <div className="preview-comment-sidebar-controls">
                        <div className="preview-comment-field-select">
                            <label>Field:</label>
                            <select
                                value={selectedField || ""}
                                onChange={(e) => setSelectedField(e.target.value as FieldPath || null)}
                            >
                                <option value="">All fields</option>
                                <option value="_page">Page-level</option>
                                {COMMENTABLE_FIELDS.map((field) => (
                                    <option key={field.path} value={field.path}>
                                        {field.label}
                                        {commentsByField[field.path]
                                            ? ` (${commentsByField[field.path].length})`
                                            : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <label className="preview-comment-show-resolved">
                            <input
                                type="checkbox"
                                checked={showResolved}
                                onChange={(e) => setShowResolved(e.target.checked)}
                            />{" "}
                            Show resolved
                        </label>
                    </div>

                    <div className="preview-comment-sidebar-new">
                        <CommentForm onSubmit={handleCreateComment} />
                    </div>

                    <div className="preview-comment-sidebar-list">
                        {isLoading ? (
                            <div className="preview-comment-loading">
                                <FontAwesomeIcon icon={faSpinner} spin /> Loading...
                            </div>
                        ) : error ? (
                            <div className="preview-comment-error">{error}</div>
                        ) : filteredComments.length === 0 ? (
                            <div className="preview-comment-empty">No comments yet</div>
                        ) : (
                            filteredComments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    currentUserEmail={currentUserEmail}
                                    onResolve={handleResolve}
                                    onUnresolve={handleUnresolve}
                                    onDelete={handleDelete}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

// Function to render the overlay into a container element
export function renderPreviewCommentOverlay(
    container: HTMLElement,
    props: PreviewCommentOverlayProps
) {
    const { createRoot } = require("react-dom/client")
    const root = createRoot(container)
    root.render(<PreviewCommentOverlay {...props} />)
    return root
}
