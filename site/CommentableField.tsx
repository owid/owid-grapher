import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
    useRef,
    useEffect,
} from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faComment,
    faCheck,
    faSpinner,
    faTimes,
} from "@fortawesome/free-solid-svg-icons"

// Types for the comment system
interface Comment {
    id: number
    content: string
    userFullName: string
    createdAt: string
    resolvedAt: string | null
    fieldPath: string | null
}

interface CommentContextValue {
    isCommentModeEnabled: boolean
    targetType: string
    targetId: string
    currentUserEmail: string
    adminBaseUrl: string
    comments: Comment[]
    fetchComments: () => Promise<void>
    createComment: (fieldPath: string | null, content: string) => Promise<void>
    resolveComment: (id: number) => Promise<void>
    activeFieldPath: string | null
    setActiveFieldPath: (path: string | null) => void
}

const CommentContext = createContext<CommentContextValue | null>(null)

export function useCommentContext() {
    return useContext(CommentContext)
}

interface CommentProviderProps {
    children: ReactNode
    isEnabled: boolean
    targetType: string
    targetId: string
    currentUserEmail: string
    adminBaseUrl: string
}

export function CommentProvider({
    children,
    isEnabled,
    targetType,
    targetId,
    currentUserEmail,
    adminBaseUrl,
}: CommentProviderProps) {
    const [comments, setComments] = useState<Comment[]>([])
    const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null)

    const fetchComments = useCallback(async () => {
        if (!isEnabled) return
        try {
            const params = new URLSearchParams({
                targetType,
                targetId,
                includeResolved: "false",
            })
            const response = await fetch(
                `${adminBaseUrl}/api/comments.json?${params.toString()}`,
                { credentials: "include" }
            )
            if (response.ok) {
                const data = await response.json()
                setComments(data.comments || [])
            }
        } catch (err) {
            console.error("Error fetching comments:", err)
        }
    }, [isEnabled, targetType, targetId, adminBaseUrl])

    const createComment = useCallback(
        async (fieldPath: string | null, content: string) => {
            try {
                const response = await fetch(`${adminBaseUrl}/api/comments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        targetType,
                        targetId,
                        fieldPath,
                        content,
                    }),
                })
                if (response.ok) {
                    await fetchComments()
                }
            } catch (err) {
                console.error("Error creating comment:", err)
                throw err
            }
        },
        [adminBaseUrl, targetType, targetId, fetchComments]
    )

    const resolveComment = useCallback(
        async (id: number) => {
            try {
                const response = await fetch(
                    `${adminBaseUrl}/api/comments/${id}/resolve`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: "{}",
                    }
                )
                if (response.ok) {
                    await fetchComments()
                }
            } catch (err) {
                console.error("Error resolving comment:", err)
            }
        },
        [adminBaseUrl, fetchComments]
    )

    useEffect(() => {
        if (isEnabled) {
            void fetchComments()
        }
    }, [isEnabled, fetchComments])

    const value: CommentContextValue = {
        isCommentModeEnabled: isEnabled,
        targetType,
        targetId,
        currentUserEmail,
        adminBaseUrl,
        comments,
        fetchComments,
        createComment,
        resolveComment,
        activeFieldPath,
        setActiveFieldPath,
    }

    return (
        <CommentContext.Provider value={value}>
            {children}
        </CommentContext.Provider>
    )
}

interface CommentPopoverProps {
    fieldPath: string
    fieldLabel: string
    onClose: () => void
}

function CommentPopover({
    fieldPath,
    fieldLabel,
    onClose,
}: CommentPopoverProps) {
    const ctx = useCommentContext()
    const [content, setContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const popoverRef = useRef<HTMLDivElement>(null)

    if (!ctx) return null

    const fieldComments = ctx.comments.filter((c) => c.fieldPath === fieldPath)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!content.trim()) return

        setIsSubmitting(true)
        try {
            await ctx.createComment(fieldPath, content.trim())
            setContent("")
        } finally {
            setIsSubmitting(false)
        }
    }

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node)
            ) {
                onClose()
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () =>
            document.removeEventListener("mousedown", handleClickOutside)
    }, [onClose])

    return (
        <div className="comment-popover" ref={popoverRef}>
            <div className="comment-popover-header">
                <span className="comment-popover-title">
                    Comments on: <strong>{fieldLabel}</strong>
                </span>
                <button
                    className="comment-popover-close"
                    onClick={onClose}
                    type="button"
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>

            {fieldComments.length > 0 && (
                <div className="comment-popover-list">
                    {fieldComments.map((comment) => (
                        <div key={comment.id} className="comment-popover-item">
                            <div className="comment-popover-item-header">
                                <strong>{comment.userFullName}</strong>
                            </div>
                            <div className="comment-popover-item-content">
                                {comment.content}
                            </div>
                            <button
                                className="comment-popover-resolve"
                                onClick={() => ctx.resolveComment(comment.id)}
                                type="button"
                            >
                                <FontAwesomeIcon icon={faCheck} /> Resolve
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit} className="comment-popover-form">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    disabled={isSubmitting}
                />
                <button
                    type="submit"
                    className="comment-popover-submit"
                    disabled={!content.trim() || isSubmitting}
                >
                    {isSubmitting ? (
                        <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                        "Comment"
                    )}
                </button>
            </form>
        </div>
    )
}

interface CommentableFieldProps {
    fieldPath: string
    fieldLabel: string
    children: ReactNode
}

export function CommentableField({
    fieldPath,
    fieldLabel,
    children,
}: CommentableFieldProps) {
    const ctx = useCommentContext()
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)

    // If comment mode is not enabled, just render children
    if (!ctx?.isCommentModeEnabled) {
        return <>{children}</>
    }

    const commentCount = ctx.comments.filter(
        (c) => c.fieldPath === fieldPath && !c.resolvedAt
    ).length

    return (
        <div className="commentable-field-wrapper">
            {children}
            <button
                className={`commentable-field-button ${commentCount > 0 ? "has-comments" : ""}`}
                onClick={() => setIsPopoverOpen(true)}
                title={`Comment on: ${fieldLabel}`}
                type="button"
            >
                <FontAwesomeIcon icon={faComment} />
                {commentCount > 0 && (
                    <span className="commentable-field-count">
                        {commentCount}
                    </span>
                )}
            </button>
            {isPopoverOpen && (
                <CommentPopover
                    fieldPath={fieldPath}
                    fieldLabel={fieldLabel}
                    onClose={() => setIsPopoverOpen(false)}
                />
            )}
        </div>
    )
}

// CSS styles as a string to be injected
export const COMMENT_STYLES = `
.commentable-field-wrapper {
    position: relative;
    display: inline-flex;
    align-items: flex-start;
    gap: 4px;
}

.commentable-field-button {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
    flex-shrink: 0;
}

.commentable-field-button:hover {
    background: #002147;
    color: white;
    border-color: #002147;
}

.commentable-field-button.has-comments {
    background: #fff3cd;
    border-color: #ffc107;
    color: #856404;
}

.commentable-field-button.has-comments:hover {
    background: #ffc107;
    color: #212529;
}

.commentable-field-count {
    background: #dc3545;
    color: white;
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
}

.comment-popover {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 1000;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    width: 320px;
    max-height: 400px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.comment-popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
}

.comment-popover-title {
    font-size: 13px;
    color: #333;
}

.comment-popover-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    padding: 4px;
}

.comment-popover-close:hover {
    color: #333;
}

.comment-popover-list {
    max-height: 200px;
    overflow-y: auto;
    padding: 8px;
}

.comment-popover-item {
    background: #f8f9fa;
    border-radius: 6px;
    padding: 8px 10px;
    margin-bottom: 8px;
    font-size: 13px;
}

.comment-popover-item:last-child {
    margin-bottom: 0;
}

.comment-popover-item-header {
    margin-bottom: 4px;
    font-size: 12px;
}

.comment-popover-item-content {
    color: #333;
    line-height: 1.4;
}

.comment-popover-resolve {
    background: none;
    border: none;
    color: #28a745;
    font-size: 11px;
    cursor: pointer;
    padding: 4px 0;
    margin-top: 6px;
}

.comment-popover-resolve:hover {
    text-decoration: underline;
}

.comment-popover-form {
    padding: 10px;
    border-top: 1px solid #e0e0e0;
}

.comment-popover-form textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    resize: none;
    font-family: inherit;
}

.comment-popover-form textarea:focus {
    outline: none;
    border-color: #002147;
}

.comment-popover-submit {
    margin-top: 8px;
    background: #002147;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    width: 100%;
}

.comment-popover-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.comment-popover-submit:hover:not(:disabled) {
    background: #003366;
}

/* Comment mode toggle button */
.comment-mode-toggle {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: #002147;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transition: all 0.2s ease;
}

.comment-mode-toggle:hover {
    background: #003366;
    transform: translateY(-2px);
}

.comment-mode-toggle.active {
    background: #28a745;
}

.comment-mode-toggle .badge {
    background: #dc3545;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
}
`
