import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GRAPHER_SETTINGS_DRAWER_ID,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    uniq,
    SiteFooterContext,
    DataPageDataV2,
    serializeJSONForHTML,
    mergePartialGrapherConfigs,
    compact,
    FaqEntryData,
    pick,
    GrapherInterface,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import React from "react"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import {
    DataPageV2Content,
    OWID_DATAPAGE_CONTENT_ROOT_ID,
} from "./DataPageV2Content.js"
import { Head } from "./Head.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"
import { IFrameDetector } from "./IframeDetector.js"
import { DebugProvider } from "./gdocs/DebugContext.js"

export const DataPageV2 = (props: {
    grapher: GrapherInterface | undefined
    datapageData: DataPageDataV2
    baseUrl: string
    baseGrapherUrl: string
    isPreviewing: boolean
    faqEntries?: FaqEntryData
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

    const mergedGrapherConfig = mergePartialGrapherConfigs(
        datapageData.chartConfig as GrapherInterface,
        grapher
    )

    // Note that we cannot set `bindUrlToWindow` and `isEmbeddedInADataPage` here,
    // because this would then get serialized into the EMBEDDED_JSON object,
    // and MultiEmbedder would then pick it up for other charts on the page
    // _aside_ from the main one (e.g. the related charts block),
    // which we don't want to happen.
    const grapherConfig: GrapherProgrammaticInterface = {
        ...mergedGrapherConfig,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        adminBaseUrl: ADMIN_BASE_URL,
        dataApiUrl: DATA_API_URL,
    }

    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(
        tagToSlugMap,
        datapageData.topicTagsLinks || []
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
            <body className="DataPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <>
                        <nav id={GRAPHER_SETTINGS_DRAWER_ID}></nav>
                        <script
                            dangerouslySetInnerHTML={{
                                __html: `window._OWID_DATAPAGEV2_PROPS = ${JSON.stringify(
                                    {
                                        datapageData,
                                        faqEntries,
                                        canonicalUrl,
                                        tagToSlugMap: minimalTagToSlugMap,
                                    }
                                )}`,
                            }}
                        />
                        <div id={OWID_DATAPAGE_CONTENT_ROOT_ID}>
                            <DebugProvider debug={isPreviewing}>
                                <DataPageV2Content
                                    datapageData={datapageData}
                                    grapherConfig={grapherConfig}
                                    isPreviewing={isPreviewing}
                                    faqEntries={faqEntries}
                                    canonicalUrl={canonicalUrl}
                                    tagToSlugMap={tagToSlugMap}
                                />
                            </DebugProvider>
                        </div>
                    </>
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.dataPageV2}
                    isPreviewing={isPreviewing}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GRAPHER_CONFIG = ${serializeJSONForHTML(
                            grapherConfig
                        )}`,
                    }}
                />
            </body>
        </html>
    )
}
