import { useMemo, useEffect, useState } from "react"
import cx from "classnames"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    REUSE_THIS_WORK_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
} from "@ourworldindata/components"
import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
    DataPageV2ContentFields,
    GrapherInterface,
    joinTitleFragments,
    ImageMetadata,
    excludeNull,
    defaultExperimentState,
    getExperimentState,
    ExperimentState,
    shuffleArray,
} from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { FeaturedMetrics } from "./FeaturedMetrics.js"
import StickyNav from "./blocks/StickyNav.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import AboutThisData from "./AboutThisData.js"
import DataPageResearchAndWriting from "./DataPageResearchAndWriting.js"
import MetadataSection from "./MetadataSection.js"
import TopicTags from "./TopicTags.js"
import { processRelatedResearch } from "./dataPage.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { BlockQueryClientProvider } from "./gdocs/components/BlockQueryClientProvider.js"
import { Autocomplete } from "./search/Autocomplete.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

const SUGGESTED_SEARCHES = [
    { slug: "child-mortality", query: "Infant mortality" },
    {
        slug: "child-mortality",
        query: "Causes of death in children under five",
    },
    {
        slug: "child-mortality",
        query: "Diarrheal disease deaths in children under five",
    },
    { slug: "child-mortality", query: "Pneumonia risk factors" },
    { slug: "child-mortality", query: "Share of children vaccinated" },
    { slug: "child-mortality", query: "Maternal mortality ratio" },
]

export const DataPageV2Content = ({
    datapageData,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    tagToSlugMap,
    imageMetadata,
    archiveContext,
}: DataPageV2ContentFields & {
    grapherConfig: GrapherInterface
    imageMetadata: Record<string, ImageMetadata>
}) => {
    const titleFragments = joinTitleFragments(
        datapageData.attributionShort,
        datapageData.titleVariant
    )

    // Initialize the grapher for client-side rendering
    const mergedGrapherConfig: GrapherProgrammaticInterface = useMemo(
        () => ({
            ...grapherConfig,
            bindUrlToWindow: typeof window !== "undefined",
            adminBaseUrl: ADMIN_BASE_URL,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            enableKeyboardShortcuts: typeof window !== "undefined",
            archiveContext,
        }),
        [grapherConfig, archiveContext]
    )
    const stickyNavLinks = excludeNull([
        {
            text: "Explore the Data",
            target: "#explore-the-data",
        },
        datapageData.relatedResearch?.length
            ? {
                  text: "Research & Writing",
                  target: "#research-and-writing",
              }
            : null,
        datapageData.allCharts?.length
            ? { text: "All Charts", target: "#all-charts" }
            : null,
        faqEntries?.faqs?.length ? { text: "FAQs", target: "#faqs" } : null,
        {
            text: "Sources & Processing",
            target: "#" + DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
        },
        { text: "Reuse This Work", target: "#" + REUSE_THIS_WORK_SECTION_ID },
    ])

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
    const { isPageInExperiment, assignedExperiments } = experimentState

    const suggestedSearchesOrientation = "horizontal"
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
                    <div className="bg-blue-10 span-cols-14">
                        <div className="header__wrapper grid grid-cols-12-full-width">
                            <div className="header__left col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                                <div className="header__supertitle">Data</div>
                                <h1 className="header__title">
                                    {datapageData.title.title}
                                </h1>
                                <div className="header__source">
                                    {titleFragments}
                                </div>
                            </div>
                            <TopicTags
                                className="header__right col-start-10 span-cols-4 col-sm-start-2 span-sm-cols-12"
                                topicTagsLinks={datapageData.topicTagsLinks}
                                tagToSlugMap={tagToSlugMap}
                            />
                        </div>
                    </div>
                    <nav className="sticky-nav sticky-nav--dark span-cols-14 grid grid-cols-12-full-width">
                        <StickyNav
                            className="span-cols-12 col-start-2"
                            links={stickyNavLinks}
                        />
                    </nav>
                    <div className="span-cols-14 grid grid-cols-12-full-width full-width--border">
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

                            <div
                                className={`datapage-search-wrapper span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2 ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat1--show ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat2--show`}
                            >
                                <div className="datapage-search">
                                    <Autocomplete
                                        className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"
                                        panelClassName="datapage-search__panel"
                                        placeholder="What do you want to see next?"
                                    />
                                    <SuggestedSearches
                                        grapherSlug={grapherConfig.slug}
                                        orientation={
                                            suggestedSearchesOrientation
                                        }
                                    />
                                </div>
                            </div>

                            <AboutThisData
                                datapageData={datapageData}
                                hasFaq={!!faqEntries?.faqs.length}
                                id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                            />
                        </div>
                    </div>
                    <div
                        className={`col-start-2 span-cols-12 ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat2--hide`}
                    >
                        {relatedResearch && relatedResearch.length > 0 && (
                            <DataPageResearchAndWriting
                                relatedResearch={relatedResearch}
                            />
                        )}
                        {datapageData.allCharts &&
                        datapageData.allCharts.length > 0 ? (
                            <div
                                className={`section-wrapper section-wrapper__related-charts ${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1${EXPERIMENT_ARM_SEPARATOR}featured-metrics--hide`}
                            >
                                <h2
                                    className="related-charts__title"
                                    id={
                                        isPageInExperiment &&
                                        assignedExperiments &&
                                        assignedExperiments[
                                            `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                        ] &&
                                        assignedExperiments[
                                            `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                        ] !== "all-charts"
                                            ? ""
                                            : "all-charts"
                                    }
                                >
                                    Explore charts that include this data
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
                                    isPageInExperiment &&
                                    assignedExperiments &&
                                    assignedExperiments[
                                        `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                    ] &&
                                    assignedExperiments[
                                        `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                    ] === "featured-metrics"
                                        ? "all-charts"
                                        : ""
                                }
                            >
                                <BlockQueryClientProvider>
                                    <FeaturedMetrics
                                        topicName={
                                            datapageData.primaryTopic.topicTag
                                        }
                                        isDataPage={true}
                                    />
                                </BlockQueryClientProvider>
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
                        origins={datapageData.origins}
                        owidProcessingLevel={datapageData.owidProcessingLevel}
                        primaryTopic={datapageData.primaryTopic}
                        source={datapageData.source}
                        title={datapageData.title}
                        titleVariant={datapageData.titleVariant}
                        archiveContext={archiveContext}
                    />
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}

const SuggestedSearches = ({
    grapherSlug,
    orientation = "horizontal",
}: {
    grapherSlug: string | undefined
    orientation?: "horizontal" | "vertical"
}) => {
    const shuffledSuggestions = useMemo(() => {
        if (!grapherSlug) return []
        const filtered = SUGGESTED_SEARCHES.filter(
            (s) => s.slug === grapherSlug
        )
        return shuffleArray(filtered)
    }, [grapherSlug])

    if (shuffledSuggestions.length === 0) return null

    const isVertical = orientation === "vertical"

    return (
        <div
            className={cx(
                "suggested-searches",
                isVertical && "suggested-searches--vertical"
            )}
        >
            {shuffledSuggestions.map((suggestion, index) => (
                <a
                    key={index}
                    href={`/search?q=${encodeURIComponent(suggestion.query)}`}
                    className={cx(
                        "suggested-search-item",
                        isVertical && "suggested-search-item--vertical"
                    )}
                >
                    <FontAwesomeIcon
                        icon={faMagnifyingGlass}
                        className="suggested-search-item__icon"
                    />
                    <span className="suggested-search-item__text">
                        {suggestion.query}
                    </span>
                </a>
            ))}
        </div>
    )
}
