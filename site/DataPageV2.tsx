import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import {
    uniq,
    DataPageDataV2,
    compact,
    FaqEntryData,
    GrapherInterface,
    ImageMetadata,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import React from "react"
import urljoin from "url-join"
import { DATA_API_URL } from "../settings/clientSettings.js"
import { Head } from "./Head.js"
import { IFrameDetector } from "./IframeDetector.js"
import { DataPageV2Body } from "./DataPageV2Body.js"

export const DataPageV2 = (props: {
    grapher: GrapherInterface | undefined
    datapageData: DataPageDataV2
    baseUrl: string
    baseGrapherUrl: string
    isPreviewing: boolean
    faqEntries?: FaqEntryData
    imageMetadata: Record<string, ImageMetadata>
    tagToSlugMap: Record<string | number, string>
}) => {
    const {
        grapher,
        datapageData,
        baseGrapherUrl,
        baseUrl,
        isPreviewing,
        faqEntries,
        tagToSlugMap,
        imageMetadata,
    } = props
    const pageTitle = grapher?.title ?? datapageData.title.title
    const canonicalUrl = grapher?.slug
        ? urljoin(baseGrapherUrl, grapher.slug as string)
        : ""
    let pageDesc: string
    if (grapher?.subtitle?.length) {
        // convert subtitle from markdown to plaintext
        pageDesc = new MarkdownTextWrap({
            text: grapher.subtitle,
            fontSize: 10,
        }).plaintext
    } else pageDesc = "An interactive visualization from Our World in Data."

    // Due to thumbnails not taking into account URL parameters, they are often inaccurate on
    // social media. We decided to remove them and use a single thumbnail for all charts.
    // See https://github.com/owid/owid-grapher/issues/1086
    //
    // const imageUrl = urljoin(
    //     baseGrapherUrl,
    //     "exports",
    //     `${grapher.slug}.png?v=${grapher.version}`
    // )
    const imageUrl: string = urljoin(baseUrl, "default-grapher-thumbnail.png")
    const imageWidth = "1200"
    const imageHeight = "628"

    const variableIds: number[] = uniq(
        compact(grapher?.dimensions?.map((d) => d.variableId))
    )

    return (
        <html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                <IFrameDetector />
                <noscript>
                    <style>{`
                    figure[data-grapher-src] { display: none !important; }
                `}</style>
                </noscript>
                {variableIds.flatMap((variableId) =>
                    [
                        getVariableDataRoute(DATA_API_URL, variableId),
                        getVariableMetadataRoute(DATA_API_URL, variableId),
                    ].map((href) => (
                        <link
                            key={href}
                            rel="preload"
                            href={href}
                            as="fetch"
                            crossOrigin="anonymous"
                        />
                    ))
                )}
            </Head>
            <DataPageV2Body {...props} canonicalUrl={canonicalUrl} />
        </html>
    )
}
