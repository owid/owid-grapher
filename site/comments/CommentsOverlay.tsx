import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { CommentViewState } from "@ourworldindata/types"
import { findFieldElement } from "./commentAnchors.js"
import { CommentField } from "./commentFields.js"
import {
    CommentPageContext,
    describeViewState,
    hrefForViewState,
    isSameTarget,
    isSameViewState,
    readCurrentViewState,
    subscribeToUrlChanges,
    viewStateKey,
} from "./commentContext.js"
import { CommentPopover } from "./CommentPopover.js"
import { useCommentThreadsForTargets } from "./useComments.js"
import "./Comments.scss"

const COMMENT_MODE_BODY_CLASS = "comments-mode"
const POPOVER_WIDTH = 320

/** An unresolved cluster of comments sitting on a view that isn't on screen */
interface OtherViewComments {
    key: string
    /** The view in words, e.g. "Primary school · Girls" */
    label: string
    href: string
    count: number
}

interface PlacedBubble {
    field: CommentField
    count: number
    top: number
    /** Offset from the left edge, or from the right when alignRight */
    left: number
    alignRight: boolean
}

/**
 * Where each commentable field's bubble goes, computed from the field's current
 * position on the page. Nothing wraps the fields and no component knows
 * comments exist; a field that can't be located simply gets no bubble.
 */
function useBubblePlacements(
    fields: CommentField[],
    countByKey: Map<string, number>,
    isOn: boolean
): PlacedBubble[] {
    const [placements, setPlacements] = useState<PlacedBubble[]>([])

    useEffect(() => {
        if (!isOn) {
            setPlacements([])
            return undefined
        }
        let timeout: number | undefined
        // Bubbles live in a portal on document.body, so writing them triggers
        // the observer that placed them. Committing only real changes stops
        // that feeding back on itself.
        let lastSerialized = ""
        const place = (): void => {
            const next: PlacedBubble[] = []
            for (const field of fields) {
                const element = findFieldElement(field)
                if (!element) continue
                const rect = element.getBoundingClientRect()
                if (!rect.width && !rect.height) continue
                // Fields flush to the right edge get their bubble on the left,
                // so it never lands outside the viewport
                const alignRight = window.innerWidth - rect.right < 48
                next.push({
                    field,
                    count: countByKey.get(field.key) ?? 0,
                    top: rect.top + window.scrollY,
                    left: alignRight ? 8 : rect.right + window.scrollX + 6,
                    alignRight,
                })
            }
            const serialized = JSON.stringify(
                next.map((b) => [b.field.key, b.count, b.top, b.left])
            )
            if (serialized === lastSerialized) return
            lastSerialized = serialized
            setPlacements(next)
        }
        const schedule = (): void => {
            window.clearTimeout(timeout)
            timeout = window.setTimeout(place, 150)
        }
        place()
        // The chart draws asynchronously and multi-dim views swap content in
        // place, so re-place once the DOM settles, and on resize.
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, { childList: true, subtree: true })
        window.addEventListener("resize", schedule)
        return () => {
            window.clearTimeout(timeout)
            observer.disconnect()
            window.removeEventListener("resize", schedule)
        }
    }, [fields, countByKey, isOn])

    return placements
}

export function CommentsOverlay({
    context,
}: {
    context: CommentPageContext
}): React.ReactElement {
    const [isOn, setIsOn] = useState(false)
    const [openFieldKey, setOpenFieldKey] = useState<string | null>(null)

    const { targets, fields, multiDimDimensions } = context
    const dimensions = useMemo(
        () => multiDimDimensions ?? [],
        [multiDimDimensions]
    )
    const isMultiDim = dimensions.length > 0

    const [viewState, setViewState] = useState<CommentViewState | null>(() =>
        readCurrentViewState(context)
    )
    useEffect(() => {
        if (!isMultiDim) return undefined
        return subscribeToUrlChanges(() =>
            setViewState(readCurrentViewState(context))
        )
    }, [isMultiDim, context])

    const { threads, currentUserId } = useCommentThreadsForTargets(targets)

    // A thread belongs to the view it was left on, so on a multi-dim the other
    // views' threads stay out of this one.
    const threadsHere = useMemo(
        () =>
            threads.filter(
                (thread) =>
                    !isMultiDim ||
                    thread.root.viewState === null ||
                    isSameViewState(thread.root.viewState, viewState)
            ),
        [threads, isMultiDim, viewState]
    )

    const countByKey = useMemo(() => {
        const counts = new Map<string, number>()
        for (const thread of threadsHere) {
            if (!thread.root.anchor || thread.root.resolvedAt) continue
            counts.set(
                thread.root.anchor,
                (counts.get(thread.root.anchor) ?? 0) + 1
            )
        }
        return counts
    }, [threadsHere])

    const placements = useBubblePlacements(fields, countByKey, isOn)
    const unresolvedHere = threadsHere.filter(
        (thread) => !thread.root.resolvedAt
    ).length
    // Every view's threads, since the multi-dim as a whole is what's under
    // review; the badge would otherwise read zero on a view nobody has
    // commented on yet, with no hint that the others hold anything.
    const unresolvedTotal = threads.filter(
        (thread) => !thread.root.resolvedAt
    ).length

    /**
     * Unresolved comments on the views that aren't on screen, grouped by view so
     * each one can be named and jumped to. A comment with no view (indicator
     * metadata, which every view shares) is never "elsewhere".
     */
    const otherViews: OtherViewComments[] = useMemo(() => {
        if (!isMultiDim) return []
        const byKey = new Map<string, OtherViewComments>()
        for (const { root } of threads) {
            if (root.resolvedAt || !root.viewState) continue
            if (isSameViewState(root.viewState, viewState)) continue
            const key = viewStateKey(root.viewState, dimensions)
            const existing = byKey.get(key)
            if (existing) {
                existing.count += 1
                continue
            }
            byKey.set(key, {
                key,
                label:
                    describeViewState(root.viewState, dimensions) ||
                    "Another view",
                href: hrefForViewState(
                    root.viewState,
                    dimensions,
                    window.location
                ),
                count: 1,
            })
        }
        return [...byKey.values()].sort(
            (a, b) => b.count - a.count || a.label.localeCompare(b.label)
        )
    }, [threads, isMultiDim, dimensions, viewState])

    const unresolvedElsewhere = otherViews.reduce(
        (total, view) => total + view.count,
        0
    )

    useEffect(() => {
        document.body.classList.toggle(COMMENT_MODE_BODY_CLASS, isOn)
        if (!isOn) setOpenFieldKey(null)
        return () => document.body.classList.remove(COMMENT_MODE_BODY_CLASS)
    }, [isOn])

    const open = placements.find(
        (placement) => placement.field.key === openFieldKey
    )
    // Field keys are only unique within a target - a chart and an indicator can
    // both have a "title" - so match the target as well as the key
    const threadsForOpenField = open
        ? threadsHere.filter(
              (thread) =>
                  thread.root.anchor === open.field.key &&
                  isSameTarget(thread.target, targets[open.field.targetIndex])
          )
        : []

    return (
        <>
            {isOn && otherViews.length > 0 && (
                <div className="comments-other-views">
                    <div className="comments-other-views__title">
                        {unresolvedElsewhere === 1
                            ? "1 comment on another view"
                            : `${unresolvedElsewhere} comments on other views`}
                    </div>
                    <ul className="comments-other-views__list">
                        {otherViews.map((view) => (
                            <li key={view.key}>
                                {/* A real link, not a router push: the
                                    multi-dim's router lives in another React
                                    root, and loading the view afresh is what
                                    puts its own bubbles in the right places. */}
                                <a
                                    className="comments-other-views__link"
                                    href={view.href}
                                >
                                    <span className="comments-other-views__label">
                                        {view.label}
                                    </span>
                                    <span className="comments-other-views__count">
                                        {view.count}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <button
                type="button"
                className={cx("comments-overlay__toggle", {
                    "comments-overlay__toggle--on": isOn,
                })}
                onClick={() => setIsOn(!isOn)}
                title={
                    unresolvedElsewhere > 0
                        ? `${unresolvedHere} on this view, ${unresolvedTotal} across the whole multi-dim`
                        : undefined
                }
            >
                {isOn ? "Exit comment mode" : "Comments"}
                {unresolvedTotal > 0 && (
                    <span className="comments-overlay__count">
                        {unresolvedElsewhere > 0
                            ? `${unresolvedHere} / ${unresolvedTotal}`
                            : unresolvedTotal}
                    </span>
                )}
            </button>
            {isOn &&
                createPortal(
                    <>
                        {placements.map((placement) => (
                            <button
                                key={placement.field.key}
                                type="button"
                                className={cx("comments-bubble", {
                                    "comments-bubble--has-comments":
                                        placement.count > 0,
                                    "comments-bubble--open":
                                        placement.field.key === openFieldKey,
                                })}
                                style={{
                                    top: placement.top,
                                    ...(placement.alignRight
                                        ? { right: placement.left }
                                        : { left: placement.left }),
                                }}
                                title={`Comment on ${placement.field.label}`}
                                onClick={() =>
                                    setOpenFieldKey(
                                        openFieldKey === placement.field.key
                                            ? null
                                            : placement.field.key
                                    )
                                }
                            >
                                <span aria-hidden>💬</span>
                                {placement.count > 0 && (
                                    <span className="comments-bubble__count">
                                        {placement.count}
                                    </span>
                                )}
                            </button>
                        ))}
                        {open && (
                            <CommentPopover
                                field={open.field}
                                target={targets[open.field.targetIndex]}
                                threads={threadsForOpenField}
                                currentUserId={currentUserId}
                                viewState={viewState}
                                position={{
                                    top: open.top + 30,
                                    left: open.alignRight
                                        ? open.left
                                        : Math.max(
                                              8,
                                              Math.min(
                                                  open.left,
                                                  window.innerWidth -
                                                      POPOVER_WIDTH -
                                                      16
                                              )
                                          ),
                                    alignRight: open.alignRight,
                                }}
                                onClose={() => setOpenFieldKey(null)}
                            />
                        )}
                    </>,
                    document.body
                )}
        </>
    )
}
