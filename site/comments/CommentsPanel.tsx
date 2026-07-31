import { useState } from "react"
import { CommentViewState } from "@ourworldindata/types"
import { CommentComposer } from "./CommentComposer.js"
import { CommentThread } from "./CommentThread.js"
import { anchorLabel } from "./commentAnchors.js"
import {
    CommentPageTarget,
    isSameTarget,
    isSameViewState,
} from "./commentContext.js"
import {
    CommentThreadWithTarget,
    useCommentThreadsForTargets,
    useCreateComment,
    useDeleteComment,
    useSetThreadResolved,
} from "./useComments.js"
import "./Comments.scss"

/**
 * The comments list and composer. Knows nothing about where the page put its
 * fields: threads are identified by the text they were left on, which the
 * overlay supplies.
 */
export function CommentsPanel({
    targets,
    pendingAnchor,
    onClearPendingAnchor,
    viewState,
    isMultiDim,
}: {
    /** Everything this page shows comments for; the first receives new ones */
    targets: CommentPageTarget[]
    /** Quoted text a new comment will be attached to, if the user picked one */
    pendingAnchor: string | null
    onClearPendingAnchor: () => void
    /** Current multi-dim view; new comments record it, the list filters by it */
    viewState: CommentViewState | null
    isMultiDim: boolean
}): React.ReactElement {
    const [includeResolved, setIncludeResolved] = useState(false)
    const { threads, currentUserId, isLoading, error } =
        useCommentThreadsForTargets(targets, { includeResolved })
    const createComment = useCreateComment(targets[0])
    const setResolved = useSetThreadResolved()
    const deleteComment = useDeleteComment()

    // On a multi-dim a thread belongs to the view it was left on. Showing all
    // of them would put comments about one view's subtitle next to a different
    // view's, so filter — but say how many are elsewhere, or they get lost.
    const belongsToCurrentView = (thread: CommentThreadWithTarget): boolean =>
        !isMultiDim ||
        thread.root.viewState === null ||
        isSameViewState(thread.root.viewState, viewState)
    const visibleThreads = threads.filter(belongsToCurrentView)
    const otherViewCount = threads.length - visibleThreads.length

    const showTargetLabels = targets.length > 1

    return (
        <div className="comments-panel">
            <div className="comments-panel__composer">
                {pendingAnchor ? (
                    <div className="comments-panel__active-anchor">
                        Commenting on: <q>{anchorLabel(pendingAnchor)}</q>
                        <button
                            type="button"
                            className="comments-panel__clear-anchor"
                            title="Comment on the page as a whole instead"
                            onClick={onClearPendingAnchor}
                        >
                            &times;
                        </button>
                    </div>
                ) : (
                    <div className="comments-panel__hint">
                        Click anything on the page to comment on it, or write a
                        note about the page below.
                    </div>
                )}
                <CommentComposer
                    onSubmit={(content) =>
                        createComment.mutateAsync({
                            content,
                            anchor: pendingAnchor,
                            viewState,
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
                ) : !visibleThreads.length ? (
                    <div className="comments-panel__message">
                        No comments yet
                    </div>
                ) : (
                    visibleThreads.map((thread) => (
                        <CommentThread
                            key={`${thread.target.targetType}-${thread.root.id}`}
                            thread={thread}
                            currentUserId={currentUserId ?? -1}
                            anchorLabel={
                                thread.root.anchor
                                    ? anchorLabel(thread.root.anchor)
                                    : undefined
                            }
                            targetLabel={
                                showTargetLabels &&
                                !isSameTarget(thread.target, targets[0])
                                    ? thread.target.label
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
                {otherViewCount > 0 && (
                    <div className="comments-panel__other-views">
                        {otherViewCount === 1
                            ? "1 comment on another view of this page"
                            : `${otherViewCount} comments on other views of this page`}
                    </div>
                )}
            </div>
        </div>
    )
}
