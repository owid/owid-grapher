import { useContext, useState } from "react"
import { Button, Empty, Input, Space, Tag, Tooltip, Typography } from "antd"
import { Editor } from "@tiptap/core"
import { dayjs } from "@ourworldindata/utils"
import {
    RichEditorCommentThread,
    RichEditorCreateThreadRequest,
    RichEditorSelectedBlock,
} from "../../adminShared/RichEditorTypes.js"
import { AdminAppContext } from "../AdminAppContext.js"
import { addCommentMark, focusCommentThread } from "./comments.js"
import { selectionRefFromEditor } from "./selectionRef.js"

/**
 * Right-rail comments panel: start threads on the current selection (or the
 * document), reply, resolve/reopen. Range threads highlight their text in
 * the canvas; deleted anchors show up as "orphaned" instead of vanishing.
 */
export function CommentsPanel(props: {
    gdocId: string
    threads: RichEditorCommentThread[]
    editor: Editor | null
    /** Selection state, updated by the page on editor selection changes */
    hasTextSelection: boolean
    /** The block node currently selected in the canvas, if any */
    selectedBlock: RichEditorSelectedBlock | null
    onThreadsChanged: () => void
}): React.ReactElement {
    const {
        gdocId,
        threads,
        editor,
        hasTextSelection,
        selectedBlock,
        onThreadsChanged,
    } = props
    const { admin } = useContext(AdminAppContext)
    const [newComment, setNewComment] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const createThread = async (): Promise<void> => {
        if (!newComment.trim()) return
        setSubmitting(true)
        try {
            // the comment target is the current selection, captured through
            // the same SelectionRef vocabulary agents use
            const ref = editor
                ? selectionRefFromEditor(editor)
                : ({ kind: "document" } as const)
            let request: RichEditorCreateThreadRequest
            if (ref.kind === "text" && editor) {
                const { from, to } = editor.state.selection
                request = {
                    anchorType: "range",
                    anchorFrom: from,
                    anchorTo: to,
                    anchorText: ref.excerpt,
                    text: newComment,
                }
            } else if (ref.kind === "block") {
                request = {
                    anchorType: "block",
                    anchorBlockId: ref.blockId,
                    anchorText: ref.blockType,
                    text: newComment,
                }
            } else {
                request = { anchorType: "document", text: newComment }
            }
            const thread = (await admin.requestJSON(
                `/api/gdocs/${gdocId}/comments`,
                request,
                "POST"
            )) as unknown as RichEditorCommentThread
            if (
                editor &&
                request.anchorType === "range" &&
                request.anchorFrom !== null &&
                request.anchorFrom !== undefined &&
                request.anchorTo !== null &&
                request.anchorTo !== undefined
            ) {
                addCommentMark(
                    editor,
                    thread.id,
                    request.anchorFrom,
                    request.anchorTo
                )
            }
            setNewComment("")
            onThreadsChanged()
        } finally {
            setSubmitting(false)
        }
    }

    const openThreads = threads.filter((thread) => thread.status === "open")
    const orphanedThreads = threads.filter(
        (thread) => thread.status === "orphaned"
    )
    const resolvedThreads = threads.filter(
        (thread) => thread.status === "resolved"
    )

    return (
        <div className="rich-editor-rail__panel">
            <Typography.Title level={5}>Comments</Typography.Title>
            <div className="rich-editor-comments__composer">
                <Input.TextArea
                    autoSize={{ minRows: 2 }}
                    placeholder={
                        hasTextSelection
                            ? "Comment on the selected text…"
                            : selectedBlock
                              ? `Comment on the selected ${selectedBlock.blockType} block…`
                              : "Comment on this document…"
                    }
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                />
                <Button
                    type="primary"
                    size="small"
                    loading={submitting}
                    disabled={!newComment.trim()}
                    onClick={() => void createThread()}
                >
                    {hasTextSelection
                        ? "Comment on selection"
                        : selectedBlock
                          ? "Comment on block"
                          : "Comment"}
                </Button>
            </div>

            {threads.length === 0 && (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No comments yet"
                />
            )}

            {[...openThreads, ...orphanedThreads].map((thread) => (
                <ThreadCard
                    key={thread.id}
                    gdocId={gdocId}
                    thread={thread}
                    editor={editor}
                    onThreadsChanged={onThreadsChanged}
                />
            ))}

            {resolvedThreads.length > 0 && (
                <details className="rich-editor-comments__resolved">
                    <summary>
                        {resolvedThreads.length} resolved{" "}
                        {resolvedThreads.length === 1 ? "thread" : "threads"}
                    </summary>
                    {resolvedThreads.map((thread) => (
                        <ThreadCard
                            key={thread.id}
                            gdocId={gdocId}
                            thread={thread}
                            editor={editor}
                            onThreadsChanged={onThreadsChanged}
                        />
                    ))}
                </details>
            )}
        </div>
    )
}

function ThreadCard(props: {
    gdocId: string
    thread: RichEditorCommentThread
    editor: Editor | null
    onThreadsChanged: () => void
}): React.ReactElement {
    const { gdocId, thread, editor, onThreadsChanged } = props
    const { admin } = useContext(AdminAppContext)
    const [reply, setReply] = useState("")
    const [busy, setBusy] = useState(false)

    const submitReply = async (): Promise<void> => {
        if (!reply.trim()) return
        setBusy(true)
        try {
            await admin.requestJSON(
                `/api/gdocs/${gdocId}/comments/${thread.id}/replies`,
                { text: reply },
                "POST"
            )
            setReply("")
            onThreadsChanged()
        } finally {
            setBusy(false)
        }
    }

    const setStatus = async (status: "open" | "resolved"): Promise<void> => {
        setBusy(true)
        try {
            await admin.requestJSON(
                `/api/gdocs/${gdocId}/comments/${thread.id}`,
                { status },
                "PUT"
            )
            onThreadsChanged()
        } finally {
            setBusy(false)
        }
    }

    return (
        <div
            className={`rich-editor-comments__thread rich-editor-comments__thread--${thread.status}`}
        >
            <div className="rich-editor-comments__thread-header">
                <Space size="small">
                    {thread.anchorType === "block" && (
                        <Tag color="blue">{thread.anchorText ?? "block"}</Tag>
                    )}
                    {thread.status === "orphaned" && (
                        <Tooltip
                            title={
                                thread.anchorType === "block"
                                    ? "The commented block was deleted"
                                    : "The commented text was deleted"
                            }
                        >
                            <Tag color="orange">orphaned</Tag>
                        </Tooltip>
                    )}
                    {thread.status === "resolved" && <Tag>resolved</Tag>}
                </Space>
                <Space size="small">
                    {thread.status === "resolved" ? (
                        <Button
                            size="small"
                            type="text"
                            disabled={busy}
                            onClick={() => void setStatus("open")}
                        >
                            Reopen
                        </Button>
                    ) : (
                        <Button
                            size="small"
                            type="text"
                            disabled={busy}
                            onClick={() => void setStatus("resolved")}
                        >
                            Resolve
                        </Button>
                    )}
                </Space>
            </div>
            {thread.anchorText && thread.anchorType !== "block" && (
                <blockquote
                    className="rich-editor-comments__quote"
                    onClick={() => {
                        if (editor && thread.status === "open") {
                            focusCommentThread(editor, thread)
                        }
                    }}
                >
                    {thread.anchorText}
                </blockquote>
            )}
            {thread.anchorType === "block" && thread.status === "open" && (
                <Button
                    size="small"
                    type="link"
                    className="rich-editor-comments__goto-block"
                    onClick={() => {
                        if (editor) focusCommentThread(editor, thread)
                    }}
                >
                    Show block
                </Button>
            )}
            {thread.comments.map((comment) => (
                <div key={comment.id} className="rich-editor-comments__comment">
                    <span className="rich-editor-comments__author">
                        {comment.userFullName ?? "Unknown"}
                    </span>{" "}
                    <span className="rich-editor-comments__time">
                        {dayjs(comment.createdAt).format("MMM D, HH:mm")}
                    </span>
                    <p>{comment.text}</p>
                </div>
            ))}
            {thread.status !== "resolved" && (
                <div className="rich-editor-comments__reply">
                    <Input.TextArea
                        autoSize={{ minRows: 1 }}
                        placeholder="Reply…"
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                    />
                    {reply.trim() && (
                        <Button
                            size="small"
                            loading={busy}
                            onClick={() => void submitReply()}
                        >
                            Reply
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
