import {
    GrapherProgrammaticInterface,
    GRAPHER_SETTINGS_DRAWER_ID,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    DataPageDataV2,
    FaqEntryData,
    ImageMetadata,
    SiteFooterContext,
} from "@ourworldindata/types"
import {
    mergePartialGrapherConfigs,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import { pick } from "lodash"
import React from "react"
import {
    BAKED_GRAPHER_URL,
    ADMIN_BASE_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import {
    OWID_DATAPAGE_CONTENT_ROOT_ID,
    DataPageV2Content,
} from "./DataPageV2Content.js"
// import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"
import { DebugProvider } from "./gdocs/DebugContext.js"

export const DataPageV2Body = (props: {
    grapher: GrapherInterface | undefined
    datapageData: DataPageDataV2
    baseUrl: string
    baseGrapherUrl: string
    isPreviewing: boolean
    faqEntries?: FaqEntryData
    imageMetadata: Record<string, ImageMetadata>
    tagToSlugMap: Record<string | number, string>
    canonicalUrl: string
    grapherKey?: string
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
        canonicalUrl,
        grapherKey,
    } = props
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
                                    imageMetadata,
                                }
                            )}`,
                        }}
                    />
                    <div id={OWID_DATAPAGE_CONTENT_ROOT_ID}>
                        <DebugProvider debug={isPreviewing}>
                            <DataPageV2Content
                                key={grapherKey}
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
                </>
            </main>

            {/* TODO: This screws up how data pages are rendered but
                  if we include it the viteUtils are pulled in and then
                  that includes fs-extra and then the admin breaks...
                <SiteFooter
                baseUrl={baseUrl}
                context={SiteFooterContext.dataPageV2}
                isPreviewing={isPreviewing}
            /> */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `window._OWID_GRAPHER_CONFIG = ${serializeJSONForHTML(
                        grapherConfig
                    )}`,
                }}
            />
        </body>
    )
}
