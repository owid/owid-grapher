import { useMemo, useEffect, useState, ReactNode } from "react"
import cx from "classnames"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    REUSE_THIS_WORK_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    Button,
} from "@ourworldindata/components"
import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
    DataPageV2ContentFields,
    GrapherInterface,
    joinTitleFragments,
    ImageMetadata,
    excludeNull,
    queryParamsToStr,
    defaultExperimentState,
    getExperimentState,
    ExperimentState,
} from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
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
import { faArrowRight, faArrowDown } from "@fortawesome/free-solid-svg-icons"
import Image from "./gdocs/components/Image.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { DataInsightLink } from "@ourworldindata/types"

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
    archivedChartInfo,
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
            archivedChartInfo,
        }),
        [grapherConfig, archivedChartInfo]
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

    // insight link for when only a single link is shown
    let insightsHref: string | undefined
    if (datapageData.primaryTopic) {
        const topicSlug = tagToSlugMap[datapageData.primaryTopic.topicTag]
        if (datapageData.hasDataInsights) {
            insightsHref = `/data-insights${queryParamsToStr({ topic: datapageData.primaryTopic.topicTag })}`
        } else {
            insightsHref = `/${topicSlug}`
        }
    }

    // insight links for when multiple links are shown
    const insightLinks = datapageData.dataInsights?.length
        ? datapageData.dataInsights?.slice(0, 3)
        : undefined

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

                            {/* A/B experiment: data-page-insight-btns-2 */}
                            {insightsHref && (
                                <InsightLinksInsightButtonsFull
                                    insightsHref={insightsHref}
                                    insightLinks={insightLinks}
                                />
                            )}

                            <AboutThisData
                                datapageData={datapageData}
                                hasFaq={!!faqEntries?.faqs.length}
                                className={cx(
                                    "exp-data-page-insight-btns-2--control1--hide",
                                    "exp-data-page-insight-btns-2--treat00--hide",
                                    "exp-data-page-insight-btns-2--treat10--hide",
                                    "exp-data-page-insight-btns-2--treat01--hide",
                                    "exp-data-page-insight-btns-2--treat11--hide",
                                    "exp-data-page-insight-btns-2--treat20--hide",
                                    "exp-data-page-insight-btns-2--treat21--hide"
                                )}
                                id={
                                    // if visitor is assigned to an arm other than
                                    // the pure control, don't give this section an id
                                    isPageInExperiment &&
                                    assignedExperiments &&
                                    assignedExperiments[
                                        "exp-data-page-insight-btns-2"
                                    ] &&
                                    assignedExperiments[
                                        "exp-data-page-insight-btns-2"
                                    ] !== "control"
                                        ? ""
                                        : DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
                                }
                            />
                        </div>
                    </div>
                    <div className="col-start-2 span-cols-12">
                        {relatedResearch && relatedResearch.length > 0 && (
                            <DataPageResearchAndWriting
                                relatedResearch={relatedResearch}
                            />
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
                    <div className="col-start-2 span-cols-12">
                        <AboutThisData
                            datapageData={datapageData}
                            hasFaq={!!faqEntries?.faqs.length}
                            className={cx(
                                "exp-data-page-insight-btns-2--control1--show",
                                "exp-data-page-insight-btns-2--treat00--show",
                                "exp-data-page-insight-btns-2--treat10--show",
                                "exp-data-page-insight-btns-2--treat01--show",
                                "exp-data-page-insight-btns-2--treat11--show",
                                "exp-data-page-insight-btns-2--treat20--show",
                                "exp-data-page-insight-btns-2--treat21--show"
                            )}
                            id={
                                // if visitor is assigned to an arm other than
                                // the pure control, give this section an id
                                isPageInExperiment &&
                                assignedExperiments &&
                                assignedExperiments[
                                    "exp-data-page-insight-btns-2"
                                ] &&
                                assignedExperiments[
                                    "exp-data-page-insight-btns-2"
                                ] !== "control"
                                    ? DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
                                    : ""
                            }
                        />
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
                        archivedChartInfo={archivedChartInfo}
                    />
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}

/**
 * A/B experiment: data-page-insight-btns-2
 *
 * Renders the insight buttons for each experimental arm in the
 * data-page-insight-btns-2 experiment.
 */
const InsightLinksInsightButtonsFull = ({
    insightsHref,
    insightLinks,
}: {
    insightsHref: string
    insightLinks?: DataInsightLink[]
}) => {
    const experimentId = "data-page-insight-btns-2"
    return (
        <>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${EXPERIMENT_ARM_SEPARATOR}treat00--show`}
            >
                <Button
                    text="Details about data sources"
                    href={`#${DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}`}
                    theme="solid-blue"
                    icon={faArrowDown}
                    dataTrackNote="btn_click__about_the_data"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${EXPERIMENT_ARM_SEPARATOR}treat10--show`}
            >
                <Button
                    text="Insights about this data"
                    href={insightsHref}
                    theme="solid-blue"
                    icon={faArrowRight}
                    dataTrackNote="btn_click__insights"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${EXPERIMENT_ARM_SEPARATOR}treat01--show`}
            >
                <Button
                    text="Details about data sources"
                    href={`#${DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}`}
                    theme="solid-blue"
                    icon={faArrowDown}
                    dataTrackNote="btn_click__about_the_data"
                />
                <Button
                    text="Research and writing"
                    href="#research-and-writing"
                    theme="solid-blue"
                    icon={faArrowDown}
                    dataTrackNote="btn_click__research_and_writing"
                />
                <Button
                    text="Related charts"
                    href="#all-charts"
                    theme="solid-blue"
                    icon={faArrowDown}
                    dataTrackNote="btn_click__related_charts"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${EXPERIMENT_ARM_SEPARATOR}treat11--show`}
            >
                <Button
                    text="Insights about this data"
                    href={insightsHref}
                    theme="solid-blue"
                    icon={faArrowRight}
                    dataTrackNote="btn_click__insights"
                />
                <Button
                    text="Research and writing"
                    href="#research-and-writing"
                    theme="solid-blue"
                    icon={faArrowDown}
                    dataTrackNote="btn_click__research_and_writing"
                />
                <Button
                    text="Related charts"
                    href="#all-charts"
                    theme="solid-blue"
                    icon={faArrowDown}
                    dataTrackNote="btn_click__related_charts"
                />
            </InsightLinks>
            {insightLinks && insightLinks?.length && (
                <InsightLinks
                    className={`${EXPERIMENT_PREFIX}-${experimentId}${EXPERIMENT_ARM_SEPARATOR}treat20--show`}
                    itemClassName="col-start-3 col-lg-start-3 span-cols-8 span-lg-cols-8 span-sm-cols-12"
                    textAlignLeft={true}
                >
                    <LinkToDataInsight
                        insightLink={{
                            title: insightLinks[0].title,
                            slug: insightLinks[0].slug,
                        }}
                        dataTrackNote="btn_click__insight"
                    />
                </InsightLinks>
            )}
            {insightLinks && (
                <InsightLinks
                    className={`${EXPERIMENT_PREFIX}-${experimentId}${EXPERIMENT_ARM_SEPARATOR}treat21--show`}
                    itemClassName="col-start-3 col-lg-start-3 span-cols-8 span-lg-cols-8 span-sm-cols-12"
                    textAlignLeft={true}
                    showHeader={false}
                >
                    {insightLinks.map((link, i) => (
                        <LinkToDataInsight
                            key={link.slug}
                            insightLink={{
                                title: link.title,
                                slug: link.slug,
                            }}
                            showContentType={true}
                            dataTrackNote={`btn_click__insight${i}`}
                        />
                    ))}
                </InsightLinks>
            )}
        </>
    )
}

const InsightLinks = ({
    className,
    itemClassName = "span-cols-4 span-lg-cols-4 span-sm-cols-12",
    showHeader = false,
    textAlignLeft = false,
    children,
}: {
    className: string
    itemClassName?: string
    showHeader?: boolean
    textAlignLeft?: boolean
    children: ReactNode
}) => {
    return (
        <div className={cx("grid", className)}>
            {showHeader && (
                <h2 className={`insight-links__title span-cols-12`}>
                    Insights about this data
                </h2>
            )}
            <div
                className={cx(
                    textAlignLeft
                        ? "insight-links__items--left"
                        : "insight-links__items",
                    itemClassName
                )}
            >
                {children}
            </div>
        </div>
    )
}

const LinkToDataInsight = ({
    insightLink,
    showContentType = true,
    dataTrackNote,
}: {
    insightLink: DataInsightLink
    showContentType?: boolean
    dataTrackNote?: string
}) => {
    const aProps = {
        href: `/data-insights/${insightLink.slug}`,
        className:
            "grid grid-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12 owid-btn owid-btn--solid-blue",
        "data-track-note": dataTrackNote,
    }
    return (
        <a {...aProps}>
            {insightLink.imgFilename && (
                <Image
                    className="span-cols-2"
                    filename={insightLink.imgFilename}
                    containerType="thumbnail"
                    shouldLightbox={false}
                />
            )}
            <div
                className={
                    insightLink.imgFilename ? "span-cols-10" : "span-cols-12"
                }
            >
                {showContentType && <p className="item__type">Data insight</p>}
                <span className="item__title">
                    {insightLink.title}
                    <FontAwesomeIcon
                        className={cx("icon", {
                            "owid-btn--icon-right": insightLink.title,
                        })}
                        icon={faArrowRight}
                    />
                </span>
            </div>
        </a>
    )
}
