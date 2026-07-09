import { useState } from "react"
import { Drawer } from "antd"
import { CommentTarget } from "@ourworldindata/types"
import { CommentsPanel } from "../site/comments/CommentsPanel.js"
import { useCommentThreads } from "../site/comments/useComments.js"

export function ChartEditorCommentsButton({
    target,
}: {
    target: CommentTarget
}): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    const { data } = useCommentThreads(target)
    return (
        <>
            <button
                type="button"
                className="btn btn-secondary chart-editor-comments-button"
                onClick={() => setIsOpen(true)}
            >
                Comments
                {data && data.unresolvedCount > 0
                    ? ` (${data.unresolvedCount})`
                    : ""}
            </button>
            <Drawer
                title="Comments"
                placement="right"
                open={isOpen}
                onClose={() => setIsOpen(false)}
            >
                <CommentsPanel target={target} />
            </Drawer>
        </>
    )
}
