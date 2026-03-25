import React from "react"
import { Slide, SlideTemplate, ImageMetadata } from "@ourworldindata/types"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { GrapherFigureView } from "../GrapherFigureView.js"

/**
 * Pure slide rendering component shared between the baked site and the
 * admin editor preview. Renders a single slide based on its template.
 *
 * For chart slides, it renders a `GrapherFigureView` by default.
 * The parent can override chart rendering via `renderChart` (used by
 * the admin editor to render `SlideGrapher` with live MobX sync, and
 * by `SlideshowPresentation` for smooth same-slug transitions).
 */
export function SlideRenderer(props: {
    slide: Slide
    imageMetadata?: Record<string, ImageMetadata>
    /** Override chart rendering (for SlideGrapher with live sync) */
    renderChart?: (slug: string, queryString?: string) => React.ReactElement
}): React.ReactElement {
    const { slide, imageMetadata, renderChart } = props

    switch (slide.template) {
        case SlideTemplate.Cover:
            return (
                <div className="SlideContent SlideContent--cover">
                    <h1>{slide.title || "Title"}</h1>
                    {slide.subtitle && <h2>{slide.subtitle}</h2>}
                    {slide.author && (
                        <p className="SlideContent__author">{slide.author}</p>
                    )}
                    {slide.date && (
                        <p className="SlideContent__date">{slide.date}</p>
                    )}
                </div>
            )
        case SlideTemplate.Section:
            return (
                <div className="SlideContent SlideContent--section">
                    <h1>{slide.title || "Section Title"}</h1>
                    {slide.subtitle && <h2>{slide.subtitle}</h2>}
                </div>
            )
        case SlideTemplate.Image:
            return (
                <div className="SlideContent SlideContent--image">
                    {slide.sectionTitle && (
                        <p className="SlideContent__section-title">
                            {slide.sectionTitle}
                        </p>
                    )}
                    {slide.slideTitle && (
                        <h2 className="SlideContent__slide-title">
                            {slide.slideTitle}
                        </h2>
                    )}
                    <ImageRenderer
                        filename={slide.filename}
                        imageMetadata={imageMetadata}
                    />
                </div>
            )
        case SlideTemplate.Chart:
            return (
                <div className="SlideContent SlideContent--chart">
                    {slide.sectionTitle && (
                        <p className="SlideContent__section-title">
                            {slide.sectionTitle}
                        </p>
                    )}
                    {slide.slideTitle && (
                        <h2 className="SlideContent__slide-title">
                            {slide.slideTitle}
                        </h2>
                    )}
                    <ChartRenderer
                        slug={slide.slug}
                        queryString={slide.queryString}
                        renderChart={renderChart}
                    />
                </div>
            )
        case SlideTemplate.Blank:
            return <div className="SlideContent SlideContent--blank" />
        default:
            return (
                <div className="SlideContent SlideContent--placeholder">
                    <p>{slide.template}</p>
                </div>
            )
    }
}

function ImageRenderer(props: {
    filename: string | null
    imageMetadata?: Record<string, ImageMetadata>
}): React.ReactElement {
    const { filename, imageMetadata } = props

    if (!filename) {
        return <div className="SlideContent__media-placeholder">IMAGE</div>
    }

    const metadata = imageMetadata?.[filename]
    if (metadata?.cloudflareId) {
        return (
            <img
                src={`${CLOUDFLARE_IMAGES_URL}/${metadata.cloudflareId}/w=960`}
                alt={metadata.defaultAlt || filename}
                className="SlideContent__media-image"
            />
        )
    }

    return <div className="SlideContent__media-placeholder">{filename}</div>
}

function ChartRenderer(props: {
    slug: string
    queryString?: string
    renderChart?: (slug: string, queryString?: string) => React.ReactElement
}): React.ReactElement {
    const { slug, queryString, renderChart } = props

    if (renderChart) {
        return renderChart(slug, queryString)
    }

    // Default: use GrapherFigureView for the baked site (SSR fallback)
    return (
        <div className="SlideContent__grapher-container">
            <GrapherFigureView
                slug={slug}
                queryStr={queryString}
                isEmbeddedInAnOwidPage={true}
                isEmbeddedInADataPage={false}
                config={{
                    hideShareButton: true,
                    hideExploreTheDataButton: true,
                    hideRelatedQuestion: true,
                }}
            />
        </div>
    )
}
