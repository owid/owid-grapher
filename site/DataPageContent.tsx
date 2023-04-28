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
import { DataPageGdoc, DataPageJson } from "@ourworldindata/utils"

declare global {
    interface Window {
        _OWID_DATAPAGE_PROPS: any
    }
}

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

export const DataPageContent = ({
    datapageJson,
    datapageGdoc,
    grapherConfig,
}: {
    datapageJson: DataPageJson
    datapageGdoc: DataPageGdoc | null
    grapherConfig: GrapherInterface
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
                        <h1 className="header__title">{datapageJson.title}</h1>
                        <div className="header__source">{sourceShortName}</div>
                    </div>
                    <div className="header__right">
                        <div className="topic-tags__label">
                            See all data and research on:
                        </div>
                        <div className="topic-tags">
                            {datapageJson.topicTagsLinks.map((topic: any) => (
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
                                googleDocEditLink={
                                    datapageJson.googleDocEditLink
                                }
                                fieldName="keyInfoText"
                                level="info"
                                render={(fallback) =>
                                    datapageGdoc?.keyInfoText ? (
                                        <ArticleBlocks
                                            blocks={datapageGdoc.keyInfoText}
                                            containerType="datapage"
                                        />
                                    ) : datapageJson.subtitle ? (
                                        <div>{datapageJson.subtitle}</div>
                                    ) : (
                                        fallback
                                    )
                                }
                            />

                            {datapageGdoc?.faqs && (
                                <a
                                    className="key-info__learn-more"
                                    href="#faqs"
                                >
                                    Learn more in the FAQs
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </a>
                            )}
                            <FallbackGdocFieldExplain
                                googleDocEditLink={
                                    datapageJson.googleDocEditLink
                                }
                                fieldName="descriptionFromSource"
                                level="info"
                                render={(fallback) =>
                                    datapageJson.descriptionFromSource.title &&
                                    datapageGdoc?.descriptionFromSource ? (
                                        <div className="key-info__description-source">
                                            <ExpandableAnimatedToggle
                                                label={
                                                    datapageJson
                                                        .descriptionFromSource
                                                        .title
                                                }
                                                content={
                                                    <ArticleBlocks
                                                        blocks={
                                                            datapageGdoc.descriptionFromSource
                                                        }
                                                        containerType="datapage"
                                                    />
                                                }
                                                isExpandedDefault={
                                                    !datapageJson.subtitle &&
                                                    !datapageGdoc.keyInfoText
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
                                <div>{datapageJson.nameOfSource}</div>
                                {datapageJson.owidProcessingLevel && (
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: datapageJson.owidProcessingLevel,
                                        }}
                                    ></div>
                                )}
                            </div>
                            <div className="key-data">
                                <div className="key-data__title">
                                    Date range
                                </div>
                                <div>{datapageJson.dateRange}</div>
                            </div>
                            <div className="key-data">
                                <div className="key-data__title">
                                    Last updated
                                </div>
                                <div>{datapageJson.lastUpdated}</div>
                            </div>
                            <div className="key-data">
                                <div className="key-data__title">
                                    Next expected update
                                </div>
                                <div>{datapageJson.nextUpdate}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="related-research__wrapper grid wrapper">
                    <h2 className="related-research__title span-cols-3">
                        Related research and writing
                    </h2>
                    <div className="related-research__items span-cols-9">
                        {datapageJson.relatedResearch.map((research: any) => (
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
                                href={datapageJson.relatedData[0].url}
                                key={datapageJson.relatedData[0].url}
                                className="related-data-item related-data-item--medium"
                            >
                                <div className="related-data-item__type">
                                    {datapageJson.relatedData[0].type}
                                </div>
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
                {datapageJson.relatedCharts.items.length > 0 && (
                    <div className="related-charts__wrapper wrapper">
                        <h2 className="related-charts__title">
                            Explore charts that include this data
                        </h2>
                        <div>
                            <RelatedCharts
                                charts={datapageJson.relatedCharts.items}
                            />
                        </div>
                    </div>
                )}
                <FallbackGdocFieldExplain
                    googleDocEditLink={datapageJson.googleDocEditLink}
                    fieldName="faqs"
                    level="info"
                    render={(fallback) =>
                        datapageGdoc?.faqs ? (
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
                                                blocks={datapageGdoc.faqs}
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
                                                __html: datapageJson.datasetName,
                                            }}
                                        />
                                    </div>
                                    <FallbackGdocFieldExplain
                                        googleDocEditLink={
                                            datapageJson.googleDocEditLink
                                        }
                                        fieldName="datasetDescription"
                                        level="error"
                                        render={(fallback) =>
                                            datapageGdoc?.datasetDescription ? (
                                                <div className="data-collection__description">
                                                    <ArticleBlocks
                                                        blocks={
                                                            datapageGdoc.datasetDescription
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
                                            datapageJson.googleDocEditLink
                                        }
                                        fieldName="datasetVariableProcessingInfo"
                                        level="info"
                                        render={(fallback) =>
                                            datapageGdoc?.datasetVariableProcessingInfo ? (
                                                <div>
                                                    <div className="variable-processing-info__header">
                                                        Particular steps taken
                                                        to prepare this metric:
                                                    </div>
                                                    <div className="variable-processing-info__description">
                                                        <ArticleBlocks
                                                            blocks={
                                                                datapageGdoc.datasetVariableProcessingInfo
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
                                    {!!datapageJson.datasetFeaturedVariables
                                        ?.length && (
                                        <div style={{ marginBottom: "24px" }}>
                                            <h4 className="featured-variables__header">
                                                Metrics included in this data
                                                collection:
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
                                    )}
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
                                            <div>{datapageJson.nextUpdate}</div>
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
                                            href={datapageJson.datasetCodeUrl}
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
                        {datapageJson.sources.length > 0 && (
                            <div className="datacollection-sources grid span-cols-12">
                                <h3 className="datacollection-sources__heading span-cols-3">
                                    This data is based on the following sources:
                                </h3>
                                <div className="span-cols-6">
                                    {datapageJson.sources.map(
                                        (source, idx: number) => (
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
                                                                    datapageJson.googleDocEditLink
                                                                }
                                                                fieldName={`sourceDescription${
                                                                    idx + 1
                                                                }`}
                                                                level="info"
                                                                render={(
                                                                    fallback
                                                                ) =>
                                                                    datapageGdoc?.[
                                                                        `sourceDescription${
                                                                            idx +
                                                                            1
                                                                        }`
                                                                    ] ? (
                                                                        <ArticleBlocks
                                                                            blocks={
                                                                                datapageGdoc[
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
        </>
    )
}

export const hydrateDataPageContent = () => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props = window._OWID_DATAPAGE_PROPS
    ReactDOM.hydrate(<DataPageContent {...props} />, wrapper)
}
