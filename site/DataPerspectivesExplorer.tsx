import { useState, useEffect, useRef, useCallback } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faHandPointUp,
    faXmark,
    faArrowUp,
    faArrowLeft,
} from "@fortawesome/free-solid-svg-icons"
import { DataPerspective } from "./dataPerspectivesFixtures.js"
import { DataPerspectivesAxes } from "./dataPerspectivesVariant.js"
import { useSwipeStage, SwipeDirection } from "./useSwipeStage.js"
import { useSwipeHint } from "./useSwipeHint.js"

/**
 * Full-screen mobile shell (`?dpLayout=explorer`): the data page becomes one
 * screen with no scrolling, the metadata moves behind a button, and swiping is
 * the whole navigation model.
 *
 * Which content each axis moves through is switchable, because that's the open
 * design question:
 *   dpAxes=articles — horizontal: perspectives · vertical: related articles
 *   dpAxes=pages    — horizontal: related data pages · vertical: perspectives
 *
 * Moves within the page slide the chart out and the next view in. Moves that
 * leave the page (to an article or another data page) slide out, then navigate.
 */

/**
 * Only controls with their own drag behaviour keep the gesture. Links and
 * buttons don't — so a swipe can start on the chart's title (which is a link,
 * and in the narrative style is the headline you'd naturally swipe) — and
 * the click that follows a swipe is swallowed by useSwipeStage.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return !!target.closest(
        "input, select, textarea, [draggable='true'], .slider, .timeline-component, .dp-explorer__overlay"
    )
}

export interface ExplorerLink {
    title: string
    url: string
}

export function DataPerspectivesExplorer({
    perspectives,
    relatedArticles,
    relatedPages,
    axes,
    onSelect,
    chartSlot,
    metadataSlot,
    hintDelayMs,
}: {
    perspectives: DataPerspective[]
    relatedArticles: ExplorerLink[]
    relatedPages: ExplorerLink[]
    axes: DataPerspectivesAxes
    onSelect: (queryParams: string, index: number) => void
    chartSlot: React.ReactNode
    metadataSlot: React.ReactNode
    hintDelayMs: number
}) {
    const [index, setIndex] = useState(0)
    const [metaOpen, setMetaOpen] = useState(false)
    const [top, setTop] = useState<number | undefined>(undefined)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const indexRef = useRef(index)
    indexRef.current = index

    // Pinned to the viewport directly under the site nav, with the rest of the
    // page hidden and scrolling disabled: this is the whole screen.
    useEffect(() => {
        document.documentElement.classList.add("dp-explorer-active")
        const measure = () => {
            const nav = document.querySelector(".site-navigation")
            setTop(nav?.getBoundingClientRect().bottom ?? 0)
        }
        measure()
        window.addEventListener("resize", measure)
        return () => {
            document.documentElement.classList.remove("dp-explorer-active")
            window.removeEventListener("resize", measure)
        }
    }, [])

    const hint = useSwipeHint({ stageRef, delayMs: hintDelayMs })

    // Each axis is either "perspectives" (in place) or a list of links (leave).
    const perspectivesAxis = axes === "articles" ? "x" : "y"
    const links = axes === "articles" ? relatedArticles : relatedPages
    const nextLink = links[0]

    const axisOf = (d: SwipeDirection): "x" | "y" =>
        d === "left" || d === "right" ? "x" : "y"
    // "Forward" is left on the horizontal axis and up on the vertical one.
    const isForward = (d: SwipeDirection) => d === "left" || d === "up"

    const canGo = useCallback(
        (d: SwipeDirection) => {
            if (axisOf(d) === perspectivesAxis) {
                return isForward(d)
                    ? indexRef.current < perspectives.length - 1
                    : indexRef.current > 0
            }
            // Only forward on the links axis: there's no "previous article".
            return isForward(d) && links.length > 0
        },
        [links.length, perspectives.length, perspectivesAxis]
    )

    const onCommit = useCallback(
        (d: SwipeDirection): void | "leave" => {
            if (axisOf(d) === perspectivesAxis) {
                const next = indexRef.current + (isForward(d) ? 1 : -1)
                setIndex(next)
                onSelect(perspectives[next].queryParams, next)
                return
            }
            if (!nextLink) return
            window.location.href = nextLink.url
            return "leave"
        },
        [nextLink, onSelect, perspectives, perspectivesAxis]
    )

    useSwipeStage({
        stageRef,
        surfaceRef: rootRef,
        axes: { x: true, y: true },
        canGo,
        onCommit,
        isIgnoredTarget: isInteractiveTarget,
        onInteract: hint.dismiss,
        enabled: !metaOpen,
    })

    const current = perspectives[index]
    const perspectiveLabel = `View ${index + 1} of ${perspectives.length}`
    const linkLabel =
        nextLink?.title ??
        (axes === "articles" ? "No related writing" : "No related data")
    const xLabel = perspectivesAxis === "x" ? perspectiveLabel : linkLabel
    const yLabel = perspectivesAxis === "y" ? perspectiveLabel : linkLabel

    return (
        <div
            className="dp-explorer"
            ref={rootRef}
            style={top !== undefined ? { top } : undefined}
        >
            <div className="dp-explorer__bar">
                <span className="dp-explorer__counter">
                    {index + 1}/{perspectives.length}
                </span>
                <button
                    type="button"
                    className="dp-explorer__meta-button"
                    onClick={() => setMetaOpen(true)}
                >
                    About this data
                </button>
            </div>

            <div className="dp-explorer__stage" ref={stageRef}>
                {/* The perspective leads, above the chart, so it reads as the
                    headline of what you're looking at. */}
                <div className="dp-explorer__caption">
                    {current?.title && (
                        <p className="dp-explorer__title">{current.title}</p>
                    )}
                    {current?.text && (
                        <p className="dp-explorer__text">{current.text}</p>
                    )}
                </div>
                <div className="dp-explorer__chart">{chartSlot}</div>
            </div>

            <div className="dp-explorer__axes" aria-hidden>
                <span className="dp-explorer__axis">
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span className="dp-explorer__axis-label">{xLabel}</span>
                </span>
                <span className="dp-explorer__axis">
                    <FontAwesomeIcon icon={faArrowUp} />
                    <span className="dp-explorer__axis-label">{yLabel}</span>
                </span>
            </div>

            {hint.visible && (
                <div className="dp-explorer__hint" aria-hidden>
                    <FontAwesomeIcon
                        icon={faHandPointUp}
                        className="data-perspectives-deck__hint-icon"
                    />
                    <span className="data-perspectives-deck__hint-label">
                        Swipe to explore
                    </span>
                </div>
            )}

            {metaOpen && (
                <div className="dp-explorer__overlay" role="dialog">
                    <div className="dp-explorer__overlay-bar">
                        <button
                            type="button"
                            className="dp-explorer__close"
                            onClick={() => setMetaOpen(false)}
                            aria-label="Close"
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>
                    <div className="dp-explorer__overlay-body">
                        {metadataSlot}
                    </div>
                </div>
            )}
        </div>
    )
}
