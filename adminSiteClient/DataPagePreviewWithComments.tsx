import * as React from "react"
import { useState, useEffect, useCallback, useContext } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faComment,
    faCheck,
    faUndo,
    faTrash,
    faTimes,
    faSpinner,
    faExternalLinkAlt,
    faPencilAlt,
} from "@fortawesome/free-solid-svg-icons"
import { DbCommentWithUser } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import { ADMIN_BASE_URL } from "../settings/clientSettings.js"

// Field definitions for data pages - these match the fields shown in KeyDataTable and AboutThisData
const COMMENTABLE_FIELDS = [
    { path: "title", label: "Title" },
    { path: "descriptionShort", label: "Short description" },
    { path: "source", label: "Source" },
    { path: "lastUpdated", label: "Last updated" },
    { path: "nextUpdate", label: "Next expected update" },
    { path: "dateRange", label: "Date range" },
    { path: "unit", label: "Unit" },
    { path: "unitConversionFactor", label: "Unit conversion factor" },
    { path: "links", label: "Links" },
    { path: "descriptionKey", label: "Key description" },
    { path: "descriptionFromProducer", label: "Description from producer" },
    { path: "descriptionProcessing", label: "Processing description" },
    { path: "faqs", label: "FAQs" },
    { path: "sourcesAndProcessing", label: "Sources & Processing" },
    { path: "citations", label: "Citations" },
    { path: "relatedResearch", label: "Research & Writing" },
    { path: "relatedCharts", label: "Related Charts" },
] as const

type FieldPath = (typeof COMMENTABLE_FIELDS)[number]["path"] | null

interface CommentFormProps {
    onSubmit: (content: string) => Promise<void>
    placeholder?: string
    submitLabel?: string
    selectedField: FieldPath
}

function CommentForm({
    onSubmit,
    placeholder = "Add a comment...",
    submitLabel = "Comment",
    selectedField,
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

    const fieldLabel = COMMENTABLE_FIELDS.find(
        (f) => f.path === selectedField
    )?.label

    return (
        <form onSubmit={handleSubmit} className="datapage-comment-form">
            {selectedField && (
                <div className="datapage-comment-form-field-indicator">
                    Commenting on: <strong>{fieldLabel}</strong>
                </div>
            )}
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                rows={3}
                disabled={isSubmitting}
            />
            <div className="datapage-comment-form-actions">
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

    const fieldLabel = COMMENTABLE_FIELDS.find(
        (f) => f.path === comment.fieldPath
    )?.label

    return (
        <div
            className={`datapage-comment-item ${isResolved ? "resolved" : ""}`}
        >
            <div className="datapage-comment-header">
                <span className="datapage-comment-author">
                    {comment.userFullName}
                </span>
                <span className="datapage-comment-time">
                    {dayjs(comment.createdAt).fromNow()}
                </span>
            </div>
            {fieldLabel && (
                <div className="datapage-comment-field">
                    <small>on: {fieldLabel}</small>
                </div>
            )}
            <div className="datapage-comment-content">{comment.content}</div>
            <div className="datapage-comment-actions">
                {!isResolved ? (
                    <button
                        className="btn btn-link btn-sm"
                        onClick={() =>
                            handleAction(() => onResolve(comment.id))
                        }
                        disabled={isActing}
                        title="Mark as resolved"
                    >
                        <FontAwesomeIcon icon={faCheck} /> Resolve
                    </button>
                ) : (
                    <button
                        className="btn btn-link btn-sm"
                        onClick={() =>
                            handleAction(() => onUnresolve(comment.id))
                        }
                        disabled={isActing}
                        title="Reopen"
                    >
                        <FontAwesomeIcon icon={faUndo} /> Reopen
                    </button>
                )}
                {isOwner && (
                    <button
                        className="btn btn-link btn-sm text-danger"
                        onClick={() =>
                            handleAction(() => onDelete(comment.id))
                        }
                        disabled={isActing}
                        title="Delete comment"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                )}
            </div>
            {isResolved && comment.resolvedByFullName && (
                <div className="datapage-comment-resolved-by">
                    <small>Resolved by {comment.resolvedByFullName}</small>
                </div>
            )}
        </div>
    )
}

export function DataPagePreviewWithComments({
    variableId,
}: {
    variableId: number
}) {
    const { admin } = useContext(AdminAppContext)
    const [comments, setComments] = useState<DbCommentWithUser[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showResolved, setShowResolved] = useState(false)
    const [selectedField, setSelectedField] = useState<FieldPath>(null)
    const [filterByField, setFilterByField] = useState<FieldPath>(null)
    const [error, setError] = useState<string | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    const previewUrl = `${ADMIN_BASE_URL}/admin/datapage-preview/${variableId}`

    const fetchComments = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                targetType: "variable",
                targetId: String(variableId),
                includeResolved: String(showResolved),
            })
            if (filterByField) {
                params.set("fieldPath", filterByField)
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
    }, [admin, variableId, filterByField, showResolved])

    useEffect(() => {
        void fetchComments()
    }, [fetchComments])

    const handleCreateComment = async (content: string) => {
        try {
            await admin.requestJSON(
                "/api/comments",
                {
                    targetType: "variable",
                    targetId: String(variableId),
                    fieldPath: selectedField,
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

    // Group comments by field for count display
    const commentsByField = comments.reduce(
        (acc, comment) => {
            const field = comment.fieldPath || "_page"
            if (!acc[field]) acc[field] = []
            acc[field].push(comment)
            return acc
        },
        {} as Record<string, DbCommentWithUser[]>
    )

    const filteredComments = filterByField
        ? comments.filter((c) => c.fieldPath === filterByField)
        : comments

    const unresolvedCount = comments.filter((c) => !c.resolvedAt).length

    return (
        <AdminLayout title={`Data Page Preview #${variableId}`}>
            <main className="DataPagePreviewWithComments">
                <div className="datapage-preview-header">
                    <h4>Data Page Preview with Comments</h4>
                    <div className="datapage-preview-header-info">
                        Variable ID: {variableId}
                    </div>
                    <div className="datapage-preview-header-actions">
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-secondary btn-sm"
                        >
                            <FontAwesomeIcon icon={faExternalLinkAlt} /> Open
                            Full Preview
                        </a>
                        <a
                            href={`/admin/variables/${variableId}`}
                            className="btn btn-outline-primary btn-sm"
                        >
                            <FontAwesomeIcon icon={faPencilAlt} /> Edit Variable
                        </a>
                        <button
                            className={`btn btn-sm ${isSidebarOpen ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        >
                            <FontAwesomeIcon icon={faComment} />
                            {unresolvedCount > 0 && (
                                <span className="badge bg-danger ms-1">
                                    {unresolvedCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                <div
                    className={`datapage-preview-content ${isSidebarOpen ? "with-sidebar" : ""}`}
                >
                    <div className="datapage-preview-iframe-container">
                        <iframe
                            src={previewUrl}
                            title="Data Page Preview"
                            className="datapage-preview-iframe"
                        />
                    </div>

                    {isSidebarOpen && (
                        <div className="datapage-preview-sidebar">
                            <div className="datapage-preview-sidebar-header">
                                <h5>
                                    <FontAwesomeIcon icon={faComment} /> Comments
                                </h5>
                                <button
                                    className="btn btn-link btn-sm"
                                    onClick={() => setIsSidebarOpen(false)}
                                    title="Close sidebar"
                                >
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>

                            <div className="datapage-preview-sidebar-controls">
                                <div className="datapage-comment-field-select">
                                    <label>Comment on field:</label>
                                    <select
                                        value={selectedField || ""}
                                        onChange={(e) =>
                                            setSelectedField(
                                                (e.target.value as FieldPath) ||
                                                    null
                                            )
                                        }
                                    >
                                        <option value="">Page-level</option>
                                        {COMMENTABLE_FIELDS.map((field) => (
                                            <option
                                                key={field.path}
                                                value={field.path}
                                            >
                                                {field.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="datapage-preview-sidebar-new">
                                <CommentForm
                                    onSubmit={handleCreateComment}
                                    selectedField={selectedField}
                                />
                            </div>

                            <div className="datapage-preview-sidebar-filter">
                                <div className="datapage-comment-field-select">
                                    <label>Filter by:</label>
                                    <select
                                        value={filterByField || ""}
                                        onChange={(e) =>
                                            setFilterByField(
                                                (e.target.value as FieldPath) ||
                                                    null
                                            )
                                        }
                                    >
                                        <option value="">All comments</option>
                                        <option value="_page">
                                            Page-level only
                                            {commentsByField["_page"]
                                                ? ` (${commentsByField["_page"].length})`
                                                : ""}
                                        </option>
                                        {COMMENTABLE_FIELDS.map((field) => (
                                            <option
                                                key={field.path}
                                                value={field.path}
                                            >
                                                {field.label}
                                                {commentsByField[field.path]
                                                    ? ` (${commentsByField[field.path].length})`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <label className="datapage-comment-show-resolved">
                                    <input
                                        type="checkbox"
                                        checked={showResolved}
                                        onChange={(e) =>
                                            setShowResolved(e.target.checked)
                                        }
                                    />{" "}
                                    Show resolved
                                </label>
                            </div>

                            <div className="datapage-preview-sidebar-list">
                                {isLoading ? (
                                    <div className="datapage-comment-loading">
                                        <FontAwesomeIcon icon={faSpinner} spin />{" "}
                                        Loading...
                                    </div>
                                ) : error ? (
                                    <div className="datapage-comment-error">
                                        {error}
                                    </div>
                                ) : filteredComments.length === 0 ? (
                                    <div className="datapage-comment-empty">
                                        No comments yet
                                    </div>
                                ) : (
                                    filteredComments.map((comment) => (
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
                    )}
                </div>
            </main>
        </AdminLayout>
    )
}
