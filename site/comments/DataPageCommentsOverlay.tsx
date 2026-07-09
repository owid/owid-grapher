import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { createPortal } from "react-dom"
import cx from "classnames"
import { CommentTarget, CommentTargetType } from "@ourworldindata/types"
import {
    COMMENT_ANCHOR_ATTRIBUTE,
    DATA_PAGE_COMMENT_ANCHORS,
} from "./commentAnchors.js"
import { CommentsPanel } from "./CommentsPanel.js"
import { CommentThreadData, useCommentThreads } from "./useComments.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"

const ANCHOR_MODE_BODY_CLASS = "comments-anchor-mode"

/**
 * Small count badges rendered next to each anchored element that has
 * unresolved comments. They live in a portal and are positioned with document
 * coordinates, so the page's own (React-managed) DOM is never touched.
 */
function AnchorBadges({
    threads,
    onSelect,
}: {
    threads: CommentThreadData[]
    onSelect: (anchor: string) => void
}): React.ReactElement | null {
    const [badges, setBadges] = useState<
        { anchor: string; count: number; top: number; left: number }[]
    >([])

    const countsByAnchor = useMemo(() => {
        const counts = new Map<string, number>()
        for (const thread of threads) {
            if (!thread.root.anchor || thread.root.resolvedAt) continue
            counts.set(
                thread.root.anchor,
                (counts.get(thread.root.anchor) ?? 0) + 1
            )
        }
        return counts
    }, [threads])

    useEffect(() => {
        const computePositions = (): void => {
            const positioned = []
            for (const [anchor, count] of countsByAnchor) {
                const element = document.querySelector(
                    `[${COMMENT_ANCHOR_ATTRIBUTE}="${anchor}"]`
                )
                if (!element) continue
                const rect = element.getBoundingClientRect()
                positioned.push({
                    anchor,
                    count,
                    top: rect.top + window.scrollY,
                    left: rect.right + window.scrollX + 8,
                })
            }
            setBadges(positioned)
        }
        computePositions()
        window.addEventListener("resize", computePositions)
        return () => window.removeEventListener("resize", computePositions)
    }, [countsByAnchor])

    if (!badges.length) return null
    return createPortal(
        <>
            {badges.map((badge) => (
                <button
                    key={badge.anchor}
                    type="button"
                    className="comments-anchor-badge"
                    style={{ top: badge.top, left: badge.left }}
                    title="Show comments on this field"
                    onClick={() => onSelect(badge.anchor)}
                >
                    {badge.count}
                </button>
            ))}
        </>,
        document.body
    )
}

export function DataPageCommentsOverlay({
    variableId,
}: {
    variableId: number
}): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    const [activeAnchor, setActiveAnchor] = useState<string | null>(null)
    const target: CommentTarget = useMemo(
        () => ({
            targetType: CommentTargetType.Variable,
            targetId: variableId,
        }),
        [variableId]
    )
    const { data } = useCommentThreads(target)

    // While the panel is open, anchored elements become clickable to direct
    // new comments at them (visual affordance via the body class in SCSS).
    useEffect(() => {
        if (!isOpen) return undefined
        document.body.classList.add(ANCHOR_MODE_BODY_CLASS)
        const onClick = (event: MouseEvent): void => {
            const anchorElement = (event.target as Element).closest?.(
                `[${COMMENT_ANCHOR_ATTRIBUTE}]`
            )
            if (!anchorElement) return
            event.preventDefault()
            event.stopPropagation()
            setActiveAnchor(
                anchorElement.getAttribute(COMMENT_ANCHOR_ATTRIBUTE)
            )
        }
        document.addEventListener("click", onClick, true)
        return () => {
            document.body.classList.remove(ANCHOR_MODE_BODY_CLASS)
            document.removeEventListener("click", onClick, true)
        }
    }, [isOpen])

    return (
        <>
            <button
                type="button"
                className={cx("comments-overlay__toggle", {
                    "comments-overlay__toggle--open": isOpen,
                })}
                onClick={() => setIsOpen(!isOpen)}
            >
                Comments
                {data && data.unresolvedCount > 0 && (
                    <span className="comments-overlay__count">
                        {data.unresolvedCount}
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="comments-overlay__panel">
                    <div className="comments-overlay__panel-header">
                        <h3>Comments</h3>
                        <button
                            type="button"
                            className="comments-overlay__close"
                            title="Close"
                            onClick={() => setIsOpen(false)}
                        >
                            &times;
                        </button>
                    </div>
                    <CommentsPanel
                        target={target}
                        anchorLabels={DATA_PAGE_COMMENT_ANCHORS}
                        activeAnchor={activeAnchor}
                        onActiveAnchorChange={setActiveAnchor}
                    />
                </div>
            )}
            {isOpen && data && (
                <AnchorBadges
                    threads={data.threads}
                    onSelect={setActiveAnchor}
                />
            )}
        </>
    )
}

/**
 * Mounts the overlay on an admin data page preview. Loaded via dynamic import
 * from runSiteFooterScripts so none of this code (or react-query) ends up in
 * the public site chunk.
 */
export function mountDataPageCommentsOverlay(): void {
    const variableId = window._OWID_GRAPHER_CONFIG?.dimensions?.[0]?.variableId
    if (!variableId) return
    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(
        <SiteQueryClientProvider>
            <DataPageCommentsOverlay variableId={variableId} />
        </SiteQueryClientProvider>
    )
}
