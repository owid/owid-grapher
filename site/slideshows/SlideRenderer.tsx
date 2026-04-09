import React from "react"
import cx from "classnames"
import { Slide, SlideTemplate, ImageMetadata } from "@ourworldindata/types"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { OWID_LOGO_SVG } from "@ourworldindata/grapher/src/captionedChart/LogosSVG"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { GrapherFigureView } from "../GrapherFigureView.js"
import {
    getSlideAspectRatio,
    getSlideshowGrapherConfig,
    parseSlideChartUrl,
} from "./slideshowUtils.js"
import { match } from "ts-pattern"

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
    renderChart?: (url: string) => React.ReactElement
    isHidden?: boolean
}): React.ReactElement {
    const { slide, imageMetadata, renderChart, isHidden } = props
    const className = cx("slide", getSlideAspectRatio(slide), {
        "slide--hidden": isHidden,
    })

    return match(slide)
        .with({ template: SlideTemplate.Cover }, (slide) => (
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
        ))
        .with({ template: SlideTemplate.Section }, (slide) => (
            <div className={`${className} SlideContent--section`}>
                {!slide.hideLogo && <SlideLogo />}
                <h1>{slide.title || "Section Title"}</h1>
                {slide.subtitle && <h2>{slide.subtitle}</h2>}
            </div>
        ))
        .with({ template: SlideTemplate.Image }, (slide) => (
            <div className={className}>
                {!slide.hideLogo && <SlideLogo />}
                {slide.slideTitle && (
                    <h1 className="slide-title">
                        <SimpleMarkdownText
                            text={slide.slideTitle}
                            useParagraphs={false}
                        />
                    </h1>
                )}
                <div className="slide-chart-content">
                    <ImageRenderer
                        filename={slide.filename}
                        imageMetadata={imageMetadata}
                    />
                    {slide.text && (
                        <div className="slide__text">
                            <SimpleMarkdownText text={slide.text} />
                        </div>
                    )}
                </div>
            </div>
        ))
        .with({ template: SlideTemplate.Chart }, (slide) => (
            <div className={className}>
                {!slide.hideLogo && <SlideLogo />}
                {slide.title && (
                    <h1 className="slide-title">
                        <SimpleMarkdownText
                            text={slide.title}
                            useParagraphs={false}
                        />
                    </h1>
                )}
                {slide.subtitle && (
                    <p className="slide-subtitle">
                        <SimpleMarkdownText
                            text={slide.subtitle}
                            useParagraphs={false}
                        />
                    </p>
                )}
                <div className="slide-chart-content">
                    <ChartRenderer url={slide.url} renderChart={renderChart} />
                    {slide.text && (
                        <div className="slide__text">
                            <SimpleMarkdownText text={slide.text} />
                        </div>
                    )}
                </div>
            </div>
        ))
        .with({ template: SlideTemplate.Blank }, (slide) => (
            <div className={`${className} SlideContent--blank`}>
                {!slide.hideLogo && <SlideLogo />}
            </div>
        ))
        .with({ template: SlideTemplate.Contents }, (slide) => (
            <div className={`${className} slide--contents`}>
                {!slide.hideLogo && <SlideLogo />}
                {slide.title && (
                    <h1 className="slide-title">
                        <SimpleMarkdownText
                            text={slide.title}
                            useParagraphs={false}
                        />
                    </h1>
                )}
                <div className="slide-contents__list">
                    <SimpleMarkdownText text={slide.text} />
                </div>
            </div>
        ))
        .otherwise((slide) => (
            <div className={`${className} SlideContent--placeholder`}>
                <p>{slide.template}</p>
            </div>
        ))
}

function ImageRenderer(props: {
    filename: string | null
    imageMetadata?: Record<string, ImageMetadata>
}): React.ReactElement {
    const { filename, imageMetadata } = props

    if (!filename) {
        return <div className="slide__media-placeholder">IMAGE</div>
    }

    const metadata = imageMetadata?.[filename]
    if (metadata?.cloudflareId) {
        return (
            <img
                src={`${CLOUDFLARE_IMAGES_URL}/${metadata.cloudflareId}/public`}
                alt={metadata.defaultAlt || filename}
                className="slide__image"
            />
        )
    }

    return <div className="slide__media-placeholder">{filename}</div>
}

function ChartRenderer(props: {
    url: string
    renderChart?: (url: string) => React.ReactElement
}): React.ReactElement {
    const { url, renderChart } = props

    if (renderChart) {
        return renderChart(url)
    }

    // Default SSR fallback: parse URL and render GrapherFigureView.
    // This only handles /grapher/ URLs; multi-dim and explorer
    // rendering requires the client-side SlideChartEmbed component.
    const parsed = parseSlideChartUrl(url)
    return (
        <div className="slide__grapher-container">
            <GrapherFigureView
                slug={parsed.slug}
                queryStr={parsed.queryString}
                isEmbeddedInAnOwidPage={true}
                isEmbeddedInADataPage={false}
                config={getSlideshowGrapherConfig({
                    interactiveCharts: false,
                })}
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
