import { useMemo, ReactNode } from "react"
import cx from "classnames"
import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    REUSE_THIS_WORK_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    Button,
} from "@ourworldindata/components"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import {
    DataPageV2ContentFields,
    GrapherInterface,
    joinTitleFragments,
    ImageMetadata,
    excludeNull,
} from "@ourworldindata/utils"
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
import Image from "./gdocs/components/Image.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { DataInsightLink } from "@ourworldindata/types/dist/gdocTypes/Datapage.js"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

// todo: the below constants should be moved to a shared A/B testing constants file
const ARM_SEPARATOR = "--"
const EXPERIMENT_PREFIX = "exp"

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
        if (datapageData.dataInsights?.length) {
            insightsHref = `/data-insights?topic=${datapageData.primaryTopic.topicTag}`
        } else {
            insightsHref = `/${topicSlug}`
        }
    }

    // insight links for when multiple links are shown
    const insightLinks = datapageData.dataInsights?.length
        ? datapageData.dataInsights?.slice(0, 3)
        : undefined

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

                            {/* A/B experiment: data-page-insight-buttons-basic */}
                            {insightsHref && (
                                <InsightLinksInsightButtonsBasic
                                    insightsHref={insightsHref}
                                />
                            )}

                            {/* A/B experiment: data-page-insight-buttons-full */}
                            {insightsHref && (
                                <InsightLinksInsightButtonsFull
                                    insightsHref={insightsHref}
                                    insightLinks={insightLinks}
                                />
                            )}

                            <AboutThisData
                                datapageData={datapageData}
                                hasFaq={!!faqEntries?.faqs.length}
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
 * A/B experiment: data-page-insight-buttons-basic
 *
 * Renders the insight buttons for each experimental arm in the
 * data-page-insight-buttons-basic experiment.
 */
const InsightLinksInsightButtonsBasic = ({
    insightsHref,
}: {
    insightsHref: string
}) => {
    const experimentId = "data-page-insight-buttons-basic"

    return (
        <>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t0`}
            >
                <Button
                    className="insights-link"
                    href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                    text="Data sources & measurement"
                    theme="solid-blue"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t1`}
            >
                <Button
                    className="insights-link"
                    href={insightsHref}
                    text="View insights about this data"
                    theme="solid-blue"
                />
            </InsightLinks>
        </>
    )
}

/**
 * A/B experiment: data-page-insight-buttons-full
 *
 * Renders the insight buttons for each experimental arm in the
 * data-page-insight-buttons-full experiment.
 */
const InsightLinksInsightButtonsFull = ({
    insightsHref,
    insightLinks,
}: {
    insightsHref: string
    insightLinks?: DataInsightLink[]
}) => {
    const experimentId = "data-page-insight-buttons-full"
    const genericTreatmentText = "View insights about this data"
    return (
        <>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t000`}
            >
                <Button
                    className="insights-link insight__title"
                    text="Data sources & measurement"
                    href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                    theme="solid-blue"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t010`}
            >
                <Button
                    className="insights-link insight__title"
                    text="Data sources & measurement"
                    href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                    theme="solid-blue"
                />
                <Button
                    className="insights-link insight__title"
                    text="Research & writing"
                    href="#research-and-writing"
                    theme="solid-blue"
                />
                <Button
                    className="insights-link insight__title"
                    text="Related charts"
                    href="#all-charts"
                    theme="solid-blue"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t100`}
            >
                <Button
                    className="insights-link insight__title"
                    text={genericTreatmentText}
                    href={insightsHref}
                    theme="solid-blue"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t110`}
            >
                <Button
                    className="insights-link insight__title"
                    text={genericTreatmentText}
                    href={insightsHref}
                    theme="solid-blue"
                />
                <Button
                    className="insights-link insight__title"
                    text="Data sources & measurement"
                    href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                    theme="solid-blue"
                />
                <Button
                    className="insights-link insight__title"
                    text="Related charts"
                    href="#all-charts"
                    theme="solid-blue"
                />
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t101`}
            >
                {/* todo: what if no insightLinks? */}
                {insightLinks && insightLinks?.length && (
                    <a
                        href={insightsHref}
                        className="insights-link has-thumbnail grid grid-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12 owid-btn owid-btn--solid-blue"
                    >
                        {insightLinks[0].imgFilename && (
                            <Image
                                className="span-cols-2"
                                filename={insightLinks[0].imgFilename}
                                containerType="thumbnail"
                                shouldLightbox={false}
                            />
                        )}
                        <div className="span-cols-10">
                            <h3 className="insight__title">
                                {genericTreatmentText}
                                <FontAwesomeIcon
                                    className="owid-btn--icon-right"
                                    icon={faArrowRight}
                                />
                            </h3>
                        </div>
                    </a>
                )}
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t111`}
            >
                <div>
                    {/* todo: what thumbnails to show for placebo texts? should this even be a permitted experimental arm? */}
                </div>
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t200`}
            >
                {/* todo: what if no link? */}
                {insightLinks && insightLinks?.length && (
                    <LinkToDataInsight
                        insightLink={{
                            title: insightLinks[0].title,
                            slug: insightLinks[0].slug,
                        }}
                    />
                )}
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t210`}
                showHeader={true}
            >
                {/* todo: what if no link? */}
                {insightLinks &&
                    insightLinks.map((link) => (
                        <LinkToDataInsight
                            key={link.slug}
                            insightLink={{
                                title: link.title,
                                slug: link.slug,
                            }}
                            showContentType={true}
                        />
                    ))}
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t201`}
            >
                <div className="insight-links col-start-2 col-lg-start-2 span-cols-10 span-lg-cols-10 span-sm-cols-12">
                    {/* todo: what if no link? */}
                    {insightLinks && insightLinks?.length && (
                        <LinkToDataInsight insightLink={insightLinks[0]} />
                    )}
                </div>
            </InsightLinks>
            <InsightLinks
                className={`${EXPERIMENT_PREFIX}-${experimentId}${ARM_SEPARATOR}t211`}
                showHeader={true}
            >
                {/* todo: what if no link? */}
                {insightLinks &&
                    insightLinks.map((link) => (
                        <LinkToDataInsight
                            key={link.slug}
                            insightLink={link}
                            showContentType={true}
                        />
                    ))}
            </InsightLinks>
        </>
    )
}

const InsightLinks = ({
    className,
    showHeader = false,
    children,
}: {
    className: string
    showHeader?: boolean
    children: ReactNode
}) => {
    return (
        <div className={cx("grid", className)}>
            {showHeader && (
                <h2 className={`insights__title span-cols-12`}>
                    Insights about this data
                </h2>
            )}
            <div className="insight-links col-start-2 col-lg-start-2 span-cols-10 span-lg-cols-10 span-sm-cols-12">
                {children}
            </div>
        </div>
    )
}

const LinkToDataInsight = ({
    insightLink,
    showContentType = true,
}: {
    insightLink: DataInsightLink
    showContentType?: boolean
}) => {
    return (
        <a
            href={`/data-insights/${insightLink.slug}`}
            className="insights-link has-thumbnail grid grid-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12 owid-btn owid-btn--solid-blue"
        >
            {insightLink.imgFilename && (
                <Image
                    className="span-cols-2"
                    filename={insightLink.imgFilename}
                    containerType="thumbnail"
                    shouldLightbox={false}
                />
            )}
            <div className="span-cols-10">
                {showContentType && (
                    <p className="insight__type">Data insight</p>
                )}
                <h3 className="insight__title">
                    {insightLink.title}
                    <FontAwesomeIcon
                        className={cx({
                            "owid-btn--icon-right": insightLink.title,
                        })}
                        icon={faArrowRight}
                    />
                </h3>
            </div>
        </a>
    )
}
