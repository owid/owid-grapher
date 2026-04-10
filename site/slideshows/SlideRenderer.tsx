import React from "react"
import cx from "classnames"
import { Slide, SlideTemplate, ImageMetadata } from "@ourworldindata/types"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { GrapherFigureView } from "../GrapherFigureView.js"
import {
    getSlideAspectRatio,
    getSlideshowGrapherConfig,
    parseSlideChartUrl,
} from "./slideshowUtils.js"
import { match } from "ts-pattern"
import { SlideLogo } from "./SlideLogo.js"

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
            <div className={`${className} slide--cover`}>
                {(slide.author || slide.date) && (
                    <p className="cover-supertitle">
                        {slide.subtitle && <span>{slide.subtitle}</span>}
                        {slide.date && <span>{slide.date}</span>}
                    </p>
                )}
                <h1>{slide.title}</h1>
                {slide.author && <h2>{slide.author}</h2>}
            </div>
        ))
        .with({ template: SlideTemplate.Image }, (slide) => (
            <div className={`${className} slide--image`}>
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
                        <div
                            className={cx("slide__text", {
                                "slide__text--large": slide.largeText,
                            })}
                        >
                            <SimpleMarkdownText text={slide.text} />
                        </div>
                    )}
                </div>
            </div>
        ))
        .with({ template: SlideTemplate.Chart }, (slide) => (
            <div className={`${className} slide--chart`}>
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
                    {slide.url ? (
                        <ChartRenderer
                            url={slide.url}
                            renderChart={renderChart}
                        />
                    ) : (
                        <div className="slide__media-placeholder">Chart</div>
                    )}
                    {slide.text && (
                        <div
                            className={cx("slide__text", {
                                "slide__text--large": slide.largeText,
                            })}
                        >
                            <SimpleMarkdownText text={slide.text} />
                        </div>
                    )}
                </div>
            </div>
        ))
        .with({ template: SlideTemplate.Outline }, (slide) => (
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
        .with({ template: SlideTemplate.Statement }, (slide) => (
            <div className={`${className} slide--statement`}>
                {!slide.hideLogo && <SlideLogo />}
                <h1 className="slide-statement__text">
                    <SimpleMarkdownText
                        text={slide.text}
                        useParagraphs={false}
                    />
                </h1>
                {slide.attribution && (
                    <p className="slide-statement__attribution">
                        {slide.attribution}
                    </p>
                )}
            </div>
        ))
        .with({ template: SlideTemplate.Text }, (slide) => (
            <div className={`${className} slide--text`}>
                {!slide.hideLogo && <SlideLogo />}
                {slide.title && (
                    <h1 className="slide-title">
                        <SimpleMarkdownText
                            text={slide.title}
                            useParagraphs={false}
                        />
                    </h1>
                )}
                <div
                    className={cx("slide-text__body", {
                        "slide-text__body--large": slide.largeText,
                    })}
                >
                    <SimpleMarkdownText text={slide.text} />
                </div>
            </div>
        ))
        .with({ template: SlideTemplate.TwoCharts }, (slide) => (
            <div className={`${className} slide--two-charts`}>
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
                <div className="slide-two-charts__content">
                    <div className="slide-two-charts__chart">
                        {slide.url1 ? (
                            <ChartRenderer
                                url={slide.url1}
                                renderChart={renderChart}
                            />
                        ) : (
                            <div className="slide__media-placeholder">
                                Chart 1
                            </div>
                        )}
                    </div>
                    <div className="slide-two-charts__chart">
                        {slide.url2 ? (
                            <ChartRenderer
                                url={slide.url2}
                                renderChart={renderChart}
                            />
                        ) : (
                            <div className="slide__media-placeholder">
                                Chart 2
                            </div>
                        )}
                    </div>
                </div>
            </div>
        ))
        .otherwise(() => <div></div>)
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
