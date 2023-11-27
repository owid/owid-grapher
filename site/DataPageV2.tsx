import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GRAPHER_SETTINGS_DRAWER_ID,
    GrapherInterface,
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
}) => {
    const {
        grapher,
        datapageData,
        baseGrapherUrl,
        baseUrl,
        isPreviewing,
        faqEntries,
    } = props
    const pageTitle = grapher?.title ?? datapageData.title
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

    const grapherConfig: GrapherProgrammaticInterface = {
        ...mergedGrapherConfig,
        isEmbeddedInADataPage: true,
        bindUrlToWindow: true,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        adminBaseUrl: ADMIN_BASE_URL,
        dataApiUrl: DATA_API_URL,
    }

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
