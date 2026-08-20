import { useState } from "react"
import { AGENT_MENTION, invokesAgent } from "@ourworldindata/types"

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

    // The mention is matched anywhere in the comment, so nothing is silently
    // ignored - but the reverse surprise is real too, and someone writing about
    // the agent rather than to it deserves to know before they post. Saying so
    // here is what lets the matching stay loose.
    const willInvokeAgent = invokesAgent(content)

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
                    if (
                        event.key === "Enter" &&
                        (event.metaKey || event.ctrlKey)
                    )
                        void submit()
                }}
                placeholder={placeholder}
                rows={3}
                disabled={isSubmitting}
                autoFocus={autoFocus}
            />
            {willInvokeAgent && (
                <p className="comment-composer__agent-notice">
                    Mentions {AGENT_MENTION}, so posting this will ask it to
                    work on the field, and it will reply here.
                </p>
            )}
            <div className="comment-composer__actions">
                <button
                    type="submit"
                    className="comment-composer__submit"
                    disabled={!content.trim() || isSubmitting}
                >
                    {isSubmitting
                        ? "Saving..."
                        : willInvokeAgent
                          ? `${submitLabel} & ask ${AGENT_MENTION}`
                          : submitLabel}
                </button>
            </div>
        </form>
    )
}
