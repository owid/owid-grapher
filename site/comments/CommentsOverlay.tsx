import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { CommentViewState } from "@ourworldindata/types"
import { fieldForClick, findFieldElement } from "./commentAnchors.js"
import { CommentField } from "./commentFields.js"
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
    key: string
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
    fields,
    viewState,
    isMultiDim,
    onSelect,
}: {
    threads: CommentThreadWithTarget[]
    fields: CommentField[]
    viewState: CommentViewState | null
    isMultiDim: boolean
    onSelect: (field: CommentField) => void
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

    const fieldsByKey = useMemo(() => {
        const map = new Map<string, CommentField>()
        for (const field of fields) map.set(field.key, field)
        return map
    }, [fields])

    useEffect(() => {
        let timeout: number | undefined
        // The badges live in a portal on document.body, so writing them fires
        // the observer that computed them. Only committing genuine changes
        // breaks that cycle: the pass triggered by our own render produces an
        // identical list and stops there.
        let lastSerialized = ""
        const computePositions = (): void => {
            const positioned: PositionedBadge[] = []
            for (const [key, count] of countsByAnchor) {
                const field = fieldsByKey.get(key)
                if (!field) continue
                const element = findFieldElement(field)
                if (!element) continue
                const rect = element.getBoundingClientRect()
                positioned.push({
                    key,
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
    }, [countsByAnchor, fieldsByKey])

    if (!badges.length) return null
    return createPortal(
        <>
            {badges.map((badge) => (
                <button
                    key={badge.key}
                    type="button"
                    className="comments-anchor-badge"
                    style={{ top: badge.top, left: badge.left }}
                    title="Show comments on this field"
                    onClick={() => {
                        const field = fieldsByKey.get(badge.key)
                        if (field) onSelect(field)
                    }}
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
    const [pendingField, setPendingField] = useState<CommentField | null>(null)

    const { targets, fields, multiDimDimensionSlugs } = context
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

    // With the panel open, clicking a metadata field picks it. Capture phase so
    // clicking a title that is also a link selects the field instead of
    // navigating. Clicks on anything that isn't a metadata field fall through
    // untouched - page furniture is not commentable.
    const onDocumentClick = useCallback(
        (event: MouseEvent): void => {
            const target = event.target as Element | null
            if (!target) return
            const field = fieldForClick(target, fields)
            if (!field) return
            event.preventDefault()
            event.stopPropagation()
            setPendingField(field)
        },
        [fields]
    )

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
                        fields={fields}
                        pendingField={pendingField}
                        onPendingFieldChange={setPendingField}
                        viewState={viewState}
                        isMultiDim={isMultiDim}
                    />
                </div>
            )}
            {isOpen && (
                <AnchorBadges
                    threads={threads}
                    fields={fields}
                    viewState={viewState}
                    isMultiDim={isMultiDim}
                    onSelect={setPendingField}
                />
            )}
        </>
    )
}
