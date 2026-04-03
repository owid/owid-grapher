import React from "react"
import cx from "classnames"
import { Slide, SlideTemplate, ImageMetadata } from "@ourworldindata/types"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { OWID_LOGO_SVG } from "@ourworldindata/grapher/src/captionedChart/LogosSVG"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { GrapherFigureView } from "../GrapherFigureView.js"
import { getSlideAspectRatio, parseSlideChartUrl } from "./slideshowUtils.js"

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
    renderChart?: (
        url: string,
        options: { hideTitle: boolean; hideSubtitle: boolean }
    ) => React.ReactElement
    isHidden?: boolean
}): React.ReactElement {
    const { slide, imageMetadata, renderChart, isHidden } = props
    const className = cx("slide", getSlideAspectRatio(slide), {
        "slide--hidden": isHidden,
    })

    switch (slide.template) {
        case SlideTemplate.Cover:
            return (
                <div className={`${className} SlideContent--cover`}>
                    {!slide.hideLogo && <SlideLogo />}
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
                <div className={`${className} SlideContent--section`}>
                    {!slide.hideLogo && <SlideLogo />}
                    <h1>{slide.title || "Section Title"}</h1>
                    {slide.subtitle && <h2>{slide.subtitle}</h2>}
                </div>
            )
        case SlideTemplate.Image:
            return (
                <div className={className}>
                    {!slide.hideLogo && <SlideLogo />}
                    {slide.slideTitle && (
                        <h2 className="slide-title">
                            <SimpleMarkdownText
                                text={slide.slideTitle}
                                useParagraphs={false}
                            />
                        </h2>
                    )}
                    <div className="slide__body">
                        <div className="SlideContent__media">
                            <ImageRenderer
                                filename={slide.filename}
                                imageMetadata={imageMetadata}
                            />
                        </div>
                        {slide.text && (
                            <div className="slide__text">
                                <SimpleMarkdownText text={slide.text} />
                            </div>
                        )}
                    </div>
                </div>
            )
        case SlideTemplate.Chart:
            return (
                <div className={className}>
                    {!slide.hideLogo && <SlideLogo />}
                    {slide.titleOverride && (
                        <h1 className="slide-title">
                            <SimpleMarkdownText
                                text={slide.titleOverride}
                                useParagraphs={false}
                            />
                        </h1>
                    )}
                    {slide.subtitleOverride && (
                        <p className="slide-subtitle">
                            <SimpleMarkdownText
                                text={slide.subtitleOverride}
                                useParagraphs={false}
                            />
                        </p>
                    )}
                    <div className="slide-chart-content">
                        <ChartRenderer
                            url={slide.url}
                            hideTitle={!!slide.titleOverride}
                            hideSubtitle={!!slide.subtitleOverride}
                            renderChart={renderChart}
                        />
                        {slide.text && (
                            <div className="slide__text">
                                <SimpleMarkdownText text={slide.text} />
                            </div>
                        )}
                    </div>
                </div>
            )
        case SlideTemplate.Blank:
            return (
                <div className={`${className} SlideContent--blank`}>
                    {!slide.hideLogo && <SlideLogo />}
                </div>
            )
        default:
            return (
                <div className={`${className} SlideContent--placeholder`}>
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
    url: string
    hideTitle: boolean
    hideSubtitle: boolean
    renderChart?: (
        url: string,
        options: { hideTitle: boolean; hideSubtitle: boolean }
    ) => React.ReactElement
}): React.ReactElement {
    const { url, hideTitle, hideSubtitle, renderChart } = props

    if (renderChart) {
        return renderChart(url, { hideTitle, hideSubtitle })
    }

    // Default SSR fallback: parse URL and render GrapherFigureView.
    // This only handles /grapher/ URLs; multi-dim and explorer
    // rendering requires the client-side SlideChartEmbed component.
    const parsed = parseSlideChartUrl(url)
    return (
        <div className="SlideContent__grapher-container">
            <GrapherFigureView
                slug={parsed.slug}
                queryStr={parsed.queryString}
                isEmbeddedInAnOwidPage={true}
                isEmbeddedInADataPage={false}
                config={{
                    hideShareButton: true,
                    hideExploreTheDataButton: true,
                    hideRelatedQuestion: true,
                    hideFullscreenButton: true,
                    hideControlsRow: true,
                    hideDownloadButton: true,
                    hideLogo: true,
                    hideTitle,
                    hideSubtitle,
                }}
            />
        </div>
    )
}

function SlideLogo(): React.ReactElement {
    return (
        <span
            className="slide-logo"
            dangerouslySetInnerHTML={{ __html: OWID_LOGO_SVG }}
        />
    )
}
