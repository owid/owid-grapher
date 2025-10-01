import * as _ from "lodash-es"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    SiteFooterContext,
    DataPageDataV2,
    serializeJSONForHTML,
    mergeGrapherConfigs,
    FaqEntryData,
    GrapherInterface,
    ImageMetadata,
    Url,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
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
import { DebugProvider } from "./gdocs/DebugProvider.js"
import { Html } from "./Html.js"
import { ArchiveContext } from "@ourworldindata/types"
import { DEFAULT_PAGE_DESCRIPTION } from "./dataPage.js"
import { JsonLdDataset } from "./JsonLdDataset.js"

export const DataPageV2 = (props: {
    grapher: GrapherInterface | undefined
    datapageData: DataPageDataV2
    baseUrl: string
    canonicalUrl: string
    isPreviewing: boolean
    faqEntries?: FaqEntryData
    imageMetadata: Record<string, ImageMetadata>
    tagToSlugMap: Record<string | number, string>
    archivedChartInfo?: ArchiveContext
    dataApiUrl?: string
}) => {
    const {
        grapher,
        datapageData,
        baseUrl,
        canonicalUrl,
        isPreviewing,
        faqEntries,
        tagToSlugMap,
        imageMetadata,
        archivedChartInfo,
    } = props
    const pageTitle = grapher?.title ?? datapageData.title.title
    const dataApiOrigin = Url.fromURL(DATA_API_URL).origin
    let pageDesc: string
    if (grapher?.subtitle?.length) {
        // convert subtitle from markdown to plaintext
        pageDesc = new MarkdownTextWrap({
            text: grapher.subtitle,
            fontSize: 10,
        }).plaintext
    } else pageDesc = DEFAULT_PAGE_DESCRIPTION

    const imageUrl: string = urljoin(
        baseUrl || "/",
        "default-grapher-thumbnail.png"
    )
    const imageWidth = "1200"
    const imageHeight = "628"

    const variableIds: number[] = _.uniq(
        _.compact(grapher?.dimensions?.map((d) => d.variableId))
    )

    const mergedGrapherConfig = mergeGrapherConfigs(
        datapageData.chartConfig as GrapherInterface,
        grapher ?? {}
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
    }

    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = _.pick(
        tagToSlugMap,
        datapageData.topicTagsLinks || []
    )

    const isOnArchivalPage = archivedChartInfo?.type === "archive-page"
    const assetMaps = isOnArchivalPage ? archivedChartInfo.assets : undefined

    const liveUrlIfIsArchive =
        archivedChartInfo?.type === "archive-page"
            ? archivedChartInfo.archiveNavigation.liveUrl
            : undefined
    const canonicalUrlForHead = liveUrlIfIsArchive ?? canonicalUrl

    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrlForHead}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
                staticAssetMap={assetMaps?.static}
                archivedChartInfo={archivedChartInfo}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                <IFrameDetector />
                <JsonLdDataset
                    grapher={grapher}
                    canonicalUrl={canonicalUrlForHead}
                    pageDesc={pageDesc}
                />
                <link rel="preconnect" href={dataApiOrigin} />
                {variableIds.flatMap((variableId) =>
                    [
                        getVariableDataRoute(DATA_API_URL, variableId, {
                            assetMap: assetMaps?.runtime,
                        }),
                        getVariableMetadataRoute(DATA_API_URL, variableId, {
                            assetMap: assetMaps?.runtime,
                        }),
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
                <link
                    rel="preload"
                    href="/fonts/PlayfairDisplayLatin-SemiBold.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="DataPage">
                <SiteHeader
                    archiveInfo={
                        isOnArchivalPage ? archivedChartInfo : undefined
                    }
                />
                <main>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window._OWID_DATAPAGEV2_PROPS = ${JSON.stringify(
                                {
                                    datapageData,
                                    faqEntries,
                                    canonicalUrl,
                                    archivedChartInfo,
                                    tagToSlugMap: minimalTagToSlugMap,
                                    imageMetadata,
                                }
                            )}`,
                        }}
                    />
                    <div id={OWID_DATAPAGE_CONTENT_ROOT_ID}>
                        <DebugProvider debug={isPreviewing}>
                            <DataPageV2Content
                                datapageData={datapageData}
                                grapherConfig={grapherConfig}
                                imageMetadata={imageMetadata}
                                isPreviewing={isPreviewing}
                                faqEntries={faqEntries}
                                canonicalUrl={canonicalUrl}
                                tagToSlugMap={tagToSlugMap}
                                archivedChartInfo={archivedChartInfo}
                            />
                        </DebugProvider>
                    </div>
                </main>
                <SiteFooter
                    context={SiteFooterContext.dataPageV2}
                    isPreviewing={isPreviewing}
                    archiveInfo={
                        isOnArchivalPage ? archivedChartInfo : undefined
                    }
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GRAPHER_CONFIG = ${serializeJSONForHTML(
                            grapherConfig
                        )}`,
                    }}
                />
            </body>
        </Html>
    )
}
