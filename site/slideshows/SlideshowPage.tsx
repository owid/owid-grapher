import React from "react"
import { Head } from "./../Head.js"
import { SiteFooter } from "./../SiteFooter.js"
import { Html } from "./../Html.js"
import {
    SiteFooterContext,
    ImageMetadata,
    LinkedAuthor,
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
    } = props

    const canonicalUrl = `${baseUrl}/slideshows/${slug}`

    const presentationProps: SlideshowPresentationProps = {
        title,
        authors,
        linkedAuthors,
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
