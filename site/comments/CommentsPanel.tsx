import { useState } from "react"
import { CommentTarget, CommentViewState } from "@ourworldindata/types"
import { CommentComposer } from "./CommentComposer.js"
import { CommentThread } from "./CommentThread.js"
import {
    useCommentThreads,
    useCreateComment,
    useDeleteComment,
    useSetThreadResolved,
} from "./useComments.js"
import "./Comments.scss"

/**
 * The one comments UI, shared by every host: the chart editor renders it
 * inside a drawer, the data page preview overlay renders it in a floating
 * panel. Hosts only decide where it lives and which anchors exist.
 */
export function CommentsPanel({
    target,
    anchorLabels,
    activeAnchor,
    onActiveAnchorChange,
    newCommentViewState,
}: {
    target: CommentTarget
    /** Labels for the anchors comments can be attached to in this host */
    anchorLabels?: Record<string, string>
    /** When set, the list is filtered to and new comments anchored to this field */
    activeAnchor?: string | null
    onActiveAnchorChange?: (anchor: string | null) => void
    /** For multi-dim hosts: the view new comments should be attached to */
    newCommentViewState?: CommentViewState | null
}): React.ReactElement {
    const [includeResolved, setIncludeResolved] = useState(false)
    const { data, isLoading, error } = useCommentThreads(target, {
        includeResolved,
    })
    const createComment = useCreateComment(target)
    const setResolved = useSetThreadResolved(target)
    const deleteComment = useDeleteComment(target)

    const threads = activeAnchor
        ? data?.threads.filter((thread) => thread.root.anchor === activeAnchor)
        : data?.threads

    return (
        <div className="comments-panel">
            <div className="comments-panel__composer">
                {activeAnchor && (
                    <div className="comments-panel__active-anchor">
                        Commenting on:{" "}
                        <strong>
                            {anchorLabels?.[activeAnchor] ?? activeAnchor}
                        </strong>
                        <button
                            type="button"
                            className="comments-panel__clear-anchor"
                            title="Comment on the page as a whole instead"
                            onClick={() => onActiveAnchorChange?.(null)}
                        >
                            &times;
                        </button>
                    </div>
                )}
                <CommentComposer
                    onSubmit={(content) =>
                        createComment.mutateAsync({
                            content,
                            anchor: activeAnchor ?? null,
                            viewState: newCommentViewState ?? null,
                        })
                    }
                />
            </div>
            <label className="comments-panel__show-resolved">
                <input
                    type="checkbox"
                    checked={includeResolved}
                    onChange={(event) =>
                        setIncludeResolved(event.target.checked)
                    }
                />{" "}
                Show resolved
            </label>
            <div className="comments-panel__threads">
                {isLoading ? (
                    <div className="comments-panel__message">Loading...</div>
                ) : error ? (
                    <div className="comments-panel__message comments-panel__message--error">
                        Failed to load comments: {error.message}
                    </div>
                ) : !threads?.length ? (
                    <div className="comments-panel__message">
                        No comments yet
                    </div>
                ) : (
                    threads.map((thread) => (
                        <CommentThread
                            key={thread.root.id}
                            thread={thread}
                            currentUserId={data!.currentUserId}
                            anchorLabel={
                                thread.root.anchor
                                    ? (anchorLabels?.[thread.root.anchor] ??
                                      thread.root.anchor)
                                    : undefined
                            }
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
                    ))
                )}
            </div>
        </div>
    )
}
