import React, { useCallback, useEffect, useRef, useState } from "react"
import { Slide, SlideshowConfig, ImageMetadata } from "@ourworldindata/types"
import { GrapherState } from "@ourworldindata/grapher"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronLeft,
    faChevronRight,
    faExpand,
    faCompress,
} from "@fortawesome/free-solid-svg-icons"
import { SlideRenderer } from "./SlideRenderer.js"
import { SlideGrapher } from "./SlideGrapher.js"

export const _OWID_SLIDESHOW_PROPS = "_OWID_SLIDESHOW_PROPS"

export interface SlideshowPresentationProps {
    title: string
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
}

/**
 * Interactive slideshow viewer with keyboard navigation.
 * Used on the baked site (hydrated) and importable by the admin editor.
 *
 * Owns a `grapherStateRef` so that chart slides sharing the same
 * slug transition smoothly (no remount / white flash).
 */
export function SlideshowPresentation(props: {
    title: string
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    /** Override chart rendering (used by admin editor for live MobX sync) */
    renderChart?: (
        slug: string,
        queryString: string | undefined,
        options: { hideTitle: boolean; hideSubtitle: boolean }
    ) => React.ReactElement
    /** Controlled slide index (optional — if omitted, manages its own state) */
    currentSlideIndex?: number
    /** Called when the user navigates (optional — for controlled mode) */
    onSlideChange?: (index: number) => void
}): React.ReactElement {
    const { slides, imageMetadata, renderChart } = props

    // Support both controlled and uncontrolled modes
    const [internalIndex, setInternalIndex] = useState(0)
    const currentIndex = props.currentSlideIndex ?? internalIndex
    const setCurrentIndex = props.onSlideChange ?? setInternalIndex

    const currentSlide = slides[currentIndex]

    const goToPrev = useCallback(() => {
        setCurrentIndex(Math.max(0, currentIndex - 1))
    }, [currentIndex, setCurrentIndex])

    const goToNext = useCallback(() => {
        setCurrentIndex(Math.min(slides.length - 1, currentIndex + 1))
    }, [currentIndex, slides.length, setCurrentIndex])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault()
                goToPrev()
            } else if (
                e.key === "ArrowRight" ||
                e.key === "ArrowDown" ||
                e.key === " "
            ) {
                e.preventDefault()
                goToNext()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [goToPrev, goToNext])

    // Owned by this component so that SlideGrapher can persist
    // the GrapherState across slide transitions.
    const grapherStateRef = useRef<GrapherState | null>(null)

    // Default chart renderer: uses SlideGrapher for smooth same-slug
    // transitions. The admin editor can override via the renderChart prop.
    const defaultRenderChart = useCallback(
        (
            slug: string,
            queryString: string | undefined,
            options: { hideTitle: boolean; hideSubtitle: boolean }
        ): React.ReactElement => {
            return (
                <SlideGrapher
                    slug={slug}
                    initialQueryString={queryString}
                    grapherStateRef={grapherStateRef}
                    hideTitle={options.hideTitle}
                    hideSubtitle={options.hideSubtitle}
                />
            )
        },
        []
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

    // Escape exits fullscreen (browser handles this natively, but
    // we also want Escape to work as a keyboard shortcut)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape" && isFullscreen) {
                void document.exitFullscreen()
            } else if (e.key === "f") {
                toggleFullscreen()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isFullscreen, toggleFullscreen])

    if (!currentSlide) return <div className="SlideshowPresentation" />

    return (
        <div
            ref={containerRef}
            className={`SlideshowPresentation${isFullscreen ? " SlideshowPresentation--fullscreen" : ""}`}
        >
            <div className="SlideshowPresentation__slide">
                <SlideRenderer
                    slide={currentSlide}
                    imageMetadata={imageMetadata}
                    renderChart={renderChart ?? defaultRenderChart}
                />
            </div>
            <div className="SlideshowPresentation__footer">
                <span className="SlideshowPresentation__branding">
                    A presentation by <strong>Our World in Data</strong>
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
                    <span className="SlideshowPresentation__slide-counter">
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
