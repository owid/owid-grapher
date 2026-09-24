import { useMemo, useEffect, useState } from "react"
import {
    GrapherProgrammaticInterface,
    GuidedChartContext,
    GrapherState,
} from "@ourworldindata/grapher"
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
    isDataPageMetadataRedesignActive,
} from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { FeaturedMetrics } from "./FeaturedMetrics.js"
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
import AboutThisData from "./AboutThisData.js"
import DataPageResearchAndWriting from "./DataPageResearchAndWriting.js"
import MetadataSection from "./MetadataSection.js"
import { SiteQueryClientProvider } from "./SiteQueryClientProvider.js"
import { useDataPerspectives } from "./useDataPerspectives.js"
import { DataPerspectivesPageSwipe } from "./DataPerspectivesPageSwipe.js"
import { DataPerspectivesAccordion } from "./DataPerspectivesAccordion.js"
import { DataPerspectivesIgnoredParams } from "./DataPerspectivesIgnoredParams.js"
import { DataPageUpNext } from "./DataPageUpNext.js"
import { UP_NEXT_ARTICLES } from "./upNextArticles.js"

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
    const useNewDatapageDesign = isDataPageMetadataRedesignActive(
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

    // Data perspectives prototype (?dpLayout=pageswipe|accordion). With no
    // dpLayout the page renders exactly as it does without the prototype.
    const dp = useDataPerspectives(slug)
    // ?dpUpNext=1: an "Up next" article carousel in place of Research & writing.
    const upNextArticles =
        dp.variant.upNext && slug ? (UP_NEXT_ARTICLES[slug] ?? []) : []
    const upNext =
        upNextArticles.length > 0 ? (
            <DataPageUpNext articles={upNextArticles} />
        ) : null

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
                <DataPerspectivesIgnoredParams ignored={dp.variant.ignored} />
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
                            {grapherConfig.slug &&
                            dp.variant.layout === "accordion" ? (
                                // The page becomes a list of perspectives, each
                                // expanding into its own chart, in place of the
                                // page's chart.
                                <DataPerspectivesAccordion
                                    slug={grapherConfig.slug}
                                    perspectives={dp.perspectives}
                                    renderGrapher={(queryParams) => (
                                        <GrapherWithFallback
                                            key={queryParams}
                                            slug={grapherConfig.slug}
                                            // Several graphers take turns here;
                                            // none of them should own the URL.
                                            config={{
                                                ...mergedGrapherConfig,
                                                bindUrlToWindow: false,
                                            }}
                                            useProvidedConfigOnly
                                            queryStr={`?${queryParams}`}
                                            isEmbeddedInADataPage={true}
                                            isEmbeddedInAnOwidPage={false}
                                            isPreviewing={isPreviewing}
                                        />
                                    )}
                                />
                            ) : grapherConfig.slug &&
                              dp.variant.layout === "pageswipe" ? (
                                // Provides grapherStateRef, so swiping can
                                // drive this chart in place.
                                <GuidedChartContext.Provider
                                    value={{
                                        grapherStateRef:
                                            dp.grapherStateRef as React.RefObject<GrapherState>,
                                        chartRef:
                                            dp.chartRef as React.RefObject<HTMLDivElement>,
                                    }}
                                >
                                    <div
                                        className={dp.wrapperClassName}
                                        ref={dp.chartRef}
                                    >
                                        <DataPerspectivesPageSwipe
                                            perspectives={dp.perspectives}
                                            style={dp.variant.style}
                                            hintReset={dp.variant.hintReset}
                                            narrativeStale={dp.narrativeStale}
                                            narrativeStaleMode={
                                                dp.variant.narrativeStale
                                            }
                                            onSelect={dp.applyPerspective}
                                            onRestoreNarrative={
                                                dp.restoreNarrative
                                            }
                                        />

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
                                    </div>
                                </GuidedChartContext.Provider>
                            ) : grapherConfig.slug ? (
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
                            ) : null}
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
                        {useNewDatapageDesign &&
                            relatedResearch &&
                            relatedResearch.length > 0 && (
                                <div className="datapage-research-and-writing-v2 col-start-2 span-cols-12">
                                    {upNext ?? (
                                        <DataPageResearchAndWriting
                                            relatedResearch={relatedResearch}
                                        />
                                    )}
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
                                {upNext ??
                                    (relatedResearch &&
                                        relatedResearch.length > 0 && (
                                            <DataPageResearchAndWriting
                                                relatedResearch={
                                                    relatedResearch
                                                }
                                            />
                                        ))}
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
