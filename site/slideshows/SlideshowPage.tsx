import React from "react"
import { Head } from "./../Head.js"
import { SiteFooter } from "./../SiteFooter.js"
import { Html } from "./../Html.js"
import {
    SiteFooterContext,
    ImageMetadata,
    LinkedAuthor,
    ResolvedSlideChartInfo,
    SlideshowConfig,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import {
    SlideshowPresentation,
    SlideshowPresentationProps,
    _OWID_SLIDESHOW_PROPS,
} from "./SlideshowPresentation.js"

export interface SlideshowPageProps {
    baseUrl: string
    title: string
    slug: string
    authors?: string
    linkedAuthors: LinkedAuthor[]
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
    chartResolutions: Record<string, ResolvedSlideChartInfo>
    interactiveCharts?: boolean
}

export function SlideshowPage(props: SlideshowPageProps): React.ReactElement {
    const {
        baseUrl,
        title,
        slug,
        authors,
        linkedAuthors,
        slides,
        imageMetadata,
        chartResolutions,
        interactiveCharts,
    } = props

    const canonicalUrl = `${baseUrl}/slideshows/${slug}`

    const presentationProps: SlideshowPresentationProps = {
        title,
        authors,
        linkedAuthors,
        slides,
        imageMetadata,
        chartResolutions,
        interactiveCharts,
    }

    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={title}
                pageDesc={`${title} — Our World in Data slideshow`}
                baseUrl={baseUrl}
            />
            <body id="slideshow-page-body">
                <main
                    id="slideshow-page-container"
                    style={{ visibility: "hidden" }}
                >
                    <SlideshowPresentation {...presentationProps} />
                </main>
                <SiteFooter context={SiteFooterContext.slideshowPage} />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.${_OWID_SLIDESHOW_PROPS} = ${serializeJSONForHTML(presentationProps)}`,
                    }}
                />
            </body>
        </Html>
    )
}
