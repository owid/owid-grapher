import { useRef, useState } from "react"
import { AGENT_MENTION, invokesAgent } from "@ourworldindata/types"
import { useMentionableUsers } from "./useComments.js"
import { mentionCandidates } from "./mentionCandidates.js"

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
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const users = useMentionableUsers()

    // What is being typed after an "@" at the caret, if anything. Picking from a
    // list is what lets a mention be a name: a name has spaces, so nobody would
    // reliably type one that matches.
    const [mentionQuery, setMentionQuery] = useState<string | null>(null)
    const suggestions =
        mentionQuery === null
            ? []
            : mentionCandidates(users, mentionQuery).slice(0, 6)

    const updateMentionQuery = (text: string, caret: number): void => {
        const before = text.slice(0, caret)
        // Only the "@" nearest the caret counts, and only while the word it
        // starts hasn't run past a plausible name
        const match = /(?:^|[^\w@])@([\w'-]*(?: [\w'-]*)?)$/.exec(before)
        setMentionQuery(match ? match[1] : null)
    }

    const insertMention = (fullName: string): void => {
        const input = inputRef.current
        const caret = input?.selectionStart ?? content.length
        const before = content.slice(0, caret)
        const at = before.lastIndexOf("@")
        if (at < 0) return
        const next = `${content.slice(0, at)}@${fullName} ${content.slice(caret)}`
        setContent(next)
        setMentionQuery(null)
        // Put the caret after the inserted name rather than at the end
        const position = at + fullName.length + 2
        requestAnimationFrame(() => {
            input?.focus()
            input?.setSelectionRange(position, position)
        })
    }

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
                ref={inputRef}
                className="comment-composer__input"
                value={content}
                onChange={(event) => {
                    setContent(event.target.value)
                    updateMentionQuery(
                        event.target.value,
                        event.target.selectionStart ?? 0
                    )
                }}
                onBlur={() => setMentionQuery(null)}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && suggestions.length) {
                        setMentionQuery(null)
                        event.stopPropagation()
                        return
                    }
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
            {suggestions.length > 0 && (
                <ul className="comment-composer__mentions">
                    {suggestions.map((user) => (
                        <li key={user.fullName}>
                            <button
                                type="button"
                                className="comment-composer__mention"
                                // mousedown, because blur would close the list
                                // before a click could land
                                onMouseDown={(event) => {
                                    // preventDefault keeps focus in the
                                    // textarea, so no blur closes the list
                                    // before this runs; stopPropagation keeps
                                    // the popover's outside-click handler out
                                    // of it entirely.
                                    event.preventDefault()
                                    event.stopPropagation()
                                    insertMention(user.fullName)
                                }}
                            >
                                {user.fullName}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {willInvokeAgent && (
                <p className="comment-composer__agent-notice">
                    Mentions {AGENT_MENTION}, so posting this will invoke it and
                    it will reply here. It can't make changes yet.
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
