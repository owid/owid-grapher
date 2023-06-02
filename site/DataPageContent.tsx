import React, { useEffect } from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { Grapher, GrapherInterface } from "@ourworldindata/grapher"
import { ExpandableAnimatedToggle } from "./ExpandableAnimatedToggle.js"
import ReactDOM from "react-dom"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { formatAuthors } from "./clientFormatting.js"
import { ArticleBlocks } from "./gdocs/ArticleBlocks.js"
import { faTable } from "@fortawesome/free-solid-svg-icons/faTable"
import { faGithub } from "@fortawesome/free-brands-svg-icons/faGithub"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import {
    DataPageGdocContent,
    DataPageJson,
    OwidGdocInterface,
} from "@ourworldindata/utils"
import { AttachmentsContext, DocumentContext } from "./gdocs/OwidGdoc.js"
import StickyNav from "./blocks/StickyNav.js"

declare global {
    interface Window {
        _OWID_DATAPAGE_PROPS: any
    }
}

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

export const DataPageContent = ({
    datapageJson,
    datapageGdoc,
    datapageGdocContent,
    grapherConfig,
    isPreviewing = false,
}: {
    datapageJson: DataPageJson
    datapageGdoc?: OwidGdocInterface | null
    datapageGdocContent?: DataPageGdocContent | null
    grapherConfig: GrapherInterface
    isPreviewing: boolean
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

    const stickyNavLinks = [
        {
            text: "Explore the data",
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
    ]

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
                        <div className="header__right col-start-10 span-cols-3 col-md-start-9 span-md-cols-4 span-sm-cols-12">
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
                    <nav className="sticky-nav sticky-nav--light span-cols-14 grid grid-cols-12-full-width">
                        <StickyNav
                            links={stickyNavLinks}
                            className="span-cols-12 col-start-2"
                        />
                    </nav>
                    <div
                        style={{
                            backgroundColor: "#f7f7f7",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <GrapherWithFallback
                            grapher={grapher}
                            slug={grapherConfig.slug}
                            className="wrapper"
                            id="explore-the-data"
                        />
                        <div className="key-info__wrapper wrapper grid grid-cols-12">
                            <div className="key-info__left col-start-2 span-cols-7 span-lg-cols-8 span-sm-cols-12">
                                <h2 className="key-info__title">
                                    What you should know about this indicator
                                </h2>
                                {datapageGdocContent?.keyInfoText ? (
                                    <ArticleBlocks
                                        blocks={datapageGdocContent.keyInfoText}
                                        containerType="datapage"
                                    />
                                ) : datapageJson.subtitle ? (
                                    <div>{datapageJson.subtitle}</div>
                                ) : null}

                                {datapageGdocContent?.faqs && (
                                    <a
                                        className="key-info__learn-more"
                                        href="#faqs"
                                    >
                                        Learn more in the FAQs
                                        <FontAwesomeIcon icon={faArrowDown} />
                                    </a>
                                )}
                                {datapageGdocContent?.descriptionFromSource && (
                                    <div className="key-info__description-source">
                                        <ExpandableAnimatedToggle
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
                                                !datapageJson.subtitle &&
                                                !datapageGdocContent.keyInfoText
                                            }
                                        />
                                    </div>
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
                    <div className="related-research__wrapper grid wrapper">
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
                                            src={research.imageUrl}
                                            alt=""
                                            className="span-lg-cols-2 span-sm-cols-3"
                                        />
                                        <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                                            <h3 className="related-article__title">
                                                {research.title}
                                            </h3>
                                            <div className="related-article__authors body-3-medium-italic">
                                                {formatAuthors({
                                                    authors: research.authors,
                                                })}
                                            </div>
                                        </div>
                                    </a>
                                )
                            )}
                        </div>
                    </div>
                    <div className="DataPageContent__section-border wrapper">
                        <hr />
                    </div>
                    <div className="related-data__wrapper wrapper grid">
                        <h2
                            className="related-data__title span-cols-3 span-lg-cols-12"
                            id="related-data"
                        >
                            Related data
                        </h2>
                        <div className="related-data__items span-cols-9 span-lg-cols-12">
                            <div className="span-cols-3">
                                <a
                                    href={datapageJson.relatedData[0].url}
                                    key={datapageJson.relatedData[0].url}
                                    className="related-data-item related-data-item--medium"
                                >
                                    <div className="related-data-item__type">
                                        {datapageJson.relatedData[0].type}
                                    </div>
                                    {datapageJson.relatedData[0].imageUrl && (
                                        <img
                                            src={
                                                datapageJson.relatedData[0]
                                                    .imageUrl
                                            }
                                            className="related-data-item__image"
                                            alt=""
                                        />
                                    )}
                                    <h3 className="related-data-item__title">
                                        {datapageJson.relatedData[0].title}
                                    </h3>
                                    <div className="related-data-item__source">
                                        {datapageJson.relatedData[0].source}
                                    </div>
                                    <div className="related-data-item__content">
                                        {datapageJson.relatedData[0].content}
                                    </div>
                                </a>
                            </div>
                            <div className="span-cols-3">
                                {datapageJson.relatedData
                                    .slice(1, 3)
                                    .map((data: any) => (
                                        <a
                                            href={data.url}
                                            key={data.url}
                                            className="related-data-item related-data-item--medium"
                                        >
                                            <h3 className="related-data-item__title">
                                                {data.title}
                                            </h3>
                                            <div className="related-data-item__source">
                                                {data.source}
                                            </div>
                                            <div className="related-data-item__content">
                                                {data.content}
                                            </div>
                                        </a>
                                    ))}
                            </div>
                            <div className="span-cols-3">
                                {datapageJson.relatedData
                                    .slice(3)
                                    .map((data: any) => (
                                        <a
                                            href={data.url}
                                            key={data.url}
                                            className="related-data-item--small"
                                        >
                                            <h4 className="related-data-item__title">
                                                {data.title}
                                            </h4>
                                            <div className="related-data-item__source">
                                                {data.source}
                                            </div>
                                        </a>
                                    ))}
                            </div>
                        </div>
                    </div>
                    <div className="DataPageContent__section-border wrapper">
                        <hr />
                    </div>
                    {datapageJson.allCharts &&
                    datapageJson.allCharts.length > 0 ? (
                        <div className="related-charts__wrapper wrapper">
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
                    {datapageGdocContent?.faqs && (
                        <>
                            <div className="gray-wrapper">
                                <div className="faqs__wrapper grid wrapper">
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
                            </div>
                            <div
                                className="DataPageContent__section-border wrapper"
                                style={{
                                    backgroundColor: "#f7f7f7",
                                }}
                            >
                                <hr />
                            </div>
                        </>
                    )}
                    <div className="gray-wrapper">
                        <div className="dataset__wrapper grid wrapper">
                            <h2
                                className="dataset__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                id="sources-and-processing"
                            >
                                Sources and Processing
                            </h2>
                            {datapageJson.sources.length > 0 && (
                                <div className="datacollection-sources grid span-cols-12">
                                    <h3 className="datacollection-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        This data is based on the following
                                        sources
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        {datapageJson.sources.map(
                                            (source, idx: number) => {
                                                const sourceDescriptionGdocContent =
                                                    datapageGdocContent?.[
                                                        `sourceDescription${
                                                            idx + 1
                                                        }` as keyof typeof datapageGdocContent
                                                    ]
                                                return (
                                                    <div
                                                        className="datacollection-source-item"
                                                        key={source.sourceName}
                                                    >
                                                        <ExpandableAnimatedToggle
                                                            label={
                                                                source.sourceName
                                                            }
                                                            isExpandedDefault={
                                                                idx === 0
                                                            }
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
                                                                    <>
                                                                        {source.sourceRetrievedOn &&
                                                                            source.sourceRetrievedFromUrl && (
                                                                                <div className="key-info--gridded grid grid-cols-2">
                                                                                    <div className="key-data">
                                                                                        <div className="key-data__title">
                                                                                            Retrieved
                                                                                            on
                                                                                        </div>
                                                                                        <div>
                                                                                            {
                                                                                                source.sourceRetrievedOn
                                                                                            }
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="key-data">
                                                                                        <div className="key-data__title">
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
                                                                                </div>
                                                                            )}
                                                                    </>
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
                            <div className="datacollection-processing grid span-cols-12">
                                <h3 className="datacollection-processing__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                    How we process data at{" "}
                                    <em>Our World in Data</em>
                                </h3>
                                <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                    <div className="datacollection-processing__content">
                                        <p className="datacollection-processing__paragraph">
                                            All data and visualizations on Our
                                            World in Data rely on data sourced
                                            from one or several original data
                                            providers. Preparing this original
                                            data involves several processing
                                            steps. Depending on the data, this
                                            can include standardizing country
                                            names and world region definitions,
                                            converting units, calculating
                                            derived indicators such as per
                                            capita measures, as well as adding
                                            or adapting metadata such as the
                                            name or the description given to an
                                            indicator.
                                        </p>
                                        <p className="datacollection-processing__paragraph">
                                            At the link below you can find a
                                            detailed description of the
                                            structure of our data pipeline,
                                            including links to all the code used
                                            to prepare data across Our World in
                                            Data.
                                        </p>
                                    </div>
                                    <a
                                        href="https://docs.owid.io/projects/etl/en/latest/"
                                        target="_blank"
                                        rel="nopener noreferrer"
                                        className="datacollection-processing__link"
                                    >
                                        Read about our data pipeline
                                    </a>
                                </div>
                            </div>
                            <div className="dataset__content col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                <div className="data-collection">
                                    {datapageGdocContent?.variableProcessingInfo && (
                                        <div>
                                            <div className="variable-processing-info__header">
                                                Notes on our processing step for
                                                this indicator
                                            </div>
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
                                    <div>
                                        <div
                                            className="key-info--gridded grid grid-cols-2"
                                            style={{ marginBottom: "24px" }}
                                        >
                                            <div className="key-data">
                                                <div className="key-data__title">
                                                    Last updated
                                                </div>
                                                <div>
                                                    {datapageJson.lastUpdated}
                                                </div>
                                            </div>
                                            <div className="key-data">
                                                <div className="key-data__title">
                                                    Next expected update
                                                </div>
                                                <div>
                                                    {datapageJson.nextUpdate}
                                                </div>
                                            </div>
                                            {datapageJson.datasetLicenseLink && (
                                                <div className="key-data">
                                                    <div className="key-data__title">
                                                        Licence
                                                    </div>
                                                    <div>
                                                        <a
                                                            href={
                                                                datapageJson
                                                                    .datasetLicenseLink
                                                                    .url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            {
                                                                datapageJson
                                                                    .datasetLicenseLink
                                                                    .title
                                                            }
                                                        </a>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {datapageJson.datasetCodeUrl && (
                                            <a
                                                href={
                                                    datapageJson.datasetCodeUrl
                                                }
                                                className="data-collection__code-link"
                                            >
                                                <FontAwesomeIcon
                                                    icon={faGithub}
                                                />
                                                See the code used to prepare
                                                this dataset
                                            </a>
                                        )}
                                    </div>
                                    {/* <ExpandableAnimatedToggle
                                    label="Download all metrics"
                                    content="TBD"
                                /> */}
                                </div>
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
    ReactDOM.hydrate(
        <DataPageContent {...props} isPreviewing={isPreviewing} />,
        wrapper
    )
}
