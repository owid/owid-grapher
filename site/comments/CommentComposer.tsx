import { useState } from "react"

export function CommentComposer({
    onSubmit,
    placeholder = "Add a comment...",
    submitLabel = "Comment",
    autoFocus,
}: {
    onSubmit: (content: string) => Promise<unknown>
    placeholder?: string
    submitLabel?: string
    autoFocus?: boolean
}): React.ReactElement {
    const [content, setContent] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const submit = async (): Promise<void> => {
        const trimmed = content.trim()
        if (!trimmed || isSubmitting) return
        setIsSubmitting(true)
        try {
            await onSubmit(trimmed)
            setContent("")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form
            className="comment-composer"
            onSubmit={(event) => {
                event.preventDefault()
                void submit()
            }}
        >
            <textarea
                className="comment-composer__input"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
                        void submit()
                }}
                placeholder={placeholder}
                rows={3}
                disabled={isSubmitting}
                autoFocus={autoFocus}
            />
            <div className="comment-composer__actions">
                <button
                    type="submit"
                    className="comment-composer__submit"
                    disabled={!content.trim() || isSubmitting}
                >
                    {isSubmitting ? "Saving..." : submitLabel}
                </button>
            </div>
        </form>
    )
}
