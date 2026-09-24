import { useState, useEffect, useRef, useCallback } from "react"
import cx from "clsx"
import { createPortal } from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faHandPointUp, faRotateLeft } from "@fortawesome/free-solid-svg-icons"
import { DataPerspective } from "./dataPerspectivesFixtures.js"
import { useSwipeStage, SwipeDirection } from "./useSwipeStage.js"
import { useSwipeHint } from "./useSwipeHint.js"
import { useCookieBannerInset } from "./useCookieBannerInset.js"
import {
    DataPerspectivesStyle,
    DataPerspectivesNarrativeStale,
} from "./dataPerspectivesVariant.js"
import {
    shouldShowSwipeHint,
    recordSwipeHintShown,
    recordSwiped,
    resetSwipeHintMemory,
} from "./swipeHintMemory.js"

/**
 * Mobile variant (`?dpLayout=pageswipe`): the whole page is the swipe surface.
 * A horizontal drag anywhere moves the chart block with your finger; release
 * past the threshold and it slides off-screen, the next perspective is applied
 * while it's out of view, and it slides back in from the other side.
 *
 * Vertical drags are left to the browser, so the page still scrolls.
 */

/**
 * Only controls with their own drag behaviour keep the gesture. Links and
 * buttons don't — so a swipe can start on the chart's title or its tab
 * buttons — and the click that follows a swipe is swallowed by useSwipeStage.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return !!target.closest(
        "input, select, textarea, [draggable='true'], .slider, .timeline-component"
    )
}

export function DataPerspectivesPageSwipe({
    slug,
    perspectives,
    onSelect,
    hintDelayMs,
    hintRepeatDays,
    hintReset,
    style,
    narrativeStale = false,
    narrativeStaleMode = "hide",
    onRestoreNarrative,
    hintLabel = "Next view",
}: {
    slug: string
    perspectives: DataPerspective[]
    onSelect: (href: string, index: number) => void
    hintDelayMs: number
    hintRepeatDays: number
    hintReset: boolean
    style: DataPerspectivesStyle
    /** The reader has changed the view, so the narrative no longer fits it. */
    narrativeStale?: boolean
    /** hide: the button takes the blank title's place; disable: it follows it. */
    narrativeStaleMode?: DataPerspectivesNarrativeStale
    onRestoreNarrative?: () => void
    hintLabel?: string
}) {
    const [index, setIndex] = useState(0)
    const rootRef = useRef<HTMLDivElement | null>(null)
    // The thing that slides is the whole chart block (chart + this caption),
    // not just this component, so it reads as the perspective moving.
    const stageRef = useRef<HTMLElement | null>(null)
    const indexRef = useRef(index)
    indexRef.current = index

    // Decided once per page view: is this someone who might not know they can
    // swipe? (See swipeHintMemory for the rules.)
    const [hintEligible] = useState(() => {
        if (typeof window === "undefined") return false
        if (hintReset) resetSwipeHintMemory()
        return shouldShowSwipeHint(hintRepeatDays)
    })

    useEffect(() => {
        stageRef.current =
            rootRef.current?.closest<HTMLElement>(".chart-with-perspectives") ??
            null
        document.body.classList.add("dp-pageswipe-active")
        // In the panel and narrative styles the page goes light grey, so the
        // white panel holding the perspective + chart reads as one object.
        const greyPage = style === "panel" || style === "narrative"
        if (greyPage) document.body.classList.add("dp-page-grey")
        return () => {
            document.body.classList.remove("dp-pageswipe-active")
            document.body.classList.remove("dp-page-grey")
        }
    }, [style])

    const hint = useSwipeHint({
        stageRef,
        delayMs: hintDelayMs,
        enabled: hintEligible,
        onShow: recordSwipeHintShown,
        // The nudge demonstrates the gesture itself; the page stays still.
        peek: false,
    })

    // Pinned near the bottom of the screen — but lifted above the cookie
    // banner while it's open, because this nudge only ever shows to new
    // visitors, who are exactly the people who still have the banner up.
    const bannerInset = useCookieBannerInset(hint.visible)
    const hintBottom = bannerInset > 0 ? bannerInset + 12 : 24

    const goToIndex = useCallback(
        (next: number) => {
            setIndex(next)
            onSelect(`/grapher/${slug}?${perspectives[next].queryParams}`, next)
        },
        [onSelect, perspectives, slug]
    )

    const canGo = useCallback(
        (direction: SwipeDirection) =>
            direction === "left"
                ? indexRef.current < perspectives.length - 1
                : direction === "right"
                  ? indexRef.current > 0
                  : false,
        [perspectives.length]
    )

    const onCommit = useCallback(
        (direction: SwipeDirection) => {
            recordSwiped()
            goToIndex(indexRef.current + (direction === "left" ? 1 : -1))
        },
        [goToIndex]
    )

    const swipe = useSwipeStage({
        stageRef,
        axes: { x: true, y: false },
        canGo,
        onCommit,
        isIgnoredTarget: isInteractiveTarget,
        onInteract: hint.dismiss,
    })

    const jumpTo = (target: number) => {
        if (target === indexRef.current) return
        hint.dismiss()
        // Same motion as a swipe, in the direction of travel.
        swipe.slide(target > indexRef.current ? "left" : "right", () =>
            goToIndex(target)
        )
    }

    // Where the end of the chart title's last line is, relative to this
    // component, so the restore icon can sit right after it.
    const RESTORE_ICON_SIZE = 22
    const [restoreAt, setRestoreAt] = useState<{
        left: number
        top: number
    } | null>(null)
    useEffect(() => {
        if (!narrativeStale) {
            setRestoreAt(null)
            return
        }
        const place = () => {
            const root = rootRef.current
            const h1 = stageRef.current?.querySelector<HTMLElement>(
                ".GrapherComponent h1"
            )
            if (!root || !h1) return
            const range = document.createRange()
            range.selectNodeContents(h1)
            const lines = [...range.getClientRects()].filter((r) => r.width > 0)
            const last = lines[lines.length - 1]
            if (!last) return
            const box = root.getBoundingClientRect()
            const titleBox = h1.getBoundingClientRect()
            if (narrativeStaleMode === "hide") {
                // The title is blank space now, so the button takes its place:
                // left-aligned, on the title's first line.
                const first = lines[0]
                setRestoreAt({
                    left: titleBox.left - box.left,
                    top:
                        first.top -
                        box.top +
                        (first.height - RESTORE_ICON_SIZE) / 2,
                })
                return
            }
            const fits =
                last.right + 6 + RESTORE_ICON_SIZE <= titleBox.right + 4
            setRestoreAt(
                fits
                    ? {
                          left: last.right - box.left + 6,
                          top:
                              last.top -
                              box.top +
                              (last.height - RESTORE_ICON_SIZE) / 2,
                      }
                    : // No room on the last line: start of the next one.
                      {
                          left: titleBox.left - box.left,
                          top: last.bottom - box.top + 2,
                      }
            )
        }
        place()
        // The title changes (hide mode reverts it) and re-wraps on resize.
        const header = stageRef.current?.querySelector(".GrapherComponent")
        const observer = new MutationObserver(() =>
            requestAnimationFrame(place)
        )
        if (header)
            observer.observe(header, {
                subtree: true,
                childList: true,
                characterData: true,
            })
        window.addEventListener("resize", place)
        return () => {
            observer.disconnect()
            window.removeEventListener("resize", place)
        }
    }, [narrativeStale, narrativeStaleMode])

    const current = perspectives[index]

    return (
        <div className="data-perspectives-pageswipe" ref={rootRef}>
            {/* Dots at the very top of the perspective: the conventional
                signal that there's more to swipe through, and a way to jump. */}
            <ol className="data-perspectives-pageswipe__dots">
                {perspectives.map((p, i) => (
                    <li key={p.queryParams}>
                        <button
                            type="button"
                            className={cx("data-perspectives-pageswipe__dot", {
                                "data-perspectives-pageswipe__dot--active":
                                    i === index,
                            })}
                            aria-label={`Perspective ${i + 1} of ${perspectives.length}${p.title ? `: ${p.title}` : ""}`}
                            aria-current={i === index || undefined}
                            onClick={() => jumpTo(i)}
                        />
                    </li>
                ))}
            </ol>

            {/* No "Data perspective · 1/5" label: the dots above carry
                position. In the narrative style the chart itself carries the
                title, so there's no card at all. */}
            {style !== "narrative" && (
                <div
                    className={cx(
                        "data-perspectives-pageswipe__card",
                        `data-perspectives-pageswipe__card--${style}`
                    )}
                    aria-live="polite"
                >
                    <p className="data-perspectives-pageswipe__title">
                        {current?.title ?? "Another view of this data"}
                    </p>
                    {current?.text && (
                        <p className="data-perspectives-pageswipe__text">
                            {current.text}
                        </p>
                    )}
                </div>
            )}

            {restoreAt &&
                onRestoreNarrative && (
                    // Floated at the end of the chart's title (which grapher
                    // draws, so we measure it rather than inject into it).
                    <button
                        type="button"
                        className="data-perspectives-pageswipe__restore-icon"
                        style={{ left: restoreAt.left, top: restoreAt.top }}
                        onClick={onRestoreNarrative}
                        aria-label="Back to this view"
                        title="Back to this view"
                    >
                        <FontAwesomeIcon icon={faRotateLeft} />
                    </button>
                )}

            {hint.visible &&
                // Portalled: the chart block this sits in is transformed while
                // sliding (and `will-change: transform` makes it a containing
                // block even at rest), which would stop this being fixed.
                createPortal(
                    <div
                        className="data-perspectives-pageswipe__hint"
                        style={{ bottom: hintBottom }}
                        aria-hidden
                    >
                        <div className="data-perspectives-pageswipe__hint-body">
                            <FontAwesomeIcon
                                icon={faHandPointUp}
                                className="data-perspectives-pageswipe__hint-icon"
                            />
                            <span className="data-perspectives-pageswipe__hint-label">
                                {hintLabel}
                            </span>
                        </div>
                        {/* Drains to zero as the nudge's time runs out. */}
                        <span
                            className="data-perspectives-pageswipe__hint-timer"
                            style={
                                {
                                    "--dp-hint-duration": `${hint.visibleMs}ms`,
                                } as React.CSSProperties
                            }
                        />
                    </div>,
                    document.body
                )}
        </div>
    )
}
