import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    uniq,
    SiteFooterContext,
    DataPageDataV2,
    serializeJSONForHTML,
    mergeGrapherConfigs,
    compact,
    FaqEntryData,
    pick,
    GrapherInterface,
    ImageMetadata,
    Url,
    AssetMapEntry,
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

export const DataPageV2 = (props: {
    grapher: GrapherInterface | undefined
    datapageData: DataPageDataV2
    baseUrl: string
    baseGrapherUrl: string
    isPreviewing: boolean
    faqEntries?: FaqEntryData
    imageMetadata: Record<string, ImageMetadata>
    tagToSlugMap: Record<string | number, string>
    viteAssetMap?: AssetMapEntry
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
        viteAssetMap,
    } = props
    const pageTitle = grapher?.title ?? datapageData.title.title
    const canonicalUrl = grapher?.slug
        ? urljoin(baseGrapherUrl, grapher.slug as string)
        : ""
    const dataApiOrigin = Url.fromURL(DATA_API_URL).origin
    let pageDesc: string
    if (grapher?.subtitle?.length) {
        // convert subtitle from markdown to plaintext
        pageDesc = new MarkdownTextWrap({
            text: grapher.subtitle,
            fontSize: 10,
        }).plaintext
    } else pageDesc = "An interactive visualization from Our World in Data."

    const imageUrl: string = urljoin(baseUrl, "default-grapher-thumbnail.png")
    const imageWidth = "1200"
    const imageHeight = "628"

    const variableIds: number[] = uniq(
        compact(grapher?.dimensions?.map((d) => d.variableId))
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
        dataApiUrl: DATA_API_URL,
    }

    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(
        tagToSlugMap,
        datapageData.topicTagsLinks || []
    )

    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
                viteAssetMap={viteAssetMap}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                <IFrameDetector />
                <link rel="preconnect" href={dataApiOrigin} />
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
                <link
                    rel="preload"
                    href="/fonts/PlayfairDisplayLatin-SemiBold.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="DataPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window._OWID_DATAPAGEV2_PROPS = ${JSON.stringify(
                                {
                                    datapageData,
                                    faqEntries,
                                    canonicalUrl,
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
                            />
                        </DebugProvider>
                    </div>
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.dataPageV2}
                    isPreviewing={isPreviewing}
                    viteAssetMap={viteAssetMap}
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
