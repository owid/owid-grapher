import { useEffect } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowLeft,
    faArrowRight,
    faXmark,
} from "@fortawesome/free-solid-svg-icons"

import { parseRichText } from "../core/richText.js"
import type { Walkthrough } from "../core/walkthroughs.js"

export function RichText({ text }: { text: string }) {
    return (
        <>
            {parseRichText(text).map((span, i) =>
                span.bold ? (
                    <strong key={i}>{span.text}</strong>
                ) : (
                    <span key={i}>{span.text}</span>
                )
            )}
        </>
    )
}

/** In place of the chart's header while a slide is showing */
export function SlideHeader({
    walkthrough,
    slideNumber,
    onClose,
}: {
    walkthrough: Walkthrough
    slideNumber: number
    onClose: () => void
}) {
    const slide = walkthrough.slides[slideNumber - 1]
    return (
        <header className="walkthrough-header">
            <div className="walkthrough-header__top">
                <span className="walkthrough-header__title">
                    {walkthrough.title}
                    <span className="walkthrough-header__count">
                        {slideNumber} / {walkthrough.slides.length}
                    </span>
                </span>
                <button
                    type="button"
                    className="walkthrough-header__close"
                    onClick={onClose}
                    aria-label={`Close “${walkthrough.title}”`}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            {/* Announced when the slide changes */}
            <div aria-live="polite">
                <h2 className="walkthrough-header__text">
                    <RichText text={slide.text} />
                </h2>
                {slide.secondLine && (
                    <p className="walkthrough-header__second-line">
                        <RichText text={slide.secondLine} />
                    </p>
                )}
            </div>
        </header>
    )
}

/** Back and next buttons with a dot per slide, under the chart */
export function SlideFooter({
    walkthrough,
    slideNumber,
    onGoTo,
    onClose,
}: {
    walkthrough: Walkthrough
    slideNumber: number
    onGoTo: (slide: number) => void
    onClose: () => void
}) {
    const isFirst = slideNumber === 1
    const isLast = slideNumber === walkthrough.slides.length
    return (
        <nav className="walkthrough-footer" aria-label="Walkthrough slides">
            <button
                type="button"
                className="walkthrough-footer__button"
                onClick={() => onGoTo(slideNumber - 1)}
                disabled={isFirst}
            >
                <FontAwesomeIcon icon={faArrowLeft} /> Back
            </button>
            <ol className="walkthrough-footer__dots">
                {walkthrough.slides.map((_, i) => (
                    <li key={i}>
                        <button
                            type="button"
                            className={cx("walkthrough-footer__dot", {
                                "walkthrough-footer__dot--active":
                                    i + 1 === slideNumber,
                            })}
                            aria-label={`Slide ${i + 1}`}
                            aria-current={i + 1 === slideNumber}
                            onClick={() => onGoTo(i + 1)}
                        />
                    </li>
                ))}
            </ol>
            <button
                type="button"
                className="walkthrough-footer__button walkthrough-footer__button--primary"
                onClick={isLast ? onClose : () => onGoTo(slideNumber + 1)}
            >
                {isLast ? "Explore the chart" : "Next"}{" "}
                {!isLast && <FontAwesomeIcon icon={faArrowRight} />}
            </button>
        </nav>
    )
}

/** The walkthroughs as cards in a column left of the chart */
export function WalkthroughRail({
    walkthroughs,
    activeId,
    watchedIds,
    onSelect,
}: {
    walkthroughs: Walkthrough[]
    activeId?: string
    watchedIds: ReadonlySet<string>
    onSelect: (id: string) => void
}) {
    return (
        <aside className="walkthrough-rail">
            <h2 className="walkthrough-rail__heading">Walkthroughs</h2>
            <ul className="walkthrough-rail__list">
                {walkthroughs.map((walkthrough) => (
                    <li key={walkthrough.id}>
                        <button
                            type="button"
                            className={cx("walkthrough-rail__card", {
                                "walkthrough-rail__card--active":
                                    walkthrough.id === activeId,
                            })}
                            aria-pressed={walkthrough.id === activeId}
                            onClick={() => onSelect(walkthrough.id)}
                        >
                            <span className="walkthrough-rail__title">
                                {walkthrough.title}
                            </span>
                            <span className="walkthrough-rail__description">
                                {walkthrough.description}
                            </span>
                            <span className="walkthrough-rail__meta">
                                {walkthrough.slides.length} slides
                                {watchedIds.has(walkthrough.id) && " · watched"}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    )
}

/** The walkthroughs as a row of pills above the chart, on narrow screens */
export function WalkthroughPills({
    walkthroughs,
    activeId,
    onSelect,
}: {
    walkthroughs: Walkthrough[]
    activeId?: string
    onSelect: (id: string) => void
}) {
    return (
        <div
            className="walkthrough-pills"
            role="group"
            aria-label="Walkthroughs"
        >
            {walkthroughs.map((walkthrough) => (
                <button
                    key={walkthrough.id}
                    type="button"
                    className={cx("walkthrough-pills__pill", {
                        "walkthrough-pills__pill--active":
                            walkthrough.id === activeId,
                    })}
                    aria-pressed={walkthrough.id === activeId}
                    onClick={() => onSelect(walkthrough.id)}
                >
                    {walkthrough.title}
                </button>
            ))}
        </div>
    )
}

/** Whether a key press belongs to a control: a text field or a slider */
function isOwnedByControl(event: KeyboardEvent): boolean {
    // Inside the shadow root, the event's target is retargeted to the host
    const target = event.composedPath()[0]
    if (!(target instanceof HTMLElement || target instanceof SVGElement))
        return false
    return !!target.closest(
        "input, textarea, select, [contenteditable], [role=slider]"
    )
}

/** ← and → change slides while a walkthrough is open, Escape closes it */
export function useWalkthroughKeyboard({
    isOpen,
    onPrevious,
    onNext,
    onClose,
}: {
    isOpen: boolean
    onPrevious: () => void
    onNext: () => void
    onClose: () => void
}): void {
    useEffect(() => {
        if (!isOpen) return
        const handle = (event: KeyboardEvent): void => {
            if (event.defaultPrevented || isOwnedByControl(event)) return
            if (event.altKey || event.ctrlKey || event.metaKey) return
            if (event.key === "ArrowLeft") onPrevious()
            else if (event.key === "ArrowRight") onNext()
            else if (event.key === "Escape") onClose()
            else return
            event.preventDefault()
        }
        document.addEventListener("keydown", handle)
        return () => document.removeEventListener("keydown", handle)
    }, [isOpen, onPrevious, onNext, onClose])
}
