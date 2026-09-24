import { useState, useRef, useEffect, useCallback } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faHandPointUp } from "@fortawesome/free-solid-svg-icons"
import GrapherImage from "./GrapherImage.js"
import { DataPerspective } from "./dataPerspectivesFixtures.js"

/**
 * Mobile-first variant (`?dpLayout=swipe`): one perspective at a time, swiped
 * through like a deck of cards. Settling on a card applies it to the live
 * grapher, so the swipe itself is the interaction — there is nothing to tap.
 *
 * A hint (animated hand + "Dig deeper") sits over the first card because a
 * swipe affordance is invisible until you know it's there. It self-dismisses
 * on the first interaction, or after a few seconds.
 */

/** How far you have to drag before it counts as a swipe, in px. */
const SWIPE_THRESHOLD = 40
/** How long the hint stays up if you don't touch anything, in ms. */
const HINT_TIMEOUT_MS = 6000

export function DataPerspectivesSwipeDeck({
    slug,
    perspectives,
    thumbQueryString,
    onSelect,
    hintLabel = "Dig deeper",
}: {
    slug: string
    perspectives: DataPerspective[]
    thumbQueryString: (queryParams: string) => string
    onSelect: (href: string, index: number) => void
    hintLabel?: string
}) {
    const [index, setIndex] = useState(0)
    const [dragPx, setDragPx] = useState(0)
    const [hintVisible, setHintVisible] = useState(true)
    const dragStartX = useRef<number | null>(null)
    const trackRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!hintVisible) return
        const t = setTimeout(() => setHintVisible(false), HINT_TIMEOUT_MS)
        return () => clearTimeout(t)
    }, [hintVisible])

    const goTo = useCallback(
        (next: number) => {
            const clamped = Math.max(0, Math.min(perspectives.length - 1, next))
            if (clamped === index) return
            setIndex(clamped)
            onSelect(
                `/grapher/${slug}?${perspectives[clamped].queryParams}`,
                clamped
            )
        },
        [index, onSelect, perspectives, slug]
    )

    const endDrag = useCallback(() => {
        if (dragStartX.current === null) return
        dragStartX.current = null
        if (Math.abs(dragPx) > SWIPE_THRESHOLD) {
            goTo(index + (dragPx < 0 ? 1 : -1))
        }
        setDragPx(0)
    }, [dragPx, goTo, index])

    const onPointerDown = (e: React.PointerEvent) => {
        setHintVisible(false)
        dragStartX.current = e.clientX
        trackRef.current?.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent) => {
        if (dragStartX.current === null) return
        setDragPx(e.clientX - dragStartX.current)
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight") goTo(index + 1)
        else if (e.key === "ArrowLeft") goTo(index - 1)
        else return
        e.preventDefault()
        setHintVisible(false)
    }

    const current = perspectives[index]

    return (
        <div className="data-perspectives-deck">
            <div
                className="data-perspectives-deck__viewport"
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onKeyDown}
                role="group"
                aria-roledescription="carousel"
                aria-label="Other ways to look at this data"
                tabIndex={0}
            >
                <div
                    className={cx("data-perspectives-deck__track", {
                        "data-perspectives-deck__track--dragging": dragPx !== 0,
                    })}
                    style={{
                        transform: `translateX(calc(${-index * 100}% + ${dragPx}px))`,
                    }}
                >
                    {perspectives.map((p, i) => (
                        <div
                            className="data-perspectives-deck__card"
                            key={p.queryParams}
                            aria-hidden={i !== index}
                        >
                            <span className="data-perspectives-deck__thumb">
                                <GrapherImage
                                    slug={slug}
                                    queryString={thumbQueryString(
                                        p.queryParams
                                    )}
                                    alt={p.title ?? "Another view of this data"}
                                    noFormatting
                                />
                            </span>
                            {p.title && (
                                <p className="data-perspectives-deck__title">
                                    {p.title}
                                </p>
                            )}
                            {p.text && (
                                <p className="data-perspectives-deck__text">
                                    {p.text}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {hintVisible && (
                    <div className="data-perspectives-deck__hint" aria-hidden>
                        <FontAwesomeIcon
                            icon={faHandPointUp}
                            className="data-perspectives-deck__hint-icon"
                        />
                        <span className="data-perspectives-deck__hint-label">
                            {hintLabel}
                        </span>
                    </div>
                )}
            </div>

            <div className="data-perspectives-deck__footer">
                <ol className="data-perspectives-deck__dots">
                    {perspectives.map((p, i) => (
                        <li key={p.queryParams}>
                            <button
                                type="button"
                                className={cx("data-perspectives-deck__dot", {
                                    "data-perspectives-deck__dot--active":
                                        i === index,
                                })}
                                aria-label={`View ${i + 1} of ${perspectives.length}${p.title ? `: ${p.title}` : ""}`}
                                aria-current={i === index || undefined}
                                onClick={() => {
                                    setHintVisible(false)
                                    goTo(i)
                                }}
                            />
                        </li>
                    ))}
                </ol>
                <p
                    className="data-perspectives-deck__counter"
                    aria-live="polite"
                >
                    {index + 1} of {perspectives.length}
                    {current?.kind === "authored" ? " · written by us" : ""}
                </p>
            </div>
        </div>
    )
}
