import React, { useEffect, useMemo } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons"
import { Grapher, GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    CodeSnippet,
    REUSE_THIS_WORK_SECTION_ID,
    IndicatorSources,
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    IndicatorProcessing,
    SimpleMarkdownText,
    ExpandableToggle,
    makeSource,
    makeDateRange,
    makeLastUpdated,
    makeNextUpdate,
    makeUnit,
    makeUnitConversionFactor,
    makeLinks,
    HtmlOrSimpleMarkdownText,
    DataCitation,
} from "@ourworldindata/components"
import ReactDOM from "react-dom"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import {
    DataPageV2ContentFields,
    uniq,
    formatAuthors,
    intersection,
    prepareSourcesForDisplay,
    DataPageRelatedResearch,
    isEmpty,
    excludeUndefined,
    OwidOrigin,
    DataPageDataV2,
    getCitationShort,
    GrapherInterface,
    getCitationLong,
    joinTitleFragments,
} from "@ourworldindata/utils"
import { AttachmentsContext, DocumentContext } from "./gdocs/OwidGdoc.js"
import StickyNav from "./blocks/StickyNav.js"
import cx from "classnames"
import { DebugProvider } from "./gdocs/DebugContext.js"
import dayjs from "dayjs"
import {
    BAKED_BASE_URL,
    IMAGE_HOSTING_CDN_URL,
} from "../settings/clientSettings.js"
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
}: DataPageV2ContentFields & {
    grapherConfig: GrapherInterface
}) => {
    const [grapher, setGrapher] = React.useState<Grapher | undefined>(undefined)

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

    useEffect(() => {
        setGrapher(new Grapher(mergedGrapherConfig))
    }, [mergedGrapherConfig])

    const stickyNavLinks = [
        {
            text: "Explore the Data",
            target: "#explore-the-data",
        },
        {
            text: "Research & Writing",
            target: "#research-and-writing",
        },
        { text: "Related Data", target: "#related-data" },
        { text: "All Charts", target: "#all-charts" },
        { text: "FAQs", target: "#faqs" },
        {
            text: "Sources & Processing",
            target: "#" + DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
        },
        { text: "Reuse This Work", target: "#" + REUSE_THIS_WORK_SECTION_ID },
    ]

    const hasRelatedDataFeatured = datapageData.relatedData?.some(
        (data) => data.featured
    )
    const hasRelatedDataNonFeatured = datapageData.relatedData?.some(
        (data) => !data.featured
    )
    const relatedDataCategoryClasses = `related-data__category ${
        hasRelatedDataFeatured && hasRelatedDataNonFeatured
            ? "related-data__category--grid span-cols-4 span-lg-cols-6 span-sm-cols-3"
            : "related-data__category--columns span-cols-8 span-lg-cols-12"
    } `

    const hasDescriptionKey =
        datapageData.descriptionKey && datapageData.descriptionKey.length > 0

    const sourcesForDisplay = prepareSourcesForDisplay(datapageData)
    const getYearSuffixFromOrigin = (o: OwidOrigin) => {
        const year = o.dateAccessed
            ? dayjs(o.dateAccessed, ["YYYY-MM-DD", "YYYY"]).year()
            : o.datePublished
            ? dayjs(o.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
            : undefined
        if (year) return ` (${year})`
        else return ""
    }
    const producers = uniq(datapageData.origins.map((o) => `${o.producer}`))
    const producersWithYear = uniq(
        datapageData.origins.map(
            (o) => `${o.producer}${getYearSuffixFromOrigin(o)}`
        )
    )

    const attributionFragments = datapageData.attributions ?? producersWithYear
    const attributionUnshortened = attributionFragments.join("; ")
    const citationShort = getCitationShort(
        datapageData.origins,
        datapageData.attributions,
        datapageData.owidProcessingLevel
    )
    const currentYear = dayjs().year()
    const citationLong = getCitationLong(
        datapageData.title,
        datapageData.origins,
        datapageData.source,
        datapageData.attributions,
        datapageData.attributionShort,
        datapageData.titleVariant,
        datapageData.owidProcessingLevel,
        canonicalUrl
    )

    const {
        linkedDocuments = {},
        imageMetadata = {},
        linkedCharts = {},
        relatedCharts = [],
    } = faqEntries ?? {}

    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : datapageData.source?.name

    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`

    // For the citation of the data page add a period it doesn't have that or a question mark
    const primaryTopicCitation = maybeAddPeriod(
        datapageData.primaryTopic?.citation ?? ""
    )

    const citationDatapage = excludeUndefined([
        datapageData.primaryTopic
            ? `“Data Page: ${datapageData.title.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${datapageData.title.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${canonicalUrl} [online resource]`,
    ]).join(" ")

    const getImageUrl = (research: DataPageRelatedResearch) => {
        if (research.imageUrl && research.imageUrl.startsWith("http"))
            return research.imageUrl
        else if (!isEmpty(research.imageUrl))
            return encodeURI(
                `${IMAGE_HOSTING_CDN_URL}/production/${research.imageUrl}`
            )
        return `${BAKED_BASE_URL}/default-thumbnail.jpg`
    }

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
    // TODO: mark topic pages

    const topicTags = datapageData.topicTagsLinks
        ?.map((name) => ({ name, slug: tagToSlugMap[name] }))
        .filter((tag): tag is { name: string; slug: string } => !!tag.slug)
        .map((tag) => (
            <a href={`/${tag.slug}`} key={tag.slug}>
                {tag.name}
            </a>
        ))

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments,
                imageMetadata,
                linkedCharts,
                relatedCharts,
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <div className="DataPageContent__grapher-for-embed">
                    <GrapherWithFallback
                        grapher={grapher}
                        slug={grapherConfig.slug}
                    />
                </div>
                <div className="DataPageContent">
                    <div className="bg-blue-10">
                        <div className="header__wrapper wrapper grid grid-cols-12 ">
                            <div className="header__left span-cols-8 span-sm-cols-12">
                                <div className="header__supertitle">Data</div>
                                <h1 className="header__title">
                                    {datapageData.title.title}
                                </h1>
                                <div className="header__source">
                                    {titleFragments}
                                </div>
                            </div>
                            {!!datapageData.topicTagsLinks?.length && (
                                <div className="header__right col-start-9 span-cols-4 span-sm-cols-12">
                                    <div className="topic-tags__label">
                                        See all data and research on:
                                    </div>
                                    <div className="topic-tags">
                                        {topicTags}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <nav className="sticky-nav sticky-nav--dark">
                        <StickyNav links={stickyNavLinks} className="wrapper" />
                    </nav>
                    <div className="chart-key-info">
                        <GrapherWithFallback
                            grapher={grapher}
                            slug={grapherConfig.slug} // TODO: On grapher pages,
                            // there will always be a slug, but if we just show a data page preview for an indicator in the admin, there will be no slug
                            // and then thumbnails will be broken for those. When we consider baking data pages for
                            // non-grapher pages then we need to make sure that there are thunbnails that are generated for the these non-chart graphers and
                            // then this piece will have to change anyhow and know how to provide the thumbnail.
                            className="wrapper"
                            id="explore-the-data"
                        />
                        <div className="wrapper wrapper-about-this-data grid grid-cols-12">
                            {hasDescriptionKey ||
                            datapageData.descriptionFromProducer ||
                            datapageData.source?.additionalInfo ? (
                                <>
                                    <h2
                                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                        className="key-info__title span-cols-12"
                                    >
                                        What you should know about this
                                        indicator
                                    </h2>
                                    <div className="col-start-1 span-cols-8 span-lg-cols-7 span-sm-cols-12">
                                        <div className="key-info__content">
                                            {hasDescriptionKey && (
                                                <div className="key-info__key-description">
                                                    {datapageData.descriptionKey
                                                        .length === 1 ? (
                                                        <SimpleMarkdownText
                                                            text={datapageData.descriptionKey[0].trim()}
                                                        />
                                                    ) : (
                                                        <ul>
                                                            {datapageData.descriptionKey.map(
                                                                (text, i) => (
                                                                    <li key={i}>
                                                                        <SimpleMarkdownText
                                                                            text={text.trim()}
                                                                            useParagraphs={
                                                                                false
                                                                            }
                                                                        />
                                                                    </li>
                                                                )
                                                            )}
                                                        </ul>
                                                    )}
                                                    {!!faqEntries?.faqs
                                                        .length && (
                                                        <a
                                                            className="key-info__learn-more"
                                                            href="#faqs"
                                                        >
                                                            Learn more in the
                                                            FAQs
                                                            <FontAwesomeIcon
                                                                icon={
                                                                    faArrowDown
                                                                }
                                                            />
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            <div className="key-info__expandable-descriptions">
                                                {datapageData.descriptionFromProducer && (
                                                    <ExpandableToggle
                                                        label={
                                                            datapageData.attributionShort
                                                                ? `How does the producer of this data - ${datapageData.attributionShort} - describe this data?`
                                                                : "How does the producer of this data describe this data?"
                                                        }
                                                        content={
                                                            <div className="article-block__text">
                                                                <SimpleMarkdownText
                                                                    text={
                                                                        datapageData.descriptionFromProducer
                                                                    }
                                                                />
                                                            </div>
                                                        }
                                                        isStacked={
                                                            !!datapageData
                                                                .source
                                                                ?.additionalInfo
                                                        }
                                                    />
                                                )}
                                                {datapageData.source
                                                    ?.additionalInfo && (
                                                    <ExpandableToggle
                                                        label="Additional information about this data"
                                                        content={
                                                            <div className="expandable-info-blocks__content">
                                                                <HtmlOrSimpleMarkdownText
                                                                    text={datapageData.source?.additionalInfo.trim()}
                                                                />
                                                            </div>
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="key-info__right span-cols-4 span-lg-cols-5 span-sm-cols-12">
                                        <KeyDataTable
                                            datapageData={datapageData}
                                            attribution={attributionUnshortened}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2
                                        className="about-this-data__title span-cols-3 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                    >
                                        About this data
                                    </h2>
                                    <div className="col-start-4 span-cols-10 col-lg-start-5 span-lg-cols-8 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <KeyDataTable
                                            datapageData={datapageData}
                                            attribution={attributionUnshortened}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="wrapper">
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
                                            {/* <figure>
                                                        <Image
                                                            filename={
                                                                research.imageUrl
                                                            }
                                                            shouldLightbox={
                                                                false
                                                            }
                                                            containerType={
                                                                "thumbnail"
                                                            }
                                                        />
                                                    </figure> */}
                                            {/* // TODO: switch this to use the Image component and put the required information for the thumbnails into hte attachment context or similar */}
                                            <img
                                                src={getImageUrl(research)}
                                                alt=""
                                                className="span-lg-cols-2 span-sm-cols-3"
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
                        {!!datapageData.relatedData?.length && (
                            <div className="section-wrapper grid">
                                <h2
                                    className="related-data__title span-cols-3 span-lg-cols-12"
                                    id="related-data"
                                >
                                    Related data
                                </h2>
                                <div
                                    className={cx(
                                        "related-data__items",
                                        {
                                            "related-data__items--two-cols":
                                                hasRelatedDataFeatured &&
                                                hasRelatedDataNonFeatured,
                                        },
                                        "grid",
                                        "grid-cols-9",
                                        "grid-lg-cols-12",
                                        "span-cols-9",
                                        "span-lg-cols-12"
                                    )}
                                >
                                    {hasRelatedDataFeatured && (
                                        <div
                                            className={
                                                relatedDataCategoryClasses
                                            }
                                        >
                                            {datapageData.relatedData
                                                .filter((data) => data.featured)
                                                .map((data) => (
                                                    <a
                                                        href={data.url}
                                                        key={data.url}
                                                        className="related-data-item related-data-item--medium col-start-1 col-end-limit"
                                                    >
                                                        {data.type && (
                                                            <div className="related-data-item__type">
                                                                {data.type}
                                                            </div>
                                                        )}
                                                        <h3 className="related-data-item__title">
                                                            {data.title}
                                                        </h3>
                                                        {data.source && (
                                                            <div className="related-data-item__source">
                                                                {data.source}
                                                            </div>
                                                        )}
                                                        <div className="related-data-item__content">
                                                            {data.content}
                                                        </div>
                                                    </a>
                                                ))}
                                        </div>
                                    )}
                                    {hasRelatedDataNonFeatured && (
                                        <div
                                            className={
                                                relatedDataCategoryClasses
                                            }
                                        >
                                            {datapageData.relatedData
                                                .filter(
                                                    (data) => !data.featured
                                                )
                                                .map((data) => (
                                                    <a
                                                        href={data.url}
                                                        key={data.url}
                                                        className="related-data-item related-data-item--small col-start-1 col-end-limit"
                                                    >
                                                        <h4 className="related-data-item__title">
                                                            {data.title}
                                                        </h4>
                                                        {data.source && (
                                                            <div className="related-data-item__source">
                                                                {data.source}
                                                            </div>
                                                        )}
                                                    </a>
                                                ))}
                                        </div>
                                    )}
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
                    <div className="bg-gray-10">
                        <div className="wrapper">
                            {!!faqEntries?.faqs.length && (
                                <div className="section-wrapper section-wrapper__faqs grid">
                                    <h2
                                        className="faqs__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                        id="faqs"
                                    >
                                        Frequently Asked Questions
                                    </h2>
                                    <div className="faqs__items grid grid-cols-10 grid-lg-cols-9 grid-md-cols-12 span-cols-10 span-lg-cols-9 span-md-cols-12 span-sm-cols-12">
                                        <ArticleBlocks
                                            blocks={faqEntries.faqs}
                                            containerType="datapage"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="section-wrapper grid">
                                <h2
                                    className="data-sources-processing__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                    id={
                                        DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID
                                    }
                                >
                                    Sources and processing
                                </h2>
                                <div className="data-sources grid span-cols-12">
                                    <h3 className="data-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        This data is based on the following
                                        sources
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <IndicatorSources
                                            sources={sourcesForDisplay}
                                        />
                                    </div>
                                </div>
                                <div className="data-processing grid span-cols-12">
                                    <h3 className="data-processing__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        How we process data at Our World in Data
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <IndicatorProcessing
                                            descriptionProcessing={
                                                datapageData.descriptionProcessing
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="section-wrapper grid">
                                <h2
                                    className="reuse__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                    id="reuse-this-work"
                                >
                                    Reuse this work
                                </h2>
                                <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                    <ul className="reuse__content">
                                        <li className="reuse__list-item">
                                            All data produced by third-party
                                            providers and made available by Our
                                            World in Data are subject to the
                                            license terms from the original
                                            providers. Our work would not be
                                            possible without the data providers
                                            we rely on, so we ask you to always
                                            cite them appropriately (see below).
                                            This is crucial to allow data
                                            providers to continue doing their
                                            work, enhancing, maintaining and
                                            updating valuable data.
                                        </li>
                                        <li className="reuse__list-item">
                                            All data, visualizations, and code
                                            produced by Our World in Data are
                                            completely open access under the{" "}
                                            <a
                                                href="https://creativecommons.org/licenses/by/4.0/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="reuse__link"
                                            >
                                                Creative Commons BY license
                                            </a>
                                            . You have the permission to use,
                                            distribute, and reproduce these in
                                            any medium, provided the source and
                                            authors are credited.
                                        </li>
                                    </ul>
                                </div>

                                {(citationShort ||
                                    citationLong ||
                                    citationDatapage) && (
                                    <div className="citations grid span-cols-12">
                                        <h3 className="citations__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            Citations
                                        </h3>
                                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            {citationDatapage && (
                                                <div className="citations-section">
                                                    <h5 className="citation__how-to-header">
                                                        How to cite this page
                                                    </h5>
                                                    <p className="citation__paragraph">
                                                        To cite this page
                                                        overall, including any
                                                        descriptions, FAQs or
                                                        explanations of the data
                                                        authored by Our World in
                                                        Data, please use the
                                                        following citation:
                                                    </p>
                                                    <CodeSnippet
                                                        code={citationDatapage}
                                                        theme="light"
                                                        useMarkdown={true}
                                                    />
                                                </div>
                                            )}
                                            <div className="citations-section">
                                                <h5 className="citation__how-to-header citation__how-to-header--data">
                                                    How to cite this data
                                                </h5>
                                                {(citationShort ||
                                                    citationLong) && (
                                                    <DataCitation
                                                        citationLong={
                                                            citationLong
                                                        }
                                                        citationShort={
                                                            citationShort
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
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

const KeyDataTable = (props: {
    datapageData: DataPageDataV2
    attribution: string
}) => {
    const { datapageData } = props
    const source = makeSource({
        attribution: props.attribution,
        owidProcessingLevel: datapageData.owidProcessingLevel,
    })
    const lastUpdated = makeLastUpdated(datapageData)
    const nextUpdate = makeNextUpdate(datapageData)
    const dateRange = makeDateRange(datapageData)
    const unit = makeUnit(datapageData)
    const unitConversionFactor = makeUnitConversionFactor(datapageData)
    const links = makeLinks({ link: datapageData.source?.link })

    return (
        <div className="key-data-block grid grid-cols-4 grid-sm-cols-12 ">
            {datapageData.descriptionShort && (
                <div className="key-data span-cols-4 span-sm-cols-12">
                    <div className="key-data__title key-data-description-short__title">
                        {datapageData.title.title}
                        {(datapageData.attributionShort ||
                            datapageData.titleVariant) && (
                            <>
                                {" "}
                                <span className="title-fragments">
                                    {joinTitleFragments(
                                        datapageData.attributionShort,
                                        datapageData.titleVariant
                                    )}
                                </span>
                            </>
                        )}
                    </div>
                    <div>
                        <SimpleMarkdownText
                            text={datapageData.descriptionShort}
                            useParagraphs={false}
                        />
                    </div>
                </div>
            )}
            {source && (
                <div className="key-data span-cols-4 span-sm-cols-12">
                    <div className="key-data__title">Source</div>
                    <div>{source}</div>
                </div>
            )}
            {lastUpdated && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Last updated</div>
                    <div>{lastUpdated}</div>
                </div>
            )}
            {nextUpdate && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Next expected update</div>
                    <div>{nextUpdate}</div>
                </div>
            )}
            {dateRange && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Date range</div>
                    <div>{dateRange}</div>
                </div>
            )}
            {unit && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Unit</div>
                    <div>{unit}</div>
                </div>
            )}
            {unitConversionFactor && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">
                        Unit conversion factor
                    </div>
                    <div>{unitConversionFactor}</div>
                </div>
            )}
            {links && (
                <div className="key-data span-cols-2 span-sm-cols-6">
                    <div className="key-data__title">Links</div>
                    <div className="key-data__content--hide-overflow">
                        {links}
                    </div>
                </div>
            )}
        </div>
    )
}
