import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { CommentViewState } from "@ourworldindata/types"
import { findAnchorElement, anchorTextForClick } from "./commentAnchors.js"
import {
    CommentPageContext,
    isSameViewState,
    readCurrentViewState,
    subscribeToUrlChanges,
} from "./commentContext.js"
import { CommentsPanel } from "./CommentsPanel.js"
import {
    CommentThreadWithTarget,
    useCommentThreadsForTargets,
} from "./useComments.js"

const ANCHOR_MODE_BODY_CLASS = "comments-anchor-mode"

interface PositionedBadge {
    anchorText: string
    count: number
    top: number
    left: number
}

/**
 * Count badges next to whatever each thread was left on. Positioned in document
 * coordinates from a portal, so the page's own React tree is never touched.
 * A thread whose text is no longer on screen simply gets no badge - it stays
 * listed in the panel instead of disappearing.
 */
function AnchorBadges({
    threads,
    viewState,
    isMultiDim,
    onSelect,
}: {
    threads: CommentThreadWithTarget[]
    viewState: CommentViewState | null
    isMultiDim: boolean
    onSelect: (anchorText: string) => void
}): React.ReactElement | null {
    const [badges, setBadges] = useState<PositionedBadge[]>([])

    const countsByAnchor = useMemo(() => {
        const counts = new Map<string, number>()
        for (const thread of threads) {
            const { anchor, resolvedAt } = thread.root
            if (!anchor || resolvedAt) continue
            if (
                isMultiDim &&
                thread.root.viewState !== null &&
                !isSameViewState(thread.root.viewState, viewState)
            )
                continue
            counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
        }
        return counts
    }, [threads, viewState, isMultiDim])

    useEffect(() => {
        let timeout: number | undefined
        // The badges live in a portal on document.body, so writing them fires
        // the observer that computed them. Only committing genuine changes
        // breaks that cycle: the pass triggered by our own render produces an
        // identical list and stops there.
        let lastSerialized = ""
        const computePositions = (): void => {
            const positioned: PositionedBadge[] = []
            for (const [anchorText, count] of countsByAnchor) {
                const element = findAnchorElement(anchorText)
                if (!element) continue
                const rect = element.getBoundingClientRect()
                positioned.push({
                    anchorText,
                    count,
                    top: rect.top + window.scrollY,
                    left: rect.right + window.scrollX + 8,
                })
            }
            const serialized = JSON.stringify(positioned)
            if (serialized === lastSerialized) return
            lastSerialized = serialized
            setBadges(positioned)
        }
        const scheduleRecompute = (): void => {
            window.clearTimeout(timeout)
            timeout = window.setTimeout(computePositions, 150)
        }
        computePositions()
        // The chart redraws asynchronously and multi-dim views swap content in
        // place, so recompute once DOM changes settle.
        const observer = new MutationObserver(scheduleRecompute)
        observer.observe(document.body, { childList: true, subtree: true })
        window.addEventListener("resize", scheduleRecompute)
        return () => {
            window.clearTimeout(timeout)
            observer.disconnect()
            window.removeEventListener("resize", scheduleRecompute)
        }
    }, [countsByAnchor])

    if (!badges.length) return null
    return createPortal(
        <>
            {badges.map((badge) => (
                <button
                    key={badge.anchorText}
                    type="button"
                    className="comments-anchor-badge"
                    style={{ top: badge.top, left: badge.left }}
                    title="Show comments left here"
                    onClick={() => onSelect(badge.anchorText)}
                >
                    {badge.count}
                </button>
            ))}
        </>,
        document.body
    )
}

export function CommentsOverlay({
    context,
}: {
    context: CommentPageContext
}): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)

    const { targets, multiDimDimensionSlugs } = context
    const isMultiDim = !!multiDimDimensionSlugs?.length

    // Re-read the view from the URL as the user changes multi-dim dimensions
    const [viewState, setViewState] = useState<CommentViewState | null>(() =>
        readCurrentViewState(context)
    )
    useEffect(() => {
        if (!isMultiDim) return undefined
        return subscribeToUrlChanges(() =>
            setViewState(readCurrentViewState(context))
        )
    }, [isMultiDim, context])

    const { threads } = useCommentThreadsForTargets(targets)
    const unresolvedCount = threads.filter(
        (thread) => !thread.root.resolvedAt
    ).length

    // With the panel open, clicking anything on the page picks it as the thing
    // to comment on. Capture phase so a click on a link or a chart control
    // becomes an anchor choice instead of navigating or changing the chart.
    const onDocumentClick = useCallback((event: MouseEvent): void => {
        const target = event.target as Element | null
        if (!target) return
        const anchorText = anchorTextForClick(target)
        if (!anchorText) return
        event.preventDefault()
        event.stopPropagation()
        setPendingAnchor(anchorText)
    }, [])

    useEffect(() => {
        if (!isOpen) return undefined
        document.body.classList.add(ANCHOR_MODE_BODY_CLASS)
        document.addEventListener("click", onDocumentClick, true)
        return () => {
            document.body.classList.remove(ANCHOR_MODE_BODY_CLASS)
            document.removeEventListener("click", onDocumentClick, true)
        }
    }, [isOpen, onDocumentClick])

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
                {unresolvedCount > 0 && (
                    <span className="comments-overlay__count">
                        {unresolvedCount}
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
                        targets={targets}
                        pendingAnchor={pendingAnchor}
                        onClearPendingAnchor={() => setPendingAnchor(null)}
                        viewState={viewState}
                        isMultiDim={isMultiDim}
                    />
                </div>
            )}
            {isOpen && (
                <AnchorBadges
                    threads={threads}
                    viewState={viewState}
                    isMultiDim={isMultiDim}
                    onSelect={setPendingAnchor}
                />
            )}
        </>
    )
}
