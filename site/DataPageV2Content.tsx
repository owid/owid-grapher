import { useMemo, useEffect, useState } from "react"
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
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"
import { getSuggestedKeywordsForTopics } from "./data/topicVocabulary.js"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { FeaturedMetrics } from "./FeaturedMetrics.js"
import StickyNav from "./blocks/StickyNav.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import AboutThisData from "./AboutThisData.js"
import DataPageResearchAndWriting from "./DataPageResearchAndWriting.js"
import { type DownloadSectionProps } from "./DownloadSection.js"
import MetadataSection from "./MetadataSection.js"
import TopicTags from "./TopicTags.js"
import { processRelatedResearch } from "./dataPage.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { SiteQueryClientProvider } from "./SiteQueryClientProvider.js"
import { useWindowQueryParams } from "./hooks.js"
import { Autocomplete } from "./search/Autocomplete.js"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

export const DataPageV2Content = ({
    datapageData,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    tagToSlugMap,
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
    const reactiveQueryStr = useWindowQueryParams()
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

    // The assigned arm for the data-page-search experiment, used to drive the
    // Autocomplete `showSuggestionsWhenEmpty` prop. Initial render returns
    // undefined (server + first client render before the cookie has been
    // read), so the autocomplete defaults to showing featured searches —
    // safe because the dropdown is closed until the user focuses the input,
    // by which time the experiment state has loaded.
    const searchArm =
        experimentState[`${EXPERIMENT_PREFIX}-data-page-search-v1`]?.arm

    const downloadProps: DownloadSectionProps | undefined = useMemo(() => {
        if (!slug) return undefined

        // Note: yColumns is not passed here, which means the short column names
        // option won't be visible in the download section on data pages.
        //
        // To enable this feature on data pages, we would need to:
        // 1. Load variable metadata on the server to get column definitions with shortName
        // 2. Pass that data through to this component (similar to how datapageData is passed)
        // 3. Extract yColumns from the variable metadata and pass them here
        //
        // Without yColumns, users can still download data via the API URLs shown
        // in the "Data API" section, where they can manually add
        // &useColumnShortNames=true
        return {
            slug,
            baseUrl: `${BAKED_GRAPHER_URL}/${slug}`,
            searchParams: new URLSearchParams(reactiveQueryStr),
            distribution,
        }
    }, [distribution, reactiveQueryStr, slug])

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
                        slug={grapherConfig.slug}
                        queryStr={queryStr}
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
                                    queryStr={queryStr}
                                    enablePopulatingUrlParams
                                    isEmbeddedInADataPage={true}
                                    isEmbeddedInAnOwidPage={false}
                                    isPreviewing={isPreviewing}
                                />
                            )}

                            <AboutThisData
                                datapageData={datapageData}
                                hasFaq={!!faqEntries?.faqs.length}
                                id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                            />

                            <div
                                className={`datapage-search-wrapper ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat1--show ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat2--show ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat3--show`}
                            >
                                <div className="datapage-search">
                                    <h2 className="datapage-search__heading">
                                        Search all our content
                                    </h2>
                                    <SiteQueryClientProvider>
                                        <Autocomplete
                                            id="datapage-autocomplete"
                                            className="datapage-search__input"
                                            panelClassName="datapage-search__panel"
                                            placeholder="What do you want to see next?"
                                            // Hide default featured-search
                                            // suggestions on focus for the
                                            // arms that show their own topic-
                                            // driven suggestion pills below
                                            // the input (past searches still
                                            // surface because that plugin is
                                            // unconditional). treat1 keeps
                                            // the default suggestions since
                                            // it has no pills.
                                            showSuggestionsWhenEmpty={
                                                searchArm !== "treat2" &&
                                                searchArm !== "treat3"
                                            }
                                        />
                                    </SiteQueryClientProvider>
                                    <div
                                        className={`${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat2--show ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat3--show`}
                                    >
                                        <SuggestedSearches
                                            topicTagsLinks={
                                                datapageData.topicTagsLinks
                                            }
                                            tagToSlugMap={tagToSlugMap}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div
                        className={`col-start-2 span-cols-12 ${EXPERIMENT_PREFIX}-data-page-search-v1${EXPERIMENT_ARM_SEPARATOR}treat3--hide`}
                    >
                        {relatedResearch && relatedResearch.length > 0 && (
                            <DataPageResearchAndWriting
                                relatedResearch={relatedResearch}
                            />
                        )}
                        {/*
                         * The id is swapped between the all-charts section and the
                         * featured-metrics section based on experiment arm so that the
                         * #all-charts sticky nav link always scrolls to the visible
                         * element. Browsers won't scroll to a display:none element, so
                         * a static id on the all-charts section would break navigation
                         * in the featured-metrics arm.
                         */}
                        {datapageData.allCharts &&
                        datapageData.allCharts.length > 0 ? (
                            <div
                                className={`section-wrapper section-wrapper__related-charts ${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1${EXPERIMENT_ARM_SEPARATOR}featured-metrics--hide`}
                            >
                                <h2
                                    className="related-charts__title"
                                    id={
                                        experimentState &&
                                        experimentState[
                                            `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                        ]?.isPageInExperiment &&
                                        experimentState[
                                            `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                        ]?.arm !== "all-charts"
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
                                            datapageData.primaryTopic.topicTag
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
                        origins={datapageData.origins}
                        owidProcessingLevel={datapageData.owidProcessingLevel}
                        primaryTopic={datapageData.primaryTopic}
                        source={datapageData.source}
                        title={datapageData.title}
                        titleVariant={datapageData.titleVariant}
                        archiveContext={archiveContext}
                        downloadProps={downloadProps}
                    />
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}

const SUGGESTED_SEARCHES_LIMIT = 6

const SuggestedSearches = ({
    topicTagsLinks,
    tagToSlugMap,
}: {
    topicTagsLinks: string[] | undefined
    tagToSlugMap: Record<string, string>
}) => {
    // SSR renders a deterministic top-N so the baked HTML matches what the
    // client renders on hydration (no hydration mismatch warning). After
    // mount, useEffect re-shuffles per visitor, so different users see
    // different subsets of the vocabulary even when the page bake is shared.
    const [suggestions, setSuggestions] = useState<string[]>(() =>
        getSuggestedKeywordsForTopics(
            topicTagsLinks,
            tagToSlugMap,
            SUGGESTED_SEARCHES_LIMIT,
            false
        )
    )
    useEffect(() => {
        setSuggestions(
            getSuggestedKeywordsForTopics(
                topicTagsLinks,
                tagToSlugMap,
                SUGGESTED_SEARCHES_LIMIT,
                true
            )
        )
    }, [topicTagsLinks, tagToSlugMap])

    if (suggestions.length === 0) return null

    return (
        <div className="suggested-searches">
            {suggestions.map((query) => (
                <a
                    key={query}
                    href={`/search?q=${encodeURIComponent(query)}`}
                    className="suggested-search-item"
                >
                    <FontAwesomeIcon
                        icon={faMagnifyingGlass}
                        className="suggested-search-item__icon"
                    />
                    <span className="suggested-search-item__text">{query}</span>
                </a>
            ))}
        </div>
    )
}
