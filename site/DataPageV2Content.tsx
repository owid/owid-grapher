import React, { useState, useMemo } from "react"
import {
    FetchingGrapher,
    fetchInputTableForConfig,
    Grapher,
    GrapherProgrammaticInterface,
    GrapherState,
    MapChart,
} from "@ourworldindata/grapher"
import {
    REUSE_THIS_WORK_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
} from "@ourworldindata/components"
import ReactDOM from "react-dom"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import {
    DataPageV2ContentFields,
    formatAuthors,
    intersection,
    GrapherInterface,
    joinTitleFragments,
    ImageMetadata,
    DEFAULT_THUMBNAIL_FILENAME,
} from "@ourworldindata/utils"
import { AttachmentsContext, DocumentContext } from "./gdocs/OwidGdoc.js"
import StickyNav from "./blocks/StickyNav.js"
import { DebugProvider } from "./gdocs/DebugContext.js"
import {
    ADMIN_BASE_URL,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import Image from "./gdocs/components/Image.js"
import AboutThisData from "./AboutThisData.js"
import MetadataSection from "./MetadataSection.js"
import TopicTags from "./TopicTags.js"
import { reaction } from "mobx"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

// We still have topic pages on WordPress, whose featured images are specified as absolute URLs which this component handles
// Once we've migrated all WP topic pages to gdocs, we'll be able to remove this component and just use <Image />
const DatapageResearchThumbnail = ({
    urlOrFilename,
}: {
    urlOrFilename: string | undefined | null
}) => {
    if (!urlOrFilename) {
        urlOrFilename = `${BAKED_BASE_URL}/${DEFAULT_THUMBNAIL_FILENAME}`
    }
    if (urlOrFilename.startsWith("http")) {
        return (
            <img
                src={urlOrFilename}
                className="span-lg-cols-2 span-sm-cols-3"
            />
        )
    }
    return (
        <Image
            filename={urlOrFilename}
            shouldLightbox={false}
            containerType="thumbnail"
            className="span-lg-cols-2 span-sm-cols-3"
        />
    )
}

export const DataPageV2Content = ({
    datapageData,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    tagToSlugMap,
    imageMetadata,
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
            isEmbeddedInADataPage: true,
            bindUrlToWindow: true,
        }),
        [grapherConfig]
    )

    const grapher1State = useMemo(
        () =>
            new GrapherState({
                ...mergedGrapherConfig,
                queryStr: "",
                dataApiUrl: DATA_API_URL,
                adminBaseUrl: ADMIN_BASE_URL,
                bakedGrapherURL: BAKED_GRAPHER_URL,
            }),
        [mergedGrapherConfig]
    )
    const grapher2State = useMemo(
        () =>
            new GrapherState({
                ...mergedGrapherConfig,
                tab: "map",
                queryStr: "",
                dataApiUrl: DATA_API_URL,
                adminBaseUrl: ADMIN_BASE_URL,
                bakedGrapherURL: BAKED_GRAPHER_URL,
            }),
        [mergedGrapherConfig]
    )
    React.useEffect(() => {
        async function fetchTable(): Promise<void> {
            const inputTable = await fetchInputTableForConfig(
                mergedGrapherConfig,
                DATA_API_URL
            )
            if (inputTable) {
                grapher1State.inputTable = inputTable
                grapher2State.inputTable = inputTable
            }
            reaction(
                () => grapher2State.yAxis.scaleType,
                () => {
                    console.log("rerunning reaction")

                    // const focusedEntity = (
                    //     grapher2State.chartInstance as MapChart
                    // ).focusEntity?.id
                    // if (focusedEntity)
                    //     grapher1State.selection.addToSelection([
                    //         focusedEntity.toString(),
                    //     ])
                    grapher1State.yAxis.scaleType =
                        grapher2State.yAxis.scaleType
                }
            )
        }
        void fetchTable()
    }, [grapher1State, grapher2State, mergedGrapherConfig])

    const stickyNavLinks = [
        {
            text: "Explore the Data",
            target: "#explore-the-data",
        },
        {
            text: "Research & Writing",
            target: "#research-and-writing",
        },
        { text: "All Charts", target: "#all-charts" },
        { text: "FAQs", target: "#faqs" },
        {
            text: "Sources & Processing",
            target: "#" + DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
        },
        { text: "Reuse This Work", target: "#" + REUSE_THIS_WORK_SECTION_ID },
    ]

    const relatedResearchCandidates = datapageData.relatedResearch
    const relatedResearch =
        relatedResearchCandidates.length > 3 &&
        datapageData.topicTagsLinks?.length
            ? relatedResearchCandidates.filter((research) => {
                  const shared = intersection(
                      research.tags,
                      datapageData.topicTagsLinks ?? []
                  )
                  return shared.length > 0
              })
            : relatedResearchCandidates
    for (const item of relatedResearch) {
        // TODO: these are workarounds to not link to the (not really existing) template pages for energy or co2
        // country profiles but instead to the topic page at the country selector.
        if (item.url === "/co2-country-profile")
            item.url =
                "/co2-and-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles"
        else if (item.url === "/energy-country-profile")
            item.url = "/energy#country-profiles"
        else if (item.url === "/coronavirus-country-profile")
            item.url = "/coronavirus#coronavirus-country-profiles"
    }

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: {},
                imageMetadata,
                linkedCharts: {},
                linkedIndicators: {},
                relatedCharts: [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <div className="DataPageContent__grapher-for-embed">
                    <FetchingGrapher
                        config={mergedGrapherConfig}
                        dataApiUrl={DATA_API_URL}
                        adminBaseUrl={ADMIN_BASE_URL}
                        bakedGrapherURL={BAKED_GRAPHER_URL}
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
                            {!!datapageData.topicTagsLinks?.length && (
                                <TopicTags
                                    className="header__right col-start-10 span-cols-4 col-sm-start-2 span-sm-cols-12"
                                    topicTagsLinks={datapageData.topicTagsLinks}
                                    tagToSlugMap={tagToSlugMap}
                                />
                            )}
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
                            <Grapher grapherState={grapher1State} />
                            <Grapher grapherState={grapher2State} />
                            <AboutThisData
                                datapageData={datapageData}
                                hasFaq={!!faqEntries?.faqs.length}
                            />
                        </div>
                    </div>
                    <div className="col-start-2 span-cols-12">
                        {relatedResearch && relatedResearch.length > 0 && (
                            <div className="section-wrapper grid">
                                <h2
                                    className="related-research__title span-cols-3 span-lg-cols-12"
                                    id="research-and-writing"
                                >
                                    Related research and writing
                                </h2>
                                <div className="related-research__items grid grid-cols-9 grid-lg-cols-12 span-cols-9 span-lg-cols-12">
                                    {relatedResearch.map((research) => (
                                        <a
                                            href={research.url}
                                            key={research.url}
                                            className="related-research__item grid grid-cols-4 grid-lg-cols-6 grid-sm-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12"
                                        >
                                            <DatapageResearchThumbnail
                                                urlOrFilename={
                                                    research.imageUrl
                                                }
                                            />
                                            <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                                                <h3 className="related-article__title">
                                                    {research.title}
                                                </h3>
                                                <div className="related-article__authors body-3-medium-italic">
                                                    {research.authors &&
                                                        research.authors
                                                            .length &&
                                                        formatAuthors({
                                                            authors:
                                                                research.authors,
                                                        })}
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                        {datapageData.allCharts &&
                        datapageData.allCharts.length > 0 ? (
                            <div className="section-wrapper section-wrapper__related-charts">
                                <h2
                                    className="related-charts__title"
                                    id="all-charts"
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
                    />
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}

export const hydrateDataPageV2Content = (isPreviewing?: boolean) => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props: DataPageV2ContentFields = window._OWID_DATAPAGEV2_PROPS
    const grapherConfig = window._OWID_GRAPHER_CONFIG

    ReactDOM.hydrate(
        <DebugProvider debug={isPreviewing}>
            <DataPageV2Content
                {...props}
                grapherConfig={grapherConfig}
                isPreviewing={isPreviewing}
            />
        </DebugProvider>,
        wrapper
    )
}
