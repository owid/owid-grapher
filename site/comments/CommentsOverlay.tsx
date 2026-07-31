import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { CommentViewState } from "@ourworldindata/types"
import { findFieldElement } from "./commentAnchors.js"
import { CommentField } from "./commentFields.js"
import {
    CommentPageContext,
    isSameTarget,
    isSameViewState,
    readCurrentViewState,
    subscribeToUrlChanges,
} from "./commentContext.js"
import { CommentPopover } from "./CommentPopover.js"
import { useCommentThreadsForTargets } from "./useComments.js"
import "./Comments.scss"

const COMMENT_MODE_BODY_CLASS = "comments-mode"
const POPOVER_WIDTH = 320

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

    const { targets, fields, multiDimDimensionSlugs } = context
    const isMultiDim = !!multiDimDimensionSlugs?.length

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
    const unresolved = threadsHere.filter(
        (thread) => !thread.root.resolvedAt
    ).length

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
            <button
                type="button"
                className={cx("comments-overlay__toggle", {
                    "comments-overlay__toggle--on": isOn,
                })}
                onClick={() => setIsOn(!isOn)}
            >
                {isOn ? "Exit comment mode" : "Comments"}
                {unresolved > 0 && (
                    <span className="comments-overlay__count">
                        {unresolved}
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
