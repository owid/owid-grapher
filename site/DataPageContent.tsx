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
        datapageJson.variantDescription1 && datapageJson.variantDescription2
            ? `${datapageJson.variantDescription1} - ${datapageJson.variantDescription2}`
            : datapageJson.variantDescription1 ||
              datapageJson.variantDescription2

    // Initialize the grapher for client-side rendering
    useEffect(() => {
        setGrapher(new Grapher(grapherConfig))
    }, [grapherConfig])

    const {
        linkedDocuments = {},
        imageMetadata = {},
        linkedCharts = {},
    } = datapageGdoc || {}

    return (
        <AttachmentsContext.Provider
            value={{ linkedDocuments, imageMetadata, linkedCharts }}
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
                        <h2 className="related-research__title span-cols-3 span-lg-cols-12">
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
                        <h2 className="related-data__title span-cols-3 span-lg-cols-12">
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
                    {datapageJson.relatedCharts &&
                    datapageJson.relatedCharts.length > 0 ? (
                        <div className="related-charts__wrapper wrapper">
                            <h2 className="related-charts__title">
                                Explore charts that include this data
                            </h2>
                            <div>
                                <RelatedCharts
                                    charts={datapageJson.relatedCharts}
                                />
                            </div>
                        </div>
                    ) : null}
                    {datapageGdocContent?.faqs && (
                        <>
                            <div className="gray-wrapper">
                                <div className="faqs__wrapper grid wrapper">
                                    <h2 className="faqs__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        What you should know about this data
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
                            <h2 className="dataset__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                Sources and Processing
                            </h2>
                            <div className="dataset__content col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                <div className="body-2-regular">
                                    In preparing data for our visualizations,
                                    Our World in Data prepares datasets from
                                    original data obtained from one or more data
                                    providers.
                                </div>
                                <div className="data-collection">
                                    <div>
                                        <div className="data-collection__header">
                                            This metric was prepared as part of
                                            the following dataset:
                                        </div>
                                        <div className="data-collection__name">
                                            <FontAwesomeIcon icon={faTable} />
                                            <span
                                                dangerouslySetInnerHTML={{
                                                    __html: datapageJson.datasetName,
                                                }}
                                            />
                                        </div>
                                        {datapageGdocContent?.datasetDescription && (
                                            <div className="data-collection__description">
                                                <ArticleBlocks
                                                    blocks={
                                                        datapageGdocContent.datasetDescription
                                                    }
                                                    containerType="datapage"
                                                />
                                            </div>
                                        )}
                                        {datapageGdocContent?.datasetVariableProcessingInfo && (
                                            <div>
                                                <div className="variable-processing-info__header">
                                                    Particular steps taken to
                                                    prepare this metric:
                                                </div>
                                                <div className="variable-processing-info__description">
                                                    <ArticleBlocks
                                                        blocks={
                                                            datapageGdocContent.datasetVariableProcessingInfo
                                                        }
                                                        containerType="datapage"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        {datapageJson.datasetFeaturedVariables
                                            ?.length ? (
                                            <div
                                                style={{ marginBottom: "24px" }}
                                            >
                                                <h4 className="featured-variables__header">
                                                    Metrics included in this
                                                    data collection:
                                                </h4>
                                                <ul className="featured-variables__list">
                                                    {datapageJson.datasetFeaturedVariables.map(
                                                        (
                                                            variable: any,
                                                            idx: number
                                                        ) => (
                                                            <li
                                                                className="featured-variables__item"
                                                                key={
                                                                    variable.variableName
                                                                }
                                                            >
                                                                {idx !== 0 ? (
                                                                    variable.variableName
                                                                ) : (
                                                                    <strong>
                                                                        {`${variable.variableName} `}
                                                                        <em>
                                                                            (currently
                                                                            viewing)
                                                                        </em>
                                                                    </strong>
                                                                )}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </div>
                                        ) : null}
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
                            {datapageJson.sources.length > 0 && (
                                <div className="datacollection-sources grid span-cols-12">
                                    <h3 className="datacollection-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        This data is based on the following
                                        sources
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        {datapageJson.sources.map(
                                            (source, idx: number) => (
                                                <div
                                                    className="datacollection-source-item"
                                                    key={source.sourceName}
                                                >
                                                    <ExpandableAnimatedToggle
                                                        label={
                                                            source.sourceName
                                                        }
                                                        content={
                                                            <>
                                                                {datapageGdocContent?.[
                                                                    `sourceDescription${
                                                                        idx + 1
                                                                    }`
                                                                ] && (
                                                                    <ArticleBlocks
                                                                        blocks={
                                                                            datapageGdocContent[
                                                                                `sourceDescription${
                                                                                    idx +
                                                                                    1
                                                                                }`
                                                                            ]
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
                                        )}
                                    </div>
                                </div>
                            )}
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
