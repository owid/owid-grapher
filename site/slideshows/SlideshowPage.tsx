import React from "react"
import { Head } from "./../Head.js"
import { SiteFooter } from "./../SiteFooter.js"
import { Html } from "./../Html.js"
import {
    SiteFooterContext,
    ImageMetadata,
    LinkedAuthor,
    ResolvedSlideChartInfo,
    SlideTemplate,
    SlideshowConfig,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
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
    } = props

    const canonicalUrl = `${baseUrl}/slideshows/${slug}`

    const presentationProps: SlideshowPresentationProps = {
        title,
        authors,
        linkedAuthors,
        slides,
        imageMetadata,
        chartResolutions,
    }

    // Collect all image URLs for preloading
    const imageUrls: string[] = []
    for (const slide of slides) {
        if (slide.template === SlideTemplate.Image && slide.filename) {
            const metadata = imageMetadata[slide.filename]
            if (metadata?.cloudflareId) {
                imageUrls.push(
                    `${CLOUDFLARE_IMAGES_URL}/${metadata.cloudflareId}/public`
                )
            }
        }
    }

    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={title}
                pageDesc={`${title} — Our World in Data slideshow`}
                baseUrl={baseUrl}
            >
                {imageUrls.map((url) => (
                    <link key={url} rel="preload" as="image" href={url} />
                ))}
            </Head>
            <body id="slideshow-page-body">
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
