import { useEffect, useRef } from "react"
import { CommentViewState } from "@ourworldindata/types"
import { CommentComposer } from "./CommentComposer.js"
import { CommentThread } from "./CommentThread.js"
import { CommentField } from "./commentFields.js"
import { CommentPageTarget, OtherViewComments } from "./commentContext.js"
import {
    CommentThreadData,
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
    otherViews,
    currentUserId,
    viewState,
    position,
    onClose,
}: {
    field: CommentField
    target: CommentPageTarget
    threads: CommentThreadData[]
    /** Other multi-dim views carrying comments on this same field */
    otherViews: OtherViewComments[]
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
            {otherViews.length > 0 && (
                // This field has been discussed on views that aren't on screen.
                // Worth saying here rather than only in the page-level list:
                // whoever is about to comment on the field probably wants to
                // read those first.
                <div className="comments-popover__other-views">
                    <div className="comments-popover__other-views-title">
                        Also commented on
                    </div>
                    <ul className="comments-popover__other-views-list">
                        {otherViews.map((view) => (
                            <li key={view.key}>
                                <a
                                    className="comments-popover__other-views-link"
                                    href={view.href}
                                >
                                    <span>{view.label}</span>
                                    <span className="comments-popover__other-views-count">
                                        {view.count}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
