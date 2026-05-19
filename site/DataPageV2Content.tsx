import { useMemo } from "react"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    DataPageV2ContentFields,
    GrapherInterface,
    ImageMetadata,
} from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import DataPageRelatedContent from "./DataPageRelatedContent.js"
import DataPageSearch from "./DataPageSearch.js"
import MetadataSectionOnion from "./MetadataSectionOnion.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { getMetadataOverrideForSlug } from "./dataPageMetadataOverride.js"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

export const DataPageV2Content = ({
    datapageData: datapageDataFromProps,
    additionalIndicators,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    imageMetadata,
    archiveContext,
}: DataPageV2ContentFields & {
    grapherConfig: GrapherInterface
    imageMetadata: Record<string, ImageMetadata>
}) => {
    const metadataOverride = getMetadataOverrideForSlug(grapherConfig.slug)
    // When a METADATA override is supplied, it replaces both the
    // "what you should know" (descriptionKey) and the
    // "Notes on our processing step" (descriptionProcessing) sections.
    // The override carries the full curated content, so any auto-generated
    // processing notes would be redundant.
    const datapageData = metadataOverride
        ? ({
              ...datapageDataFromProps,
              ...metadataOverride,
              descriptionProcessing: undefined,
          } as typeof datapageDataFromProps)
        : datapageDataFromProps

    // Initialize the grapher for client-side rendering. The grapher's
    // "Cite" action button scrolls to the citation guidance section inside
    // the metadata onion below.
    const mergedGrapherConfig: GrapherProgrammaticInterface = useMemo(
        () => ({
            ...grapherConfig,
            bindUrlToWindow: typeof window !== "undefined",
            adminBaseUrl: ADMIN_BASE_URL,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            enableKeyboardShortcuts: typeof window !== "undefined",
            archiveContext,
            citeButtonHref: "#citation-guidance",
        }),
        [grapherConfig, archiveContext]
    )

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: {},
                imageMetadata,
                linkedCharts: {},
                linkedIndicators: {},
                relatedCharts: [],
                tags: [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <div className="DataPageContent__grapher-for-embed">
                    <GrapherWithFallback
                        config={mergedGrapherConfig}
                        useProvidedConfigOnly
                        slug={grapherConfig.slug!}
                        queryStr={
                            typeof window !== "undefined"
                                ? window?.location?.search
                                : undefined
                        }
                        enablePopulatingUrlParams
                        isEmbeddedInAnOwidPage={false}
                        isEmbeddedInADataPage={false}
                        isPreviewing={isPreviewing}
                    />
                </div>
                <div className="DataPageContent grid grid-cols-12-full-width">
                    <div className="span-cols-14 grid grid-cols-12-full-width">
                        <div className="chart-key-info col-start-2 span-cols-12">
                            {grapherConfig.slug && (
                                <GrapherWithFallback
                                    slug={grapherConfig.slug}
                                    config={mergedGrapherConfig}
                                    useProvidedConfigOnly
                                    id="explore-the-data"
                                    queryStr={
                                        typeof window !== "undefined"
                                            ? window?.location?.search
                                            : undefined
                                    }
                                    enablePopulatingUrlParams
                                    isEmbeddedInADataPage={true}
                                    isEmbeddedInAnOwidPage={false}
                                    isPreviewing={isPreviewing}
                                />
                            )}

                            <MetadataSectionOnion
                                datapageData={datapageData}
                                additionalIndicators={additionalIndicators}
                                faqEntries={faqEntries}
                                canonicalUrl={canonicalUrl}
                                archiveContext={archiveContext}
                            />
                        </div>
                    </div>
                    <div className="col-start-2 span-cols-12">
                        <DataPageSearch slug={grapherConfig.slug} />
                    </div>
                    <div className="col-start-2 span-cols-12">
                        <DataPageRelatedContent
                            slug={grapherConfig.slug}
                            enrichedRelatedContent={
                                datapageData.enrichedRelatedContent
                            }
                            primaryTopic={datapageData.primaryTopic}
                        />
                    </div>
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
