import cx from "clsx"
import {
    faChevronLeft,
    faChevronRight,
    faLightbulb,
    faXmark,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import { parseRichText } from "../core/richText.js"

/**
 * A walkthrough sentence with its emphasis: bold, italic, and the entities
 * it names in their series colour (when the chart draws them)
 */
export function RichText({
    text,
    entityColors,
}: {
    /** With the markers parseRichText reads */
    text: string
    entityColors?: ReadonlyMap<string, string>
}): React.ReactElement {
    return (
        <>
            {parseRichText(text).map((segment, i) => {
                const color = segment.entity
                    ? entityColors?.get(segment.entity)
                    : undefined
                if (!segment.bold && !segment.italic && !color)
                    return segment.text
                const content = color ? (
                    <span
                        className="income-distribution-tutorial__entity"
                        style={{ color: darkenColorForText(color) }}
                    >
                        {segment.text}
                    </span>
                ) : (
                    segment.text
                )
                const emphasised = segment.italic ? <em>{content}</em> : content
                return segment.bold ? (
                    <strong key={i}>{emphasised}</strong>
                ) : (
                    <span key={i}>{emphasised}</span>
                )
            })}
        </>
    )
}

/** "TIP", "INSIGHT" or a walkthrough's title, small caps after a lightbulb */
export function WalkthroughLabel({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}): React.ReactElement {
    return (
        <span className={cx("income-distribution-tutorial-label", className)}>
            <FontAwesomeIcon
                icon={faLightbulb}
                className="income-distribution-tutorial-label__icon"
                aria-hidden
            />
            {children}
        </span>
    )
}

/** What one slide's header says */
export interface SlideHeaderPage {
    /** `<walkthrough id>:<slide>` */
    key: string
    walkthroughTitle: string
    text: string
    secondLine?: string
    /** Narrow charts only: the aside goes here rather than over the plot */
    aside?: string
    /** Narrow charts only: the slide's control, below the text */
    controls?: React.ReactNode
}

/**
 * Takes the chart header's place while a walkthrough plays: its title, the
 * slide's sentence and a second line, and a × that closes the walkthrough.
 *
 * Every slide's header is laid out in the same grid cell and only the
 * current one is shown, so the header is as tall as the tallest of them at
 * any width: the chart and the slide buttons below it never move as the
 * slides change.
 */
export function SlideHeader({
    pages,
    currentKey,
    entityColors,
    closeLabel,
    onClose,
}: {
    pages: SlideHeaderPage[]
    currentKey: string
    entityColors: ReadonlyMap<string, string>
    closeLabel: string
    onClose: () => void
}): React.ReactElement {
    return (
        <div className="income-distribution-tutorial-slide-header">
            <div className="income-distribution-tutorial-slide-header__pages">
                {pages.map((page) => {
                    const isCurrent = page.key === currentKey
                    return (
                        <div
                            key={page.key}
                            className={cx(
                                "income-distribution-tutorial-slide-header__page",
                                {
                                    "income-distribution-tutorial-slide-header__page--hidden":
                                        !isCurrent,
                                }
                            )}
                            aria-hidden={isCurrent ? undefined : true}
                            inert={!isCurrent}
                        >
                            <WalkthroughLabel>
                                {page.walkthroughTitle}
                            </WalkthroughLabel>
                            {/* Announced as each slide comes in */}
                            <div aria-live={isCurrent ? "polite" : undefined}>
                                <p className="income-distribution-tutorial-slide-header__text">
                                    <RichText
                                        text={page.text}
                                        entityColors={entityColors}
                                    />
                                </p>
                                {page.secondLine && (
                                    <p className="income-distribution-tutorial-slide-header__second-line">
                                        <RichText
                                            text={page.secondLine}
                                            entityColors={entityColors}
                                        />
                                    </p>
                                )}
                                {page.aside && (
                                    <p className="income-distribution-tutorial-slide-header__aside">
                                        <RichText
                                            text={page.aside}
                                            entityColors={entityColors}
                                        />
                                    </p>
                                )}
                            </div>
                            {page.controls && (
                                <div className="income-distribution-tutorial-slide-header__controls">
                                    {page.controls}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
            <button
                type="button"
                className="income-distribution-tutorial-round-button income-distribution-tutorial-round-button--outline income-distribution-tutorial-slide-header__close"
                aria-label={closeLabel}
                onClick={onClose}
            >
                <FontAwesomeIcon icon={faXmark} aria-hidden />
            </button>
        </div>
    )
}

interface SlideNavProps {
    /** 1-based */
    slide: number
    slideCount: number
    onPrevious: () => void
    onNext: () => void
    onClose: () => void
}

function PreviousButton({
    slide,
    onPrevious,
    className,
}: Pick<SlideNavProps, "slide" | "onPrevious"> & {
    className?: string
}): React.ReactElement {
    return (
        <button
            type="button"
            className={cx(
                "income-distribution-tutorial-round-button",
                className
            )}
            aria-label="Previous slide"
            disabled={slide <= 1}
            onClick={onPrevious}
        >
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden />
        </button>
    )
}

/** The next slide, or × on the last one, which closes the walkthrough */
function NextButton({
    slide,
    slideCount,
    onNext,
    onClose,
    className,
}: Pick<SlideNavProps, "slide" | "slideCount" | "onNext" | "onClose"> & {
    className?: string
}): React.ReactElement {
    const isLast = slide >= slideCount
    return (
        <button
            type="button"
            className={cx(
                "income-distribution-tutorial-round-button",
                "income-distribution-tutorial-round-button--next",
                className
            )}
            aria-label={isLast ? "Close walkthrough" : "Next slide"}
            onClick={isLast ? onClose : onNext}
        >
            <FontAwesomeIcon
                icon={isLast ? faXmark : faChevronRight}
                aria-hidden
            />
        </button>
    )
}

/**
 * Takes the chart footer's place while a walkthrough plays: the previous
 * and next buttons, centred, with the slide count; "CC BY" below. Narrow
 * charts keep only the count here: their buttons sit over the chart
 * (SlideSideNav).
 */
export function SlideFooter({
    slide,
    slideCount,
    onPrevious,
    onNext,
    onClose,
    isNarrow,
}: SlideNavProps & { isNarrow: boolean }): React.ReactElement {
    return (
        <footer
            className={cx("income-distribution-tutorial-footer", {
                "income-distribution-tutorial-footer--narrow": isNarrow,
            })}
        >
            <div className="income-distribution-tutorial-footer__nav">
                {!isNarrow && (
                    <div className="income-distribution-tutorial-footer__buttons">
                        <PreviousButton slide={slide} onPrevious={onPrevious} />
                        <NextButton
                            slide={slide}
                            slideCount={slideCount}
                            onNext={onNext}
                            onClose={onClose}
                        />
                    </div>
                )}
                <div className="income-distribution-tutorial-footer__meta">
                    <span className="income-distribution-tutorial-footer__count">
                        {slide} of {slideCount}
                    </span>
                    {slide === 1 && !isNarrow && (
                        <span className="income-distribution-tutorial__continue">
                            Click or swipe to continue
                        </span>
                    )}
                </div>
            </div>
            <a
                className="income-distribution-tutorial-footer__cc"
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
            >
                CC BY
            </a>
        </footer>
    )
}

/**
 * Narrow charts: the previous and next buttons over the chart's left and
 * right edges, centred on its height. The hint above the next button is
 * positioned off the button, so it doesn't move it.
 */
export function SlideSideNav({
    slide,
    slideCount,
    onPrevious,
    onNext,
    onClose,
}: SlideNavProps): React.ReactElement {
    return (
        <>
            {slide > 1 && (
                <PreviousButton
                    slide={slide}
                    onPrevious={onPrevious}
                    className="income-distribution-tutorial-side-nav income-distribution-tutorial-side-nav--previous"
                />
            )}
            <NextButton
                slide={slide}
                slideCount={slideCount}
                onNext={onNext}
                onClose={onClose}
                className="income-distribution-tutorial-side-nav income-distribution-tutorial-side-nav--next"
            />
            {slide === 1 && (
                <span className="income-distribution-tutorial__continue income-distribution-tutorial-side-nav__hint">
                    Tap to continue
                </span>
            )}
        </>
    )
}
