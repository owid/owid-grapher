import React, { useLayoutEffect, useRef, useState } from "react"
import cx from "clsx"
import { match } from "ts-pattern"
import { useIntersectionObserver } from "usehooks-ts"
import {
    ImageMetadata,
    LinkedAuthor,
    ResolvedSlideChartInfo,
    Slide,
    SlideTemplate,
} from "@ourworldindata/types"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { OWID_WORDMARK_SVG } from "@ourworldindata/grapher"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.mjs"
import { SiteSlideChartEmbed } from "./SiteSlideChartEmbed.js"
import { SlideshowAuthorByline } from "./SlideshowAuthorByline.js"

export type SlideshowMobileLayout = "reading" | "cards"

interface ChartContext {
    chartResolutions?: Record<string, ResolvedSlideChartInfo>
    interactiveCharts?: boolean
    /** Cards only: whether the slide is the current one or next to it */
    isNear?: boolean
}

/**
 * Prototype phone layouts for slideshows. Both re-typeset the slide data in
 * real pixel sizes instead of scaling the 16:9 deck.
 *
 * - "reading": every slide is a section in one scrolling column.
 * - "cards": one slide per screen, swiped horizontally.
 */
export function SlideshowMobile(props: {
    layout: SlideshowMobileLayout
    slides: Slide[]
    imageMetadata: Record<string, ImageMetadata>
    chartResolutions?: Record<string, ResolvedSlideChartInfo>
    interactiveCharts?: boolean
    authors?: string
    linkedAuthors?: LinkedAuthor[]
    currentIndex: number
    onSlideChange: (index: number) => void
}): React.ReactElement {
    const { layout, slides, currentIndex, onSlideChange } = props
    const trackRef = useRef<HTMLDivElement>(null)
    const hasPositioned = useRef(false)
    // Set while a scroll we started ourselves is in flight, so that the scroll
    // handler doesn't report the slides it passes on the way.
    const programmaticTarget = useRef<number | null>(null)

    useLayoutEffect(() => {
        const track = trackRef.current
        if (!track) return
        const behavior = hasPositioned.current ? "smooth" : "auto"
        hasPositioned.current = true
        if (layout === "reading") {
            if (behavior === "auto" && currentIndex > 0) {
                track.children[currentIndex]?.scrollIntoView()
            }
            return
        }
        const scrolledIndex = Math.round(track.scrollLeft / track.clientWidth)
        if (scrolledIndex === currentIndex) return
        programmaticTarget.current = currentIndex
        track.scrollTo({ left: currentIndex * track.clientWidth, behavior })
    }, [currentIndex, layout])

    const handleScroll = (): void => {
        const track = trackRef.current
        if (!track || layout !== "cards") return
        const scrolledIndex = Math.round(track.scrollLeft / track.clientWidth)
        if (programmaticTarget.current !== null) {
            if (scrolledIndex === programmaticTarget.current) {
                programmaticTarget.current = null
            }
            return
        }
        if (scrolledIndex !== currentIndex) onSlideChange(scrolledIndex)
    }

    const byline = (
        <p className="slideshow-mobile__byline">
            A presentation by{" "}
            <SlideshowAuthorByline
                authors={props.authors}
                linkedAuthors={props.linkedAuthors}
            />
        </p>
    )

    return (
        <div className={`slideshow-mobile slideshow-mobile--${layout}`}>
            <div
                ref={trackRef}
                className="slideshow-mobile__track"
                onScroll={handleScroll}
                onPointerDown={() => {
                    programmaticTarget.current = null
                }}
            >
                {slides.map((slide, i) => (
                    <MobileSlide
                        key={i}
                        slide={slide}
                        imageMetadata={props.imageMetadata}
                        chartContext={{
                            chartResolutions: props.chartResolutions,
                            interactiveCharts: props.interactiveCharts,
                            isNear:
                                layout === "cards"
                                    ? Math.abs(i - currentIndex) <= 1
                                    : undefined,
                        }}
                    />
                ))}
            </div>
            {layout === "reading" ? (
                byline
            ) : (
                <div className="slideshow-mobile__footer">
                    <div
                        className="slideshow-mobile__progress"
                        style={{
                            width: `${((currentIndex + 1) / slides.length) * 100}%`,
                        }}
                    />
                    <button
                        className="SlideshowPresentation__nav-button"
                        onClick={() => onSlideChange(currentIndex - 1)}
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
                        onClick={() => onSlideChange(currentIndex + 1)}
                        disabled={currentIndex === slides.length - 1}
                        aria-label="Next slide"
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                </div>
            )}
        </div>
    )
}

function MobileSlide(props: {
    slide: Slide
    imageMetadata: Record<string, ImageMetadata>
    chartContext: ChartContext
}): React.ReactElement {
    const { slide, imageMetadata, chartContext } = props
    const className = cx("mobile-slide", `mobile-slide--${slide.template}`, {
        "mobile-slide--blue-background":
            "blueBackground" in slide && slide.blueBackground,
    })

    return match(slide)
        .with({ template: SlideTemplate.Cover }, (slide) => (
            <section className={className}>
                {(slide.subtitle || slide.date) && (
                    <p className="mobile-slide__supertitle">
                        {[slide.subtitle, slide.date]
                            .filter(Boolean)
                            .join(" | ")}
                    </p>
                )}
                <h1 className="mobile-slide__cover-title">
                    <InlineMarkdown text={slide.title} />
                </h1>
                {slide.author && (
                    <p className="mobile-slide__cover-author">{slide.author}</p>
                )}
                {!slide.hideLogo && (
                    <span
                        className="mobile-slide__cover-logo"
                        dangerouslySetInnerHTML={{ __html: OWID_WORDMARK_SVG }}
                    />
                )}
            </section>
        ))
        .with({ template: SlideTemplate.Statement }, (slide) => (
            <section
                className={cx(className, {
                    "mobile-slide--section-divider":
                        slide.variant === "sectionDivider",
                })}
            >
                <h2 className="mobile-slide__statement">
                    <InlineMarkdown text={slide.text} />
                </h2>
                {slide.attribution && (
                    <p className="mobile-slide__attribution">
                        {slide.attribution}
                    </p>
                )}
            </section>
        ))
        .with({ template: SlideTemplate.Outline }, (slide) => (
            <section className={className}>
                <MobileSlideTitle title={slide.title} />
                <div className="mobile-slide__outline">
                    <SimpleMarkdownText text={slide.text} openLinksInNewTab />
                </div>
            </section>
        ))
        .with({ template: SlideTemplate.Text }, (slide) => (
            <section className={className}>
                <MobileSlideTitle title={slide.title} />
                <MobileSlideText text={slide.text} />
            </section>
        ))
        .with({ template: SlideTemplate.Chart }, (slide) => (
            <section className={className}>
                <MobileSlideTitle
                    title={slide.title}
                    subtitle={slide.subtitle}
                />
                <MobileSlideChart url={slide.url} {...chartContext} />
                <MobileSlideText text={slide.text} />
            </section>
        ))
        .with({ template: SlideTemplate.TwoCharts }, (slide) => (
            <section className={className}>
                <MobileSlideTitle
                    title={slide.title}
                    subtitle={slide.subtitle}
                />
                <MobileSlideChart url={slide.url1} {...chartContext} />
                <MobileSlideChart url={slide.url2} {...chartContext} />
            </section>
        ))
        .with({ template: SlideTemplate.Image }, (slide) => {
            const image = (
                <MobileSlideImage
                    filename={slide.filename}
                    imageMetadata={imageMetadata}
                />
            )
            const isTextFirst = slide.variant === "textImage"
            return (
                <section className={className}>
                    <MobileSlideTitle title={slide.title} />
                    {!isTextFirst && image}
                    <MobileSlideText text={slide.text} />
                    {isTextFirst && image}
                </section>
            )
        })
        .exhaustive()
}

function InlineMarkdown(props: { text: string }): React.ReactElement {
    return (
        <SimpleMarkdownText
            openLinksInNewTab
            text={props.text}
            useParagraphs={false}
        />
    )
}

function MobileSlideTitle(props: {
    title?: string
    subtitle?: string
}): React.ReactElement | null {
    if (!props.title && !props.subtitle) return null
    return (
        <header className="mobile-slide__header">
            {props.title && (
                <h2 className="mobile-slide__title">
                    <InlineMarkdown text={props.title} />
                </h2>
            )}
            {props.subtitle && (
                <p className="mobile-slide__subtitle">
                    <InlineMarkdown text={props.subtitle} />
                </p>
            )}
        </header>
    )
}

function MobileSlideText(props: { text?: string }): React.ReactElement | null {
    if (!props.text) return null
    return (
        <div className="mobile-slide__text">
            <SimpleMarkdownText text={props.text} openLinksInNewTab />
        </div>
    )
}

/**
 * Mounts the chart only once it is close to being seen: in the reading view
 * when it's within a few screens of the viewport, in cards when its slide is
 * the current one or a neighbour. Stays mounted afterwards.
 */
function MobileSlideChart(
    props: { url: string } & ChartContext
): React.ReactElement | null {
    const { ref, isIntersecting } = useIntersectionObserver({
        rootMargin: "1000px 0px",
    })
    const shouldMount = props.isNear ?? isIntersecting
    const [hasMounted, setHasMounted] = useState(false)
    if (shouldMount && !hasMounted) setHasMounted(true)

    if (!props.url) return null
    return (
        <div ref={ref} className="mobile-slide__chart">
            {hasMounted && (
                <SiteSlideChartEmbed
                    url={props.url}
                    resolvedInfo={props.chartResolutions?.[props.url]}
                    interactiveCharts={props.interactiveCharts}
                />
            )}
        </div>
    )
}

function MobileSlideImage(props: {
    filename: string | null
    imageMetadata: Record<string, ImageMetadata>
}): React.ReactElement | null {
    const metadata = props.filename
        ? props.imageMetadata[props.filename]
        : undefined
    if (!metadata?.cloudflareId) return null
    const src = `${CLOUDFLARE_IMAGES_URL}/${metadata.cloudflareId}/public`
    return (
        <a
            className="mobile-slide__image-link"
            href={src}
            target="_blank"
            rel="noopener"
            aria-label="Open image at full size"
        >
            <img
                className="mobile-slide__image"
                src={src}
                alt={metadata.defaultAlt || props.filename || ""}
                loading="lazy"
            />
        </a>
    )
}
