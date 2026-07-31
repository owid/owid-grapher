import { useState } from "react"
import { CommentViewState } from "@ourworldindata/types"
import { CommentComposer } from "./CommentComposer.js"
import { CommentThread } from "./CommentThread.js"
import { CommentField } from "./commentFields.js"
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
 * Comments list and composer. A comment always names the metadata field it is
 * about, picked either by clicking the field on the page or from this list, so
 * it survives both the value being edited and the page being laid out
 * differently.
 */
export function CommentsPanel({
    targets,
    fields,
    pendingField,
    onPendingFieldChange,
    viewState,
    isMultiDim,
}: {
    targets: CommentPageTarget[]
    fields: CommentField[]
    pendingField: CommentField | null
    onPendingFieldChange: (field: CommentField | null) => void
    viewState: CommentViewState | null
    isMultiDim: boolean
}): React.ReactElement {
    const [includeResolved, setIncludeResolved] = useState(false)
    const { threads, currentUserId, isLoading, error } =
        useCommentThreadsForTargets(targets, { includeResolved })

    const composerTarget = pendingField
        ? targets[pendingField.targetIndex]
        : targets[0]
    const createComment = useCreateComment(composerTarget)
    const setResolved = useSetThreadResolved()
    const deleteComment = useDeleteComment()

    const labelForKey = (key: string): string =>
        fields.find((field) => field.key === key)?.label ?? key

    // On a multi-dim a thread belongs to the view it was left on; showing all
    // of them would mix up views, so filter and report the rest.
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
                <label className="comments-panel__field-picker">
                    Comment on:{" "}
                    <select
                        value={pendingField?.key ?? ""}
                        onChange={(event) =>
                            onPendingFieldChange(
                                fields.find(
                                    (field) => field.key === event.target.value
                                ) ?? null
                            )
                        }
                    >
                        <option value="">This page as a whole</option>
                        {fields.map((field) => (
                            <option key={field.key} value={field.key}>
                                {field.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="comments-panel__hint">
                    Or click a metadata field on the page to pick it.
                </div>
                <CommentComposer
                    onSubmit={(content) =>
                        createComment.mutateAsync({
                            content,
                            anchor: pendingField?.key ?? null,
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
                                    ? labelForKey(thread.root.anchor)
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
