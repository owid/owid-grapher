import React, { useCallback, useEffect, useRef, useState } from "react"
import cx from "classnames"
import { match } from "ts-pattern"
import {
    SlideTemplate,
    SlideshowConfig,
    ImageMetadata,
    LinkedAuthor,
    OwidGdocType,
    ResolvedSlideChartInfo,
} from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronLeft,
    faChevronRight,
    faExpand,
    faCompress,
} from "@fortawesome/free-solid-svg-icons"
import { SlideRenderer } from "./SlideRenderer.js"
import { SlideChartEmbed } from "./SlideChartEmbed.js"
import { SlideLogo } from "./SlideLogo.js"

export const _OWID_SLIDESHOW_PROPS = "_OWID_SLIDESHOW_PROPS"

export interface SlideshowPresentationProps {
    title: string
    authors?: string
    linkedAuthors: LinkedAuthor[]
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    /** Pre-resolved chart type info, keyed by slide URL. Computed at bake time. */
    chartResolutions: Record<string, ResolvedSlideChartInfo>
    /** If true, charts show timeline and controls. */
    interactiveCharts?: boolean
}

/**
 * Interactive slideshow viewer with keyboard navigation.
 * Used on the baked site (hydrated) and importable by the admin editor.
 *
 * All slides are rendered simultaneously and toggled with CSS display.
 * This ensures all chart data is fetched upfront so navigation is instant.
 */
export function SlideshowPresentation(props: {
    title: string
    authors?: string
    linkedAuthors?: LinkedAuthor[]
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    /** Pre-resolved chart type info. If not provided, falls back to client-side resolution. */
    chartResolutions?: Record<string, ResolvedSlideChartInfo>
    /** If true, show timeline and controls on charts. */
    interactiveCharts?: boolean
    /** Override chart rendering (used by admin editor for live MobX sync) */
    renderChart?: (url: string) => React.ReactElement
    /** Controlled slide index (optional — if omitted, manages its own state) */
    currentSlideIndex?: number
    /** Called when the user navigates (optional — for controlled mode) */
    onSlideChange?: (index: number) => void
}): React.ReactElement {
    const {
        authors,
        linkedAuthors,
        slides,
        imageMetadata,
        chartResolutions,
        interactiveCharts,
        renderChart,
    } = props

    // Support both controlled and uncontrolled modes
    const [internalIndex, setInternalIndex] = useState(0)
    const currentIndex = props.currentSlideIndex ?? internalIndex
    const setCurrentIndex = props.onSlideChange ?? setInternalIndex

    const goToPrev = useCallback(() => {
        setCurrentIndex(Math.max(0, currentIndex - 1))
    }, [currentIndex, setCurrentIndex])

    const goToNext = useCallback(() => {
        setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))
    }, [currentIndex, slides.length, setCurrentIndex])

    // Consolidated keyboard handler using refs so the listener
    // is only registered once (not torn down on every navigation).
    const goToPrevRef = useRef(goToPrev)
    goToPrevRef.current = goToPrev
    const goToNextRef = useRef(goToNext)
    goToNextRef.current = goToNext

    // Default chart renderer for the baked site: each chart owns
    // its own state (no shared grapherStateRef needed since all
    // slides are mounted simultaneously).
    const defaultRenderChart = useCallback(
        (url: string): React.ReactElement => {
            return (
                <SlideChartEmbed
                    url={url}
                    resolvedInfo={chartResolutions?.[url]}
                    interactiveCharts={interactiveCharts}
                />
            )
        },
        [chartResolutions, interactiveCharts]
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    const toggleFullscreen = useCallback(() => {
        const el = containerRef.current
        if (!el) return
        if (!document.fullscreenElement) {
            void el.requestFullscreen()
        } else {
            void document.exitFullscreen()
        }
    }, [])

    // Sync fullscreen state with browser API
    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener("fullscreenchange", handleChange)
        return () =>
            document.removeEventListener("fullscreenchange", handleChange)
    }, [])

    const isFullscreenRef = useRef(isFullscreen)
    isFullscreenRef.current = isFullscreen
    const toggleFullscreenRef = useRef(toggleFullscreen)
    toggleFullscreenRef.current = toggleFullscreen

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            match(e.key)
                .with("ArrowLeft", "ArrowUp", () => {
                    e.preventDefault()
                    goToPrevRef.current()
                })
                .with("ArrowRight", "ArrowDown", " ", () => {
                    e.preventDefault()
                    goToNextRef.current()
                })
                .with("Escape", () => {
                    if (isFullscreenRef.current) {
                        void document.exitFullscreen()
                    }
                })
                .with("f", () => {
                    toggleFullscreenRef.current()
                })
                .otherwise(() => undefined)
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    if (slides.length === 0) return <div className="slides" />

    const activeRenderChart = renderChart ?? defaultRenderChart

    const currentSlide = slides[currentIndex]
    const isCoverSlide = currentSlide.template === SlideTemplate.Cover
    const hideLogo = currentSlide.hideLogo ?? false

    return (
        <div
            className={cx("slideshow-container", {
                "slideshow-container--fullscreen": isFullscreen,
                "slideshow-container--cover":
                    currentSlide?.template === SlideTemplate.Cover,
            })}
        >
            <div
                ref={containerRef}
                className={cx({
                    slides: true,
                    "slides--fullscreen": isFullscreen,
                })}
            >
                {/* All slides are rendered simultaneously and toggled with
                CSS display so that chart data is fetched upfront. */}
                {slides.map((slide, i) => (
                    <SlideRenderer
                        key={i}
                        isHidden={i !== currentIndex}
                        slide={slide}
                        imageMetadata={imageMetadata}
                        renderChart={activeRenderChart}
                    />
                ))}
                {!hideLogo && isCoverSlide && <SlideLogo coverSlideLogo />}
            </div>
            <div className="slideshow-footer">
                <span className="SlideshowPresentation__branding">
                    A presentation by{" "}
                    <AuthorByline
                        authors={authors}
                        linkedAuthors={linkedAuthors}
                    />
                </span>
                <div className="SlideshowPresentation__nav">
                    <button
                        className="SlideshowPresentation__nav-button"
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        aria-label="Previous slide"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                    <span className="slideshow-footer__slide-counter">
                        {currentIndex + 1} / {slides.length}
                    </span>
                    <button
                        className="SlideshowPresentation__nav-button"
                        onClick={goToNext}
                        disabled={currentIndex === slides.length - 1}
                        aria-label="Next slide"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
                <button
                    className="SlideshowPresentation__fullscreen-button"
                    onClick={toggleFullscreen}
                    aria-label={
                        isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                >
                    <FontAwesomeIcon
                        icon={isFullscreen ? faCompress : faExpand}
                    />
                </button>
            </div>
        </div>
    )
}

/** Renders author names, linking to their author page when available */
function AuthorByline(props: {
    authors?: string
    linkedAuthors?: LinkedAuthor[]
}): React.ReactElement {
    const { authors, linkedAuthors } = props

    if (!authors) {
        return <>Our World in Data</>
    }

    const names = authors
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)

    return (
        <>
            {names.map((name, i) => {
                const linked = linkedAuthors?.find((a) => a.name === name)
                const isLast = i === names.length - 1
                const isSecondToLast = i === names.length - 2
                return (
                    <React.Fragment key={name}>
                        {linked ? (
                            <a
                                className="SlideshowPresentation__author-link"
                                href={getCanonicalUrl("", {
                                    slug: linked.slug,
                                    content: {
                                        type: OwidGdocType.Author,
                                    },
                                })}
                            >
                                {name}
                            </a>
                        ) : (
                            <span>{name}</span>
                        )}
                        {!isLast && names.length > 2 && ", "}
                        {isSecondToLast && names.length > 1 && " and "}
                    </React.Fragment>
                )
            })}
        </>
    )
}
