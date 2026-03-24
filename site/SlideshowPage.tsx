import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { Html } from "./Html.js"
import {
    SiteFooterContext,
    ImageMetadata,
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
    slides: SlideshowConfig["slides"]
    imageMetadata: Record<string, ImageMetadata>
}

export function SlideshowPage(props: SlideshowPageProps): React.ReactElement {
    const { baseUrl, title, slug, slides, imageMetadata } = props

    const canonicalUrl = `${baseUrl}/slideshows/${slug}`

    const presentationProps: SlideshowPresentationProps = {
        title,
        slides,
        imageMetadata,
    }

    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={title}
                pageDesc={`${title} — Our World in Data slideshow`}
                baseUrl={baseUrl}
            />
            <body id="slideshow-page">
                <main id="slideshow-page-container">
                    <SlideshowPresentation {...presentationProps} />
                </main>
                <p>A presentation by Our World in Data</p>
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
