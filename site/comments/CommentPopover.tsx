import { useEffect, useRef } from "react"
import { CommentViewState } from "@ourworldindata/types"
import { CommentComposer } from "./CommentComposer.js"
import { CommentThread } from "./CommentThread.js"
import { CommentField } from "./commentFields.js"
import { CommentPageTarget } from "./commentContext.js"
import {
    CommentThreadWithTarget,
    useCreateComment,
    useDeleteComment,
    useSetThreadResolved,
} from "./useComments.js"

/**
 * The comments on one field, opened from that field's bubble and positioned
 * next to it. Everything happens here - reading the thread, replying,
 * resolving, adding a new comment - so commenting never means hunting through
 * a separate panel for the right field.
 */
export function CommentPopover({
    field,
    target,
    threads,
    currentUserId,
    viewState,
    position,
    onClose,
}: {
    field: CommentField
    target: CommentPageTarget
    threads: CommentThreadWithTarget[]
    currentUserId: number | undefined
    viewState: CommentViewState | null
    position: { top: number; left: number; alignRight: boolean }
    onClose: () => void
}): React.ReactElement {
    const ref = useRef<HTMLDivElement>(null)
    const createComment = useCreateComment(target)
    const setResolved = useSetThreadResolved()
    const deleteComment = useDeleteComment()

    useEffect(() => {
        const onPointerDown = (event: MouseEvent): void => {
            const node = event.target as Node
            if (ref.current?.contains(node)) return
            // The bubble toggles the popover itself; ignore it here so the two
            // handlers don't fight and immediately reopen it
            if ((node as Element).closest?.(".comments-bubble")) return
            onClose()
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") onClose()
        }
        document.addEventListener("mousedown", onPointerDown)
        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.removeEventListener("mousedown", onPointerDown)
            document.removeEventListener("keydown", onKeyDown)
        }
    }, [onClose])

    return (
        <div
            ref={ref}
            className="comments-popover"
            style={{
                top: position.top,
                ...(position.alignRight
                    ? { right: position.left }
                    : { left: position.left }),
            }}
        >
            <div className="comments-popover__header">
                <span className="comments-popover__title">{field.label}</span>
                <button
                    type="button"
                    className="comments-popover__close"
                    title="Close"
                    onClick={onClose}
                >
                    &times;
                </button>
            </div>
            {threads.length > 0 && (
                <div className="comments-popover__threads">
                    {threads.map((thread) => (
                        <CommentThread
                            key={thread.root.id}
                            thread={thread}
                            currentUserId={currentUserId ?? -1}
                            onReply={(content) =>
                                createComment.mutateAsync({
                                    content,
                                    parentId: thread.root.id,
                                })
                            }
                            onSetResolved={(resolved) =>
                                setResolved.mutate({
                                    id: thread.root.id,
                                    resolved,
                                })
                            }
                            onDeleteComment={(id) =>
                                deleteComment.mutate({ id })
                            }
                        />
                    ))}
                </div>
            )}
            <CommentComposer
                autoFocus
                placeholder={`Comment on ${field.label.toLowerCase()}...`}
                onSubmit={(content) =>
                    createComment.mutateAsync({
                        content,
                        anchor: field.key,
                        viewState,
                    })
                }
            />
        </div>
    )
}
