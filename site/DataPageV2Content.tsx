import { useMemo, useEffect, useState } from "react"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import { DATAPAGE_ABOUT_THIS_DATA_SECTION_ID } from "@ourworldindata/components"
import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
    DataPageV2ContentFields,
    GrapherInterface,
    ImageMetadata,
    defaultExperimentState,
    getExperimentState,
    ExperimentState,
    isUrlInActiveExperiment,
    DATA_PAGE_METADATA_EXPERIMENT_ID,
} from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { FeaturedMetrics } from "./FeaturedMetrics.js"
import { RelatedDataCharts } from "./RelatedDataCharts.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import DownloadSection, {
    type DownloadSectionProps,
} from "./DownloadSection.js"
import { processRelatedResearch } from "./dataPage.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { useWindowQueryParams } from "./hooks.js"
import IndicatorMetadataBox from "./IndicatorMetadataBox.js"
import AboutThisData from "./AboutThisData.js"
import DataPageResearchAndWriting from "./DataPageResearchAndWriting.js"
import MetadataSection from "./MetadataSection.js"
import { SiteQueryClientProvider } from "./SiteQueryClientProvider.js"
import { Autocomplete } from "./search/Autocomplete.js"

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
    const useNewDatapageDesign = isUrlInActiveExperiment(
        DATA_PAGE_METADATA_EXPERIMENT_ID,
        `/grapher/${slug}`
    )
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
            useNewDatapageMetadataLayout: useNewDatapageDesign,
        }),
        [grapherConfig, archiveContext, useNewDatapageDesign]
    )

    const relatedResearch = processRelatedResearch(
        datapageData.relatedResearch,
        datapageData.topicTagsLinks ?? []
    )

    // note: experimentState should NOT be used to conditionally render content b/c
    // it will cause a flash of content before js loads.
    const [experimentState, setExperimentState] = useState<ExperimentState>(
        defaultExperimentState
    )
    useEffect(() => {
        if (typeof window !== "undefined") {
            const s = getExperimentState()
            setExperimentState(s)
        }
    }, [])

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
                <div className="DataPageContent__grapher-for-embed">
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
                        <div className="chart-key-info col-start-2 span-cols-12">
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
                            {!useNewDatapageDesign && (
                                <AboutThisData
                                    datapageData={datapageData}
                                    hasFaq={!!faqEntries?.faqs.length}
                                    id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                />
                            )}
                        </div>
                        {useNewDatapageDesign && (
                            <IndicatorMetadataBox
                                datapageData={datapageData}
                                faqEntries={faqEntries}
                                canonicalUrl={canonicalUrl}
                                archiveContext={archiveContext}
                                id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                license={grapherConfig.license}
                            />
                        )}
                        {useNewDatapageDesign && (
                            <div className="datapage-search-wrapper span-cols-14 grid-cols-12-full-width grid">
                                <h2 className="h2-bold span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                                    What do you want to see next?
                                </h2>
                                <div className="datapage-search span-cols-9 col-start-2 col-md-start-2 span-md-cols-12 col-sm-start-2 span-sm-cols-12">
                                    <SiteQueryClientProvider>
                                        <Autocomplete
                                            id="datapage-autocomplete"
                                            className="datapage-search__input"
                                            panelClassName="datapage-search__panel"
                                            placeholder="Search across all our charts and writing"
                                            searchSource="datapage"
                                        />
                                    </SiteQueryClientProvider>
                                </div>
                            </div>
                        )}
                        {useNewDatapageDesign &&
                            relatedResearch &&
                            relatedResearch.length > 0 && (
                                <div className="datapage-research-and-writing-v2 col-start-2 span-cols-12">
                                    <DataPageResearchAndWriting
                                        relatedResearch={relatedResearch}
                                    />
                                </div>
                            )}

                        {useNewDatapageDesign &&
                            datapageData.relatedChartsByCoview &&
                            datapageData.relatedChartsByCoview.length > 0 && (
                                <>
                                    <h2 className="datapage-v2__related-charts-heading span-cols-12 col-start-2 h2-bold">
                                        Related charts
                                    </h2>
                                    <div className="span-cols-14 grid grid-cols-12-full-width">
                                        <RelatedDataCharts
                                            className="col-start-2 span-cols-12"
                                            charts={
                                                datapageData.relatedChartsByCoview
                                            }
                                        />
                                    </div>
                                </>
                            )}
                    </div>
                    {useNewDatapageDesign &&
                        downloadSection && (
                            // The new design moves sources/processing/citations into
                            // the IndicatorMetadataBox above, so only the data
                            // download remains here. Rendered with the same wrapper
                            // markup MetadataSection used so the layout is unchanged.
                            <div className="MetadataSection span-cols-14 grid grid-cols-12-full-width">
                                <div className="col-start-2 span-cols-12">
                                    <div className="section-wrapper grid">
                                        {downloadSection}
                                    </div>
                                </div>
                            </div>
                        )}
                    {!useNewDatapageDesign && (
                        <>
                            <div className="col-start-2 span-cols-12">
                                {datapageData.allCharts &&
                                datapageData.allCharts.length > 0 ? (
                                    <div
                                        className={`section-wrapper section-wrapper__related-charts ${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1${EXPERIMENT_ARM_SEPARATOR}featured-metrics--hide`}
                                    >
                                        <h2
                                            className="related-charts__title"
                                            id="all-charts"
                                        >
                                            Explore charts that include this
                                            data
                                        </h2>
                                        <div>
                                            <RelatedCharts
                                                charts={datapageData.allCharts}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                                {datapageData.primaryTopic && (
                                    <div
                                        className={`section-wrapper ${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1${EXPERIMENT_ARM_SEPARATOR}featured-metrics--show`}
                                        id={
                                            experimentState &&
                                            experimentState[
                                                `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                            ]?.isPageInExperiment &&
                                            experimentState[
                                                `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                            ]?.arm === "featured-metrics"
                                                ? "all-charts"
                                                : ""
                                        }
                                    >
                                        <SiteQueryClientProvider>
                                            <FeaturedMetrics
                                                topicName={
                                                    datapageData.primaryTopic
                                                        .topicTag
                                                }
                                                isDataPage={true}
                                            />
                                        </SiteQueryClientProvider>
                                    </div>
                                )}
                            </div>
                            <MetadataSection
                                attributionShort={datapageData.attributionShort}
                                attributions={datapageData.attributions}
                                canonicalUrl={canonicalUrl}
                                descriptionProcessing={
                                    datapageData.descriptionProcessing
                                }
                                faqEntries={faqEntries}
                                license={grapherConfig.license}
                                origins={datapageData.origins}
                                owidProcessingLevel={
                                    datapageData.owidProcessingLevel
                                }
                                primaryTopic={datapageData.primaryTopic}
                                source={datapageData.source}
                                title={datapageData.title}
                                titleVariant={datapageData.titleVariant}
                                archiveContext={archiveContext}
                                downloadSection={downloadSection}
                            />
                        </>
                    )}
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
