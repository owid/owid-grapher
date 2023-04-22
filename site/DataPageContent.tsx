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
import { FallbackGdocFieldExplain } from "./FallbackFieldExplain.js"

declare global {
    interface Window {
        _OWID_DATAPAGE_PROPS: any
    }
}

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapage-root"

export const ALLOWED_DATAPAGE_GDOC_FIELDS = [
    "keyInfoText",
    "faqs",
    "descriptionFromSource",
    "datasetDescription",
    "datasetVariableProcessingInfo",
] as const

export const DataPageContent = ({
    datapage,
    grapherConfig,
}: {
    datapage: any
    grapherConfig: GrapherInterface
}) => {
    const [grapher, setGrapher] = React.useState<Grapher | undefined>(undefined)

    const sourceShortName =
        datapage.variantDescription1 && datapage.variantDescription2
            ? `${datapage.variantDescription1} - ${datapage.variantDescription2}`
            : datapage.variantDescription1 || datapage.variantDescription2

    // Initialize the grapher for client-side rendering
    useEffect(() => {
        setGrapher(new Grapher(grapherConfig))
    }, [grapherConfig])

    return (
        <>
            <div className="DataPageContent__grapher-for-embed">
                <GrapherWithFallback
                    grapher={grapher}
                    slug={grapherConfig.slug}
                />
            </div>
            <div className="DataPageContent">
                <div className="header__wrapper wrapper">
                    <div className="header__left">
                        <div className="header__supertitle">Data</div>
                        <h1 className="header__title">{datapage.title}</h1>
                        <div className="header__source">{sourceShortName}</div>
                    </div>
                    <div className="header__right">
                        <div className="topic-tags__label">
                            See all data and research on:
                        </div>
                        <div className="topic-tags">
                            {datapage.topicTagsLinks.map((topic: any) => (
                                <a href={topic.url} key={topic.url}>
                                    {topic.title}
                                </a>
                            ))}
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
                    <div className="key-info__wrapper wrapper">
                        <div className="key-info__left">
                            <h2 className="key-info__title">Key information</h2>
                            <FallbackGdocFieldExplain
                                googleDocEditLink={datapage.googleDocEditLink}
                                fieldName="keyInfoText"
                                level="info"
                                render={(fallback) =>
                                    datapage?.keyInfoText ? (
                                        <ArticleBlocks
                                            blocks={datapage.keyInfoText}
                                            containerType="datapage"
                                        />
                                    ) : datapage.subtitle ? (
                                        <div>{datapage.subtitle}</div>
                                    ) : (
                                        fallback
                                    )
                                }
                            />

                            {datapage?.faqs && (
                                <a
                                    className="key-info__learn-more"
                                    href="#faqs"
                                >
                                    Learn more in the FAQs
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </a>
                            )}
                            <FallbackGdocFieldExplain
                                googleDocEditLink={datapage.googleDocEditLink}
                                fieldName="descriptionFromSource"
                                level="info"
                                render={(fallback) =>
                                    datapage.descriptionFromSource?.title &&
                                    datapage?.descriptionFromSource ? (
                                        <div className="key-info__description-source">
                                            <ExpandableAnimatedToggle
                                                label={
                                                    datapage
                                                        .descriptionFromSource
                                                        .title
                                                }
                                                content={
                                                    <ArticleBlocks
                                                        blocks={
                                                            datapage.descriptionFromSource
                                                        }
                                                        containerType="datapage"
                                                    />
                                                }
                                                isExpandedDefault={
                                                    !datapage.subtitle &&
                                                    !datapage?.keyInfoText
                                                }
                                            />
                                        </div>
                                    ) : (
                                        fallback
                                    )
                                }
                            />
                        </div>
                        <div className="key-info__right">
                            <div className="key-data">
                                <div className="key-data__title">Source</div>
                                <div>{datapage.nameOfSource}</div>
                                {datapage.owidProcessingLevel && (
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: datapage.owidProcessingLevel,
                                        }}
                                    ></div>
                                )}
                            </div>
                            <div className="key-data">
                                <div className="key-data__title">
                                    Date range
                                </div>
                                <div>{datapage.dateRange}</div>
                            </div>
                            <div className="key-data">
                                <div className="key-data__title">
                                    Last updated
                                </div>
                                <div>{datapage.lastUpdated}</div>
                            </div>
                            <div className="key-data">
                                <div className="key-data__title">
                                    Next expected update
                                </div>
                                <div>{datapage.nextUpdate}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="related-research__wrapper grid wrapper">
                    <h2 className="related-research__title span-cols-3">
                        Related research and writing
                    </h2>
                    <div className="related-research__items span-cols-9">
                        {datapage.relatedResearch.map((research: any) => (
                            <a
                                href={research.url}
                                key={research.url}
                                className="related-research__item span-cols-4"
                            >
                                <img src={research.imageUrl} alt="" />
                                <div className="span-cols-3">
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
                        ))}
                    </div>
                </div>
                <div className="DataPageContent__section-border wrapper">
                    <hr />
                </div>
                <div className="related-data__wrapper wrapper grid">
                    <h2 className="related-data__title span-cols-3">
                        Related data
                    </h2>
                    <div className="related-data__items span-cols-9">
                        <div className="span-cols-3">
                            <a
                                href={datapage.relatedData[0].url}
                                key={datapage.relatedData[0].url}
                                className="related-data-item related-data-item--medium"
                            >
                                <div className="related-data-item__type">
                                    {datapage.relatedData[0].type}
                                </div>
                                <h3 className="related-data-item__title">
                                    {datapage.relatedData[0].title}
                                </h3>
                                <div className="related-data-item__source">
                                    {datapage.relatedData[0].source}
                                </div>
                                <div className="related-data-item__content">
                                    {datapage.relatedData[0].content}
                                </div>
                            </a>
                        </div>
                        <div className="span-cols-3">
                            {datapage.relatedData
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
                            {datapage.relatedData.slice(3).map((data: any) => (
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
                {datapage.relatedCharts.items.length > 0 && (
                    <div className="related-charts__wrapper wrapper">
                        <h2 className="related-charts__title">
                            Explore charts that include this data
                        </h2>
                        <div>
                            <RelatedCharts
                                charts={datapage.relatedCharts.items}
                            />
                        </div>
                    </div>
                )}
                <FallbackGdocFieldExplain
                    googleDocEditLink={datapage.googleDocEditLink}
                    fieldName="faqs"
                    level="info"
                    render={(fallback) =>
                        datapage?.faqs ? (
                            <>
                                <div
                                    style={{
                                        backgroundColor: "#f7f7f7",
                                        padding: "48px 0",
                                    }}
                                >
                                    <div className="faqs__wrapper grid wrapper">
                                        <h2
                                            className="faqs__title span-cols-2"
                                            id="faqs"
                                        >
                                            What you should know about this data
                                        </h2>
                                        <div className="faqs__items grid grid-cols-8 span-cols-8">
                                            <ArticleBlocks
                                                blocks={datapage.faqs}
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
                        ) : (
                            fallback
                        )
                    }
                />
                <div
                    style={{
                        backgroundColor: "#f7f7f7",
                        padding: "48px 0",
                    }}
                >
                    <div className="dataset__wrapper grid wrapper">
                        <h2 className="dataset__title span-cols-3">
                            Sources and Processing
                        </h2>
                        <div className="dataset__content span-cols-6">
                            <div className="body-2-regular">
                                In preparing data for our visualizations, Our
                                World in Data prepares datasets from original
                                data obtained from one or more data providers.
                            </div>
                            <div className="data-collection">
                                <div>
                                    <div className="data-collection__header">
                                        This metric was prepared as part of the
                                        following dataset:
                                    </div>
                                    <div className="data-collection__name">
                                        <FontAwesomeIcon icon={faTable} />
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: datapage.datasetName,
                                            }}
                                        />
                                    </div>
                                    <FallbackGdocFieldExplain
                                        googleDocEditLink={
                                            datapage.googleDocEditLink
                                        }
                                        fieldName="datasetDescription"
                                        level="error"
                                        render={(fallback) =>
                                            datapage?.datasetDescription ? (
                                                <div className="data-collection__description">
                                                    <ArticleBlocks
                                                        blocks={
                                                            datapage.datasetDescription
                                                        }
                                                        containerType="datapage"
                                                    />
                                                </div>
                                            ) : (
                                                fallback
                                            )
                                        }
                                    />
                                    <FallbackGdocFieldExplain
                                        googleDocEditLink={
                                            datapage.googleDocEditLink
                                        }
                                        fieldName="datasetVariableProcessingInfo"
                                        level="info"
                                        render={(fallback) =>
                                            datapage?.datasetVariableProcessingInfo ? (
                                                <div>
                                                    <div className="variable-processing-info__header">
                                                        Particular steps taken
                                                        to prepare this metric:
                                                    </div>
                                                    <div className="variable-processing-info__description">
                                                        <ArticleBlocks
                                                            blocks={
                                                                datapage.datasetVariableProcessingInfo
                                                            }
                                                            containerType="datapage"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                fallback
                                            )
                                        }
                                    />
                                </div>
                                <div>
                                    <div style={{ marginBottom: "24px" }}>
                                        <h4 className="featured-variables__header">
                                            Metrics included in this data
                                            collection:
                                        </h4>
                                        <ul className="featured-variables__list">
                                            {datapage.datasetFeaturedVariables.map(
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
                                    <div
                                        className="key-info--gridded grid grid-cols-2"
                                        style={{ marginBottom: "24px" }}
                                    >
                                        <div className="key-data">
                                            <div className="key-data__title">
                                                Last updated
                                            </div>
                                            <div>{datapage.lastUpdated}</div>
                                        </div>
                                        <div className="key-data">
                                            <div className="key-data__title">
                                                Next expected update
                                            </div>
                                            <div>{datapage.nextUpdate}</div>
                                        </div>
                                        <div className="key-data">
                                            <div className="key-data__title">
                                                Licence
                                            </div>
                                            <div>
                                                <a
                                                    href={
                                                        datapage
                                                            .datasetLicenseLink
                                                            .url
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {
                                                        datapage
                                                            .datasetLicenseLink
                                                            .title
                                                    }
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    {datapage.datasetCodeUrl && (
                                        <a
                                            href={datapage.datasetCodeUrl}
                                            className="data-collection__code-link"
                                        >
                                            <FontAwesomeIcon icon={faGithub} />
                                            See the code used to prepare this
                                            dataset
                                        </a>
                                    )}
                                </div>
                                <ExpandableAnimatedToggle
                                    label="Download all metrics"
                                    content="TBD"
                                />
                            </div>
                        </div>
                        {datapage.sources.length > 0 && (
                            <div className="datacollection-sources grid span-cols-12">
                                <h3 className="datacollection-sources__heading span-cols-3">
                                    This data is based on the following sources:
                                </h3>
                                <div className="span-cols-6">
                                    {datapage.sources.map(
                                        (source: any, idx: number) => (
                                            <div
                                                className="datacollection-source-item"
                                                key={source.sourceName}
                                            >
                                                <ExpandableAnimatedToggle
                                                    label={source.sourceName}
                                                    content={
                                                        <>
                                                            <FallbackGdocFieldExplain
                                                                googleDocEditLink={
                                                                    datapage.googleDocEditLink
                                                                }
                                                                fieldName={`sourceDescription${
                                                                    idx + 1
                                                                }`}
                                                                level="info"
                                                                render={(
                                                                    fallback
                                                                ) =>
                                                                    datapage?.[
                                                                        `sourceDescription${
                                                                            idx +
                                                                            1
                                                                        }`
                                                                    ] ? (
                                                                        <ArticleBlocks
                                                                            blocks={
                                                                                datapage[
                                                                                    `sourceDescription${
                                                                                        idx +
                                                                                        1
                                                                                    }`
                                                                                ]
                                                                            }
                                                                            containerType="datapage"
                                                                        />
                                                                    ) : (
                                                                        fallback
                                                                    )
                                                                }
                                                            />
                                                            <>
                                                                {source.sourceRetrievedOn &&
                                                                    source.sourceRetrievedFrom && (
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
        </>
    )
}

export const hydrateDataPageContent = () => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props = window._OWID_DATAPAGE_PROPS
    ReactDOM.hydrate(<DataPageContent {...props} />, wrapper)
}
