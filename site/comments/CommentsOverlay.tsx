import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { CommentViewState } from "@ourworldindata/types"
import { findFieldElement } from "./commentAnchors.js"
import { CommentField } from "./commentFields.js"
import {
    CommentPageContext,
    OtherViewComments,
    groupOtherViews,
    isSameViewState,
    readCurrentViewState,
    subscribeToUrlChanges,
} from "./commentContext.js"
import { CommentPopover } from "./CommentPopover.js"
import { useCommentThreadsForTarget } from "./useComments.js"
import "./Comments.scss"

const COMMENT_MODE_BODY_CLASS = "comments-mode"
const POPOVER_WIDTH = 320
// Jumping to another view is a real navigation, and a plain reload of a preview
// is common while reviewing, so comment mode is remembered for the tab rather
// than being switched off under you.
const COMMENT_MODE_STORAGE_KEY = "owid-comments-mode"

function readStoredCommentMode(): boolean {
    try {
        return window.sessionStorage.getItem(COMMENT_MODE_STORAGE_KEY) === "1"
    } catch {
        // Storage can be unavailable (private windows, blocked cookies); comment
        // mode just doesn't persist then
        return false
    }
}

function storeCommentMode(isOn: boolean): void {
    try {
        if (isOn) window.sessionStorage.setItem(COMMENT_MODE_STORAGE_KEY, "1")
        else window.sessionStorage.removeItem(COMMENT_MODE_STORAGE_KEY)
    } catch {
        // ignore
    }
}

interface PlacedBubble {
    field: CommentField
    count: number
    /** Comments on this same field, but on other views of a multi-dim */
    elsewhereCount: number
}

/**
 * The bubbles pointing at one element, laid out in a row beside it. Several
 * fields can share an element - a data page renders the indicator's short
 * description as the chart's subtitle, so for both fields it is the same <p> -
 * and they would otherwise be placed one on top of the other.
 */
interface PlacedBubbleGroup {
    key: string
    top: number
    /** Offset from the left edge, or from the right when alignRight */
    left: number
    alignRight: boolean
    bubbles: PlacedBubble[]
}

/**
 * Where each commentable field's bubble goes, computed from the field's current
 * position on the page. Nothing wraps the fields and no component knows
 * comments exist; a field that can't be located simply gets no bubble.
 */
function useBubblePlacements(
    fields: CommentField[],
    countByKey: Map<string, number>,
    elsewhereCountByKey: Map<string, number>,
    isOn: boolean
): PlacedBubbleGroup[] {
    const [placements, setPlacements] = useState<PlacedBubbleGroup[]>([])

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
            const next: PlacedBubbleGroup[] = []
            const groupByElement = new Map<HTMLElement, PlacedBubbleGroup>()
            for (const field of fields) {
                const element = findFieldElement(field)
                if (!element) continue
                const rect = element.getBoundingClientRect()
                if (!rect.width && !rect.height) continue
                const bubble: PlacedBubble = {
                    field,
                    count: countByKey.get(field.key) ?? 0,
                    elsewhereCount: elsewhereCountByKey.get(field.key) ?? 0,
                }
                // Fields sharing an element join its group, so the row grows
                // sideways instead of the bubbles piling up
                const group = groupByElement.get(element)
                if (group) {
                    group.bubbles.push(bubble)
                    continue
                }
                // Elements flush to the right edge get their bubbles on the
                // left, so they never land outside the viewport
                const alignRight = window.innerWidth - rect.right < 48
                const created: PlacedBubbleGroup = {
                    key: field.key,
                    top: rect.top + window.scrollY,
                    left: alignRight ? 8 : rect.right + window.scrollX + 6,
                    alignRight,
                    bubbles: [bubble],
                }
                groupByElement.set(element, created)
                next.push(created)
            }
            const serialized = JSON.stringify(
                next.map((g) => [
                    g.top,
                    g.left,
                    g.bubbles.map((b) => [
                        b.field.key,
                        b.count,
                        b.elsewhereCount,
                    ]),
                ])
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
    }, [fields, countByKey, elsewhereCountByKey, isOn])

    return placements
}

export function CommentsOverlay({
    context,
}: {
    context: CommentPageContext
}): React.ReactElement {
    const [isOn, setIsOn] = useState(readStoredCommentMode)
    const [openFieldKey, setOpenFieldKey] = useState<string | null>(null)

    const { target, fields, multiDimDimensions } = context
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

    const { threads, currentUserId } = useCommentThreadsForTarget(target)

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
            const { anchor, resolvedAt } = thread.root
            if (!anchor || resolvedAt) continue
            counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
        }
        return counts
    }, [threadsHere])

    // Unresolved comments on this same field but on another view. Shown on the
    // field's own bubble, which is where you're looking when you want to know
    // whether this bit of metadata has been discussed before.
    const elsewhereCountByKey = useMemo(() => {
        const counts = new Map<string, number>()
        if (!isMultiDim) return counts
        for (const thread of threads) {
            const { anchor, resolvedAt, viewState: threadView } = thread.root
            if (resolvedAt || !anchor || !threadView) continue
            if (isSameViewState(threadView, viewState)) continue
            counts.set(anchor, (counts.get(anchor) ?? 0) + 1)
        }
        return counts
    }, [threads, isMultiDim, viewState])

    const placements = useBubblePlacements(
        fields,
        countByKey,
        elsewhereCountByKey,
        isOn
    )
    const unresolvedHere = threadsHere.filter(
        (thread) => !thread.root.resolvedAt
    ).length
    // Every view's threads, since the multi-dim as a whole is what's under
    // review; the badge would otherwise read zero on a view nobody has
    // commented on yet, with no hint that the others hold anything.
    const unresolvedTotal = threads.filter(
        (thread) => !thread.root.resolvedAt
    ).length

    /** The views that aren't on screen but hold comments, named and linkable */
    const otherViews: OtherViewComments[] = useMemo(
        () =>
            groupOtherViews(
                threads
                    .filter((thread) => !thread.root.resolvedAt)
                    .map((thread) => thread.root.viewState),
                viewState,
                dimensions,
                window.location
            ),
        [threads, dimensions, viewState]
    )

    const unresolvedElsewhere = otherViews.reduce(
        (total, view) => total + view.count,
        0
    )

    useEffect(() => {
        document.body.classList.toggle(COMMENT_MODE_BODY_CLASS, isOn)
        storeCommentMode(isOn)
        if (!isOn) setOpenFieldKey(null)
        return () => document.body.classList.remove(COMMENT_MODE_BODY_CLASS)
    }, [isOn])

    // The group holding the field being read, and the field itself
    const open = useMemo(() => {
        for (const group of placements)
            for (const bubble of group.bubbles)
                if (bubble.field.key === openFieldKey)
                    return { group, field: bubble.field }
        return undefined
    }, [placements, openFieldKey])
    // Field keys are only unique within a target - a chart and an indicator can
    // both have a "title" - so match the target as well as the key
    const threadsForOpenField = open
        ? threadsHere.filter((thread) => thread.root.anchor === open.field.key)
        : []

    // The other views that hold comments on the field being read, so the
    // popover can point at them rather than just saying a number exists
    const otherViewsForOpenField = open
        ? groupOtherViews(
              threads
                  .filter(
                      (thread) =>
                          !thread.root.resolvedAt &&
                          thread.root.anchor === open.field.key
                  )
                  .map((thread) => thread.root.viewState),
              viewState,
              dimensions,
              window.location
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
                        {placements.map((group) => (
                            <div
                                key={group.key}
                                className="comments-bubbles"
                                style={{
                                    top: group.top,
                                    ...(group.alignRight
                                        ? { right: group.left }
                                        : { left: group.left }),
                                }}
                            >
                                {group.bubbles.map((bubble) => (
                                    <button
                                        key={bubble.field.key}
                                        type="button"
                                        className={cx("comments-bubble", {
                                            "comments-bubble--has-comments":
                                                bubble.count > 0 ||
                                                bubble.elsewhereCount > 0,
                                            "comments-bubble--open":
                                                bubble.field.key ===
                                                openFieldKey,
                                        })}
                                        title={
                                            bubble.elsewhereCount > 0
                                                ? `Comment on ${bubble.field.label} — ${bubble.elsewhereCount} on other views`
                                                : `Comment on ${bubble.field.label}`
                                        }
                                        onClick={() =>
                                            setOpenFieldKey(
                                                openFieldKey ===
                                                    bubble.field.key
                                                    ? null
                                                    : bubble.field.key
                                            )
                                        }
                                    >
                                        <span aria-hidden>💬</span>
                                        {bubble.count > 0 && (
                                            <span className="comments-bubble__count">
                                                {bubble.count}
                                            </span>
                                        )}
                                        {bubble.elsewhereCount > 0 && (
                                            <span className="comments-bubble__count comments-bubble__count--other-views">
                                                +{bubble.elsewhereCount}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                        {open && (
                            <CommentPopover
                                field={open.field}
                                target={target}
                                threads={threadsForOpenField}
                                otherViews={otherViewsForOpenField}
                                currentUserId={currentUserId}
                                viewState={viewState}
                                position={{
                                    top: open.group.top + 30,
                                    left: open.group.alignRight
                                        ? open.group.left
                                        : Math.max(
                                              8,
                                              Math.min(
                                                  open.group.left,
                                                  window.innerWidth -
                                                      POPOVER_WIDTH -
                                                      16
                                              )
                                          ),
                                    alignRight: open.group.alignRight,
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
