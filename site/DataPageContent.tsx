import React, { useEffect } from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { Grapher, GrapherInterface } from "@ourworldindata/grapher"
import { ExpandableToggle } from "./ExpandableToggle.js"
import ReactDOM from "react-dom"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { formatAuthors } from "./clientFormatting.js"
import { ArticleBlocks } from "./gdocs/ArticleBlocks.js"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { DataPageContentFields } from "@ourworldindata/utils"
import { AttachmentsContext, DocumentContext } from "./gdocs/OwidGdoc.js"
import StickyNav from "./blocks/StickyNav.js"
import cx from "classnames"
import { DebugProvider } from "./gdocs/DebugContext.js"
import { CodeSnippet } from "./blocks/CodeSnippet.js"

declare global {
    interface Window {
        _OWID_DATAPAGE_PROPS: DataPageContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

export const DataPageContent = ({
    datapageJson,
    datapageGdoc,
    datapageGdocContent,
    grapherConfig,
    isPreviewing = false,
}: DataPageContentFields & {
    grapherConfig: GrapherInterface
}) => {
    const [grapher, setGrapher] = React.useState<Grapher | undefined>(undefined)

    const sourceShortName =
        datapageJson.variantSource && datapageJson.variantMethods
            ? `${datapageJson.variantMethods} - ${datapageJson.variantSource}`
            : datapageJson.variantSource || datapageJson.variantMethods

    // Initialize the grapher for client-side rendering
    useEffect(() => {
        setGrapher(new Grapher(grapherConfig))
    }, [grapherConfig])

    const {
        linkedDocuments = {},
        imageMetadata = {},
        linkedCharts = {},
        relatedCharts = [],
    } = datapageGdoc || {}

    const REUSE_THIS_WORK_ANCHOR = "#reuse-this-work"

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
        { text: "Sources & Processing", target: "#sources-and-processing" },
        { text: "Reuse This Work", target: REUSE_THIS_WORK_ANCHOR },
    ]

    const hasRelatedDataFeatured = datapageJson.relatedData?.some(
        (data) => data.featured
    )
    const hasRelatedDataNonFeatured = datapageJson.relatedData?.some(
        (data) => !data.featured
    )
    const relatedDataCategoryClasses = `related-data__category ${
        hasRelatedDataFeatured && hasRelatedDataNonFeatured
            ? "related-data__category--grid span-cols-4 span-lg-cols-6 span-sm-cols-3"
            : "related-data__category--columns span-cols-8 span-lg-cols-12"
    } `

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
                                    {datapageJson.title}
                                </h1>
                                <div className="header__source">
                                    {sourceShortName}
                                </div>
                            </div>
                            <div className="header__right col-start-9 span-cols-4 span-sm-cols-12">
                                <div className="topic-tags__label">
                                    See all data and research on:
                                </div>
                                <div className="topic-tags">
                                    {datapageJson.topicTagsLinks.map(
                                        (topic: any) => (
                                            <a href={topic.url} key={topic.url}>
                                                {topic.title}
                                            </a>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <nav className="sticky-nav sticky-nav--dark">
                        <StickyNav links={stickyNavLinks} className="wrapper" />
                    </nav>
                    <div className="chart-key-info">
                        <GrapherWithFallback
                            grapher={grapher}
                            slug={grapherConfig.slug}
                            className="wrapper"
                            id="explore-the-data"
                        />
                        <div className="key-info__wrapper wrapper grid grid-cols-12">
                            <div className="key-info__left col-start-2 span-cols-7 span-lg-cols-8 span-sm-cols-12">
                                {(datapageGdocContent?.keyInfoText ||
                                    datapageJson.subtitle) && (
                                    <div className="key-info__curated">
                                        <h2 className="key-info__title">
                                            {datapageGdocContent?.keyInfoText
                                                ? "What you should know about this indicator"
                                                : "About this data"}
                                        </h2>
                                        <div className="key-info__content">
                                            {datapageGdocContent?.keyInfoText ? (
                                                <ArticleBlocks
                                                    blocks={
                                                        datapageGdocContent.keyInfoText
                                                    }
                                                    containerType="datapage"
                                                />
                                            ) : datapageJson.subtitle ? (
                                                <div>
                                                    {datapageJson.subtitle}
                                                </div>
                                            ) : null}
                                        </div>
                                        {datapageGdocContent?.faqs && (
                                            <a
                                                className="key-info__learn-more"
                                                href="#faqs"
                                            >
                                                Learn more in the FAQs
                                                <FontAwesomeIcon
                                                    icon={faArrowDown}
                                                />
                                            </a>
                                        )}
                                    </div>
                                )}
                                {datapageJson.descriptionFromSource?.title &&
                                    datapageGdocContent?.descriptionFromSource && (
                                        <ExpandableToggle
                                            label={
                                                datapageJson
                                                    .descriptionFromSource.title
                                            }
                                            content={
                                                <ArticleBlocks
                                                    blocks={
                                                        datapageGdocContent.descriptionFromSource
                                                    }
                                                    containerType="datapage"
                                                />
                                            }
                                            isExpandedDefault={
                                                !(
                                                    datapageJson.subtitle ||
                                                    datapageGdocContent.keyInfoText
                                                )
                                            }
                                        />
                                    )}
                            </div>
                            <div className="key-info__right grid grid-cols-3 grid-lg-cols-4 grid-sm-cols-12 span-cols-3 span-lg-cols-4 span-sm-cols-12">
                                <div className="key-data span-cols-3 span-lg-cols-4 span-sm-cols-12">
                                    <div className="key-data__title">
                                        Source
                                    </div>
                                    <div>{datapageJson.nameOfSource}</div>
                                    {datapageJson.owidProcessingLevel && (
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: datapageJson.owidProcessingLevel,
                                            }}
                                        ></div>
                                    )}
                                </div>
                                <div className="key-data span-cols-3 span-lg-cols-4 span-sm-cols-6">
                                    <div className="key-data__title">
                                        Date range
                                    </div>
                                    <div>{datapageJson.dateRange}</div>
                                </div>
                                <div className="key-data span-cols-3 span-lg-cols-4 span-sm-cols-6">
                                    <div className="key-data__title">
                                        Last updated
                                    </div>
                                    <div>{datapageJson.lastUpdated}</div>
                                </div>
                                <div className="key-data span-cols-3 span-lg-cols-4 span-sm-cols-6">
                                    <div className="key-data__title">
                                        Next expected update
                                    </div>
                                    <div>{datapageJson.nextUpdate}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="wrapper">
                        {datapageJson.relatedResearch &&
                            datapageJson.relatedResearch.length > 0 && (
                                <div className="section-wrapper grid">
                                    <h2
                                        className="related-research__title span-cols-3 span-lg-cols-12"
                                        id="research-and-writing"
                                    >
                                        Related research and writing
                                    </h2>
                                    <div className="related-research__items grid grid-cols-9 grid-lg-cols-12 span-cols-9 span-lg-cols-12">
                                        {datapageJson.relatedResearch.map(
                                            (research: any) => (
                                                <a
                                                    href={research.url}
                                                    key={research.url}
                                                    className="related-research__item grid grid-cols-4 grid-lg-cols-6 grid-sm-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12"
                                                >
                                                    <img
                                                        src={encodeURI(
                                                            research.imageUrl
                                                        )}
                                                        alt=""
                                                        className="span-lg-cols-2 span-sm-cols-3"
                                                    />
                                                    <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                                                        <h3 className="related-article__title">
                                                            {research.title}
                                                        </h3>
                                                        <div className="related-article__authors body-3-medium-italic">
                                                            {formatAuthors({
                                                                authors:
                                                                    research.authors,
                                                            })}
                                                        </div>
                                                    </div>
                                                </a>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        {!!datapageJson.relatedData?.length && (
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
                                            {datapageJson.relatedData
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
                                            {datapageJson.relatedData
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
                        {datapageJson.allCharts &&
                        datapageJson.allCharts.length > 0 ? (
                            <div className="section-wrapper section-wrapper__related-charts">
                                <h2
                                    className="related-charts__title"
                                    id="all-charts"
                                >
                                    Explore charts that include this data
                                </h2>
                                <div>
                                    <RelatedCharts
                                        charts={datapageJson.allCharts}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div className="bg-gray-10">
                        <div className="wrapper">
                            {datapageGdocContent?.faqs && (
                                <div className="section-wrapper section-wrapper__faqs grid">
                                    <h2
                                        className="faqs__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                        id="faqs"
                                    >
                                        Frequently Asked Questions
                                    </h2>
                                    <div className="faqs__items grid grid-cols-10 grid-lg-cols-9 grid-md-cols-12 span-cols-10 span-lg-cols-9 span-md-cols-12 span-sm-cols-12">
                                        <ArticleBlocks
                                            blocks={datapageGdocContent.faqs}
                                            containerType="datapage"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="section-wrapper grid">
                                <h2
                                    className="data-sources-processing__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                    id="sources-and-processing"
                                >
                                    Sources and Processing
                                </h2>
                                {datapageJson.sources.length > 0 && (
                                    <div className="data-sources grid span-cols-12">
                                        <h3 className="data-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            This data is based on the following
                                            sources
                                        </h3>
                                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            {datapageJson.sources.map(
                                                (
                                                    source,
                                                    idx: number,
                                                    sources
                                                ) => {
                                                    const sourceDescriptionGdocContent =
                                                        datapageGdocContent?.[
                                                            `sourceDescription${
                                                                idx + 1
                                                            }` as keyof typeof datapageGdocContent
                                                        ]
                                                    return (
                                                        <div
                                                            className="data-sources__source-item"
                                                            key={
                                                                source.sourceName
                                                            }
                                                        >
                                                            <ExpandableToggle
                                                                label={
                                                                    source.sourceName
                                                                }
                                                                isStacked={
                                                                    idx !==
                                                                    sources.length -
                                                                        1
                                                                }
                                                                hasTeaser
                                                                content={
                                                                    <>
                                                                        {sourceDescriptionGdocContent && (
                                                                            <ArticleBlocks
                                                                                blocks={
                                                                                    sourceDescriptionGdocContent
                                                                                }
                                                                                containerType="datapage"
                                                                            />
                                                                        )}
                                                                        {(source.sourceRetrievedOn ||
                                                                            source.sourceRetrievedFromUrl) && (
                                                                            <div
                                                                                className="grid source__key-data"
                                                                                style={{
                                                                                    gridTemplateColumns:
                                                                                        "minmax(0,1fr) minmax(0,2fr)",
                                                                                }}
                                                                            >
                                                                                {source.sourceRetrievedOn && (
                                                                                    <div className="key-data">
                                                                                        <div className="key-data__title--dark">
                                                                                            Retrieved
                                                                                            on
                                                                                        </div>
                                                                                        <div>
                                                                                            {
                                                                                                source.sourceRetrievedOn
                                                                                            }
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {source.sourceRetrievedFromUrl && (
                                                                                    <div className="key-data key-data--hide-overflow">
                                                                                        <div className="key-data__title--dark">
                                                                                            Retrieved
                                                                                            from
                                                                                        </div>
                                                                                        <div>
                                                                                            <a
                                                                                                href={
                                                                                                    source.sourceRetrievedFromUrl
                                                                                                }
                                                                                                target="_blank"
                                                                                                rel="noreferrer"
                                                                                            >
                                                                                                {
                                                                                                    source.sourceRetrievedFromUrl
                                                                                                }
                                                                                            </a>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {source.sourceCitation && (
                                                                                    <div
                                                                                        className="key-data"
                                                                                        style={{
                                                                                            gridColumn:
                                                                                                "span 2",
                                                                                        }}
                                                                                    >
                                                                                        <div className="key-data__title--dark">
                                                                                            Citation
                                                                                        </div>
                                                                                        This
                                                                                        is
                                                                                        the
                                                                                        citation
                                                                                        of
                                                                                        the
                                                                                        original
                                                                                        data
                                                                                        obtained
                                                                                        from
                                                                                        the
                                                                                        source,
                                                                                        prior
                                                                                        to
                                                                                        any
                                                                                        processing
                                                                                        or
                                                                                        adaptation
                                                                                        by
                                                                                        Our
                                                                                        World
                                                                                        in
                                                                                        Data.
                                                                                        To
                                                                                        cite
                                                                                        data
                                                                                        downloaded
                                                                                        from
                                                                                        this
                                                                                        page,
                                                                                        please
                                                                                        use
                                                                                        the
                                                                                        suggested
                                                                                        citation
                                                                                        given
                                                                                        in{" "}
                                                                                        <a
                                                                                            href={
                                                                                                REUSE_THIS_WORK_ANCHOR
                                                                                            }
                                                                                        >
                                                                                            Reuse
                                                                                            This
                                                                                            Work
                                                                                        </a>{" "}
                                                                                        below.
                                                                                        <CodeSnippet
                                                                                            code={
                                                                                                source.sourceCitation
                                                                                            }
                                                                                            theme="light"
                                                                                            isTruncated
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                }
                                                            />
                                                        </div>
                                                    )
                                                }
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="data-processing grid span-cols-12">
                                    <h3 className="data-processing__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        How we process data at Our World in Data
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <div className="data-processing__content">
                                            <p className="data-processing__paragraph">
                                                All data and visualizations on
                                                Our World in Data rely on data
                                                sourced from one or several
                                                original data providers.
                                                Preparing this original data
                                                involves several processing
                                                steps. Depending on the data,
                                                this can include standardizing
                                                country names and world region
                                                definitions, converting units,
                                                calculating derived indicators
                                                such as per capita measures, as
                                                well as adding or adapting
                                                metadata such as the name or the
                                                description given to an
                                                indicator.
                                            </p>
                                            <p className="data-processing__paragraph">
                                                At the link below you can find a
                                                detailed description of the
                                                structure of our data pipeline,
                                                including links to all the code
                                                used to prepare data across Our
                                                World in Data.
                                            </p>
                                        </div>
                                        <a
                                            href="https://docs.owid.io/projects/etl/en/latest/"
                                            target="_blank"
                                            rel="nopener noreferrer"
                                            className="data-processing__link"
                                        >
                                            Read about our data pipeline
                                        </a>
                                    </div>
                                </div>
                                {datapageGdocContent?.variableProcessingInfo && (
                                    <div className="variable-processing-info col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <h5 className="variable-processing-info__header">
                                            Notes on our processing step for
                                            this indicator
                                        </h5>
                                        <div className="variable-processing-info__description">
                                            <ArticleBlocks
                                                blocks={
                                                    datapageGdocContent.variableProcessingInfo
                                                }
                                                containerType="datapage"
                                            />
                                        </div>
                                    </div>
                                )}
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
                                {(datapageJson.citationDataInline ||
                                    datapageJson.citationDataFull ||
                                    datapageJson.citationDatapage) && (
                                    <div className="citations grid span-cols-12">
                                        <h3 className="citations__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            Citations
                                        </h3>
                                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            {(datapageJson.citationDataInline ||
                                                datapageJson.citationDataFull) && (
                                                <div className="citations-section">
                                                    <h5 className="citation__how-to-header citation__how-to-header--data">
                                                        How to cite this data
                                                    </h5>
                                                    {datapageJson.citationDataInline && (
                                                        <>
                                                            <p className="citation__paragraph">
                                                                <span className="citation__type">
                                                                    In-line
                                                                    citation
                                                                </span>
                                                                <br />
                                                                If you have
                                                                limited space
                                                                (e.g. in data
                                                                visualizations,
                                                                on Twitter), you
                                                                can use this
                                                                abbreviated
                                                                in-line
                                                                citation:
                                                            </p>
                                                            <CodeSnippet
                                                                code={
                                                                    datapageJson.citationDataInline
                                                                }
                                                                theme="light"
                                                            />
                                                        </>
                                                    )}
                                                    {datapageJson.citationDataFull && (
                                                        <>
                                                            <p className="citation__paragraph">
                                                                <span className="citation__type">
                                                                    Full
                                                                    citation
                                                                </span>
                                                            </p>
                                                            <CodeSnippet
                                                                code={
                                                                    datapageJson.citationDataFull
                                                                }
                                                                theme="light"
                                                            />
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {datapageJson.citationDatapage && (
                                                <div className="citations-section">
                                                    <h5 className="citation__how-to-header">
                                                        How to cite this page
                                                    </h5>
                                                    <p className="citation__paragraph">
                                                        To cite this page
                                                        overall, including any
                                                        descriptions of the data
                                                        authored by Our World in
                                                        Data, please use the
                                                        following citation:
                                                    </p>
                                                    <CodeSnippet
                                                        code={
                                                            datapageJson.citationDatapage
                                                        }
                                                        theme="light"
                                                    />
                                                </div>
                                            )}
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

export const hydrateDataPageContent = (isPreviewing?: boolean) => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props = window._OWID_DATAPAGE_PROPS

    const grapherConfig = {
        ...window._OWID_GRAPHER_CONFIG,
        isEmbeddedInADataPage: true,
        bindUrlToWindow: true,
    }

    ReactDOM.hydrate(
        <DebugProvider debug={isPreviewing}>
            <DataPageContent
                {...props}
                grapherConfig={grapherConfig}
                isPreviewing={isPreviewing}
            />
        </DebugProvider>,
        wrapper
    )
}
