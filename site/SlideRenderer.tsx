import React from "react"
import {
    Slide,
    SlideMedia,
    SlideTemplate,
    ImageMetadata,
} from "@ourworldindata/types"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"
import { GrapherFigureView } from "./GrapherFigureView.js"

/**
 * Pure slide rendering component shared between the baked site and the
 * admin editor preview. Renders a single slide based on its template.
 *
 * For graphers, it renders a `GrapherFigureView` which uses
 * `FetchingGrapher` to load config and data client-side.
 *
 * The admin editor wraps this for slides with graphers, swapping in
 * its own `SlideGrapher` component that supports live MobX sync.
 */
export function SlideRenderer(props: {
    slide: Slide
    imageMetadata?: Record<string, ImageMetadata>
    /** Override the media rendering for admin-specific use cases */
    renderMedia?: (media: SlideMedia) => React.ReactElement
}): React.ReactElement {
    const { slide, imageMetadata, renderMedia } = props

    switch (slide.template) {
        case SlideTemplate.TitleSlide:
            return (
                <div className="SlideContent SlideContent--title-slide">
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
        case SlideTemplate.ImageChartOnly:
            return (
                <div className="SlideContent SlideContent--image-chart-only">
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
                    <SlideMediaRenderer
                        media={slide.media}
                        imageMetadata={imageMetadata}
                        renderMedia={renderMedia}
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

/** Renders a SlideMedia value as either an image, Grapher, or placeholder */
function SlideMediaRenderer(props: {
    media: SlideMedia | null
    imageMetadata?: Record<string, ImageMetadata>
    renderMedia?: (media: SlideMedia) => React.ReactElement
}): React.ReactElement {
    const { media, imageMetadata, renderMedia } = props

    if (!media) {
        return (
            <div className="SlideContent__media-placeholder">IMAGE/CHART</div>
        )
    }

    // Allow the parent to override media rendering (used by the admin editor)
    if (renderMedia) {
        return renderMedia(media)
    }

    if (media.type === "image") {
        const metadata = imageMetadata?.[media.filename]
        if (metadata?.cloudflareId) {
            return (
                <img
                    src={`${CLOUDFLARE_IMAGES_URL}/${metadata.cloudflareId}/w=960`}
                    alt={metadata.defaultAlt || media.filename}
                    className="SlideContent__media-image"
                />
            )
        }
        return (
            <div className="SlideContent__media-placeholder">
                {media.filename}
            </div>
        )
    }

    // Grapher slide — use GrapherFigureView for the baked site
    return (
        <div className="SlideContent__grapher-container">
            <GrapherFigureView
                slug={media.slug}
                queryStr={media.queryString}
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
