import React, { useCallback, useEffect, useState } from "react"
import {
    Slide,
    SlideMedia,
    SlideshowConfig,
    ImageMetadata,
} from "@ourworldindata/types"
import { SlideRenderer } from "./SlideRenderer.js"

export const _OWID_SLIDESHOW_PROPS = "_OWID_SLIDESHOW_PROPS"

export interface SlideshowPresentationProps {
    title: string
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
}

/**
 * Interactive slideshow viewer with keyboard navigation.
 * Used on the baked site (hydrated) and importable by the admin editor.
 */
export function SlideshowPresentation(props: {
    title: string
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    /** Override the media rendering for a specific slide (used by admin editor) */
    renderMedia?: (media: SlideMedia, slideIndex: number) => React.ReactElement
    /** Controlled slide index (optional — if omitted, manages its own state) */
    currentSlideIndex?: number
    /** Called when the user navigates (optional — for controlled mode) */
    onSlideChange?: (index: number) => void
}): React.ReactElement {
    const { slides, imageMetadata, renderMedia } = props

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

    if (!currentSlide) return <div className="SlideshowPresentation" />

    const slideRenderMedia = renderMedia
        ? (media: SlideMedia) => renderMedia(media, currentIndex)
        : undefined

    return (
        <div className="SlideshowPresentation">
            <div className="SlideshowPresentation__slide">
                <SlideRenderer
                    slide={currentSlide}
                    imageMetadata={imageMetadata}
                    renderMedia={slideRenderMedia}
                />
            </div>
            <div className="SlideshowPresentation__nav">
                <button
                    className="SlideshowPresentation__nav-button"
                    onClick={goToPrev}
                    disabled={currentIndex === 0}
                    aria-label="Previous slide"
                >
                    &larr;
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
                    &rarr;
                </button>
            </div>
        </div>
    )
}
