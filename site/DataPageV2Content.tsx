import { useMemo } from "react"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import { DATAPAGE_ABOUT_THIS_DATA_SECTION_ID } from "@ourworldindata/components"
import {
    DataPageV2ContentFields,
    GrapherInterface,
    ImageMetadata,
} from "@ourworldindata/utils"
import { RelatedDataCharts } from "./RelatedDataCharts.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.mjs"
import DownloadSection, {
    type DownloadSectionProps,
} from "./DownloadSection.js"
import { processRelatedResearch } from "./dataPage.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { useWindowQueryParams } from "./hooks.js"
import IndicatorMetadataBox from "./IndicatorMetadataBox.js"
import DataPageResearchAndWriting from "./DataPageResearchAndWriting.js"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

type DataPageDownloadSectionProps = Pick<
    DownloadSectionProps,
    "archivedChartInfo" | "baseUrl" | "distribution" | "slug"
>

function DataPageDownloadSection({
    archivedChartInfo,
    baseUrl,
    distribution,
    slug,
}: DataPageDownloadSectionProps) {
    const reactiveQueryStr = useWindowQueryParams()
    const searchParams = new URLSearchParams(reactiveQueryStr)

    return (
        <DownloadSection
            slug={slug}
            baseUrl={baseUrl}
            searchParams={searchParams}
            distribution={distribution}
            archivedChartInfo={archivedChartInfo}
        />
    )
}

export const DataPageV2Content = ({
    datapageData,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    imageMetadata,
    archiveContext,
    distribution,
}: DataPageV2ContentFields & {
    grapherConfig: GrapherInterface
    imageMetadata: Record<string, ImageMetadata>
}) => {
    const slug = grapherConfig.slug
    const queryStr =
        typeof window !== "undefined" ? window?.location?.search : undefined

    // Initialize the grapher for client-side rendering
    const mergedGrapherConfig: GrapherProgrammaticInterface = useMemo(
        () => ({
            ...grapherConfig,
            bindUrlToWindow: typeof window !== "undefined",
            adminBaseUrl: ADMIN_BASE_URL,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            enableKeyboardShortcuts: typeof window !== "undefined",
            archiveContext,
            useNewDatapageMetadataLayout: true,
        }),
        [grapherConfig, archiveContext]
    )

    const relatedResearch = processRelatedResearch(
        datapageData.relatedResearch,
        datapageData.topicTagsLinks ?? []
    )

    // Note: yColumns is not passed here, which means the short column names
    // option won't be visible in the download section on data pages. To enable
    // this feature, we'd need to load variable metadata on the server and pass
    // the column definitions through to this component.
    const downloadSection = slug ? (
        <DataPageDownloadSection
            slug={slug}
            baseUrl={`${BAKED_GRAPHER_URL}/${slug}`}
            distribution={distribution}
            archivedChartInfo={archiveContext}
        />
    ) : undefined

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: {},
                imageMetadata,
                linkedCharts: {},
                linkedIndicators: {},
                linkedAuthors: datapageData.linkedAuthors,
                relatedCharts: [],
                tags: [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <div
                    className="DataPageContent__grapher-for-embed"
                    data-dod-track-note="grapher"
                >
                    <GrapherWithFallback
                        config={mergedGrapherConfig}
                        useProvidedConfigOnly
                        slug={grapherConfig.slug}
                        queryStr={queryStr}
                        enablePopulatingUrlParams
                        isEmbeddedInAnOwidPage={false}
                        isEmbeddedInADataPage={false}
                        isPreviewing={isPreviewing}
                    />
                </div>
                <div className="DataPageContent grid grid-cols-12-full-width">
                    <div className="span-cols-14 grid grid-cols-12-full-width full-width--border">
                        <div
                            className="chart-key-info col-start-2 span-cols-12"
                            data-dod-track-note="grapher"
                        >
                            {grapherConfig.slug && (
                                <GrapherWithFallback
                                    slug={grapherConfig.slug}
                                    config={mergedGrapherConfig}
                                    useProvidedConfigOnly
                                    id="explore-the-data"
                                    queryStr={queryStr}
                                    enablePopulatingUrlParams
                                    isEmbeddedInADataPage={true}
                                    isEmbeddedInAnOwidPage={false}
                                    isPreviewing={isPreviewing}
                                />
                            )}
                        </div>
                        <IndicatorMetadataBox
                            datapageData={datapageData}
                            faqEntries={faqEntries}
                            canonicalUrl={canonicalUrl}
                            archiveContext={archiveContext}
                            id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                            license={grapherConfig.license}
                        />
                        {relatedResearch && relatedResearch.length > 0 && (
                            <div className="datapage-research-and-writing-v2 col-start-2 span-cols-12">
                                <DataPageResearchAndWriting
                                    relatedResearch={relatedResearch}
                                />
                            </div>
                        )}
                        {datapageData.relatedCharts.length > 0 && (
                            <>
                                <h2 className="datapage-v2__related-charts-heading span-cols-12 col-start-2 h2-bold">
                                    Related charts
                                </h2>
                                <div className="span-cols-14 grid grid-cols-12-full-width">
                                    <RelatedDataCharts
                                        className="col-start-2 span-cols-12"
                                        charts={datapageData.relatedCharts}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    {downloadSection && (
                        // Sources, processing and citations live in the
                        // IndicatorMetadataBox above, so only the data download
                        // remains down here.
                        <div className="MetadataSection span-cols-14 grid grid-cols-12-full-width">
                            <div className="col-start-2 span-cols-12">
                                <div className="section-wrapper grid">
                                    {downloadSection}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
