import React, { useEffect } from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { Grapher, GrapherInterface } from "@ourworldindata/grapher"
import { ExpandableAnimatedToggle } from "./ExpandableAnimatedToggle.js"
import ReactDOM from "react-dom"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { formatAuthors } from "./clientFormatting.js"
import {
    GdocsContentSource,
    OwidArticleType,
    getArticleFromJSON,
    getLinkType,
    getUrlTarget,
} from "@ourworldindata/utils"
import { ArticleBlocks } from "./gdocs/ArticleBlocks.js"
import { faTable } from "@fortawesome/free-solid-svg-icons/faTable"
import { faGithub } from "@fortawesome/free-brands-svg-icons/faGithub"

declare global {
    interface Window {
        _OWID_DATAPAGE_PROPS: any
    }
}

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapage-root"

export const DataPageContent = ({
    datapage,
    grapherConfig,
}: {
    datapage: any
    grapherConfig: GrapherInterface
}) => {
    const [grapher, setGrapher] = React.useState<Grapher | undefined>(undefined)
    const [faqsArticle, setFaqsArticle] = React.useState<
        OwidArticleType | undefined
    >(undefined)

    const sourceShortName =
        datapage.variantDescription1 && datapage.variantDescription2
            ? `${datapage.variantDescription1} - ${datapage.variantDescription2}`
            : datapage.variantDescription1 || datapage.variantDescription2

    // Initialize the grapher for client-side rendering
    useEffect(() => {
        setGrapher(new Grapher(grapherConfig))
    }, [grapherConfig])

    // Not suitable for production, only for prototyping
    useEffect(() => {
        const fetchFaqsArticle = async (googleDocId: string) => {
            const response = await fetch(
                `/admin/api/gdocs/${googleDocId}?contentSource=${GdocsContentSource.Gdocs}`
            )
            const json = await response.json()
            setFaqsArticle(getArticleFromJSON(json))
        }

        if (
            !datapage.faqsGoogleDocEditLink ||
            getLinkType(datapage.faqsGoogleDocEditLink) !== "gdoc"
        )
            return
        const googleDocId = getUrlTarget(datapage.faqsGoogleDocEditLink)
        fetchFaqsArticle(googleDocId)
    }, [datapage.faqsGoogleDocEditLink])

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
                        <div className="supertitle">DATA</div>
                        <h1>{datapage.title}</h1>
                        <div className="source">{sourceShortName}</div>
                    </div>
                    <div className="header__right">
                        <div className="label">
                            SEE ALL DATA AND RESEARCH ON:
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
                            <h2>Key information</h2>
                            {datapage.keyInfoText && (
                                <div
                                    dangerouslySetInnerHTML={{
                                        __html: datapage.keyInfoText,
                                    }}
                                />
                            )}
                            {!!datapage.faqs?.items?.length && (
                                <a className="learn-more" href="#faq">
                                    Learn more in the FAQs
                                    <FontAwesomeIcon icon={faArrowDown} />
                                </a>
                            )}
                            {datapage.sourceVariableDescription?.title &&
                                datapage.sourceVariableDescription?.content && (
                                    <div style={{ marginTop: 8 }}>
                                        <ExpandableAnimatedToggle
                                            label={
                                                datapage
                                                    .sourceVariableDescription
                                                    .title
                                            }
                                            content={
                                                datapage
                                                    .sourceVariableDescription
                                                    .content
                                            }
                                        />
                                    </div>
                                )}
                        </div>
                        <div className="key-info__right">
                            <div className="key-info__data">
                                <div className="title">Source</div>
                                <div className="name">{sourceShortName}</div>
                                {datapage.owidProcessingLevel && (
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: datapage.owidProcessingLevel,
                                        }}
                                    ></div>
                                )}
                            </div>
                            <div className="key-info__data">
                                <div className="title">Date range</div>
                                <div>{datapage.dateRange}</div>
                            </div>
                            <div className="key-info__data">
                                <div className="title">Last updated</div>
                                <div>{datapage.lastUpdated}</div>
                            </div>
                            <div className="key-info__data">
                                <div className="title">
                                    Next expected update
                                </div>
                                <div>{datapage.nextUpdate}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="related-research grid wrapper">
                    <h2 className="span-cols-3">
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
                                    <h3>{research.title}</h3>
                                    <div className="authors body-3-medium-italic">
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
                <div className="related-data wrapper grid">
                    <h2 className="span-cols-3">Related data</h2>
                    <div className="related-data__items span-cols-9">
                        <div className="span-cols-3">
                            <a
                                href={datapage.relatedData[0].url}
                                key={datapage.relatedData[0].url}
                                className="related-data__item related-data__item--padded"
                            >
                                <div className="related-data__type">
                                    {datapage.relatedData[0].type}
                                </div>
                                <h3>{datapage.relatedData[0].title}</h3>
                                <div className="related-data__source">
                                    {datapage.relatedData[0].source}
                                </div>
                                <div className="related-data__content">
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
                                        className="related-data__item related-data__item--padded"
                                    >
                                        <h3>{data.title}</h3>
                                        <div className="related-data__source">
                                            {data.source}
                                        </div>
                                        <div className="related-data__content">
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
                                    className="related-data__item"
                                >
                                    <h4>{data.title}</h4>
                                    <div className="related-data__source">
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
                <div
                    style={{
                        backgroundColor: "#f7f7f7",
                        padding: "48px 0",
                    }}
                >
                    <div className="faq grid wrapper">
                        <h2 className="span-cols-2">
                            What you should know about this data
                        </h2>
                        <div className="faq__items grid grid-cols-8 span-cols-8">
                            {faqsArticle?.content.body && (
                                <ArticleBlocks
                                    blocks={faqsArticle.content.body}
                                    containerType="datapage"
                                />
                            )}
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
                <div
                    style={{
                        backgroundColor: "#f7f7f7",
                        padding: "48px 0",
                    }}
                >
                    <div className="dataset grid wrapper">
                        <h2 className="span-cols-3">Sources and Processing</h2>
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
                                                __html: datapage.dataset
                                                    .datasetName,
                                            }}
                                        />
                                    </div>
                                    <div
                                        className="data-collection__description"
                                        dangerouslySetInnerHTML={{
                                            __html: datapage.dataset
                                                .datasetDescription,
                                        }}
                                    />
                                </div>
                                <div>
                                    <div style={{ marginBottom: "24px" }}>
                                        <h4 className="metrics-list__header">
                                            Metrics included in this data
                                            collection:
                                        </h4>
                                        <ul className="featured-variables">
                                            {datapage.dataset.featuredVariables.map(
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
                                    <div className="data-collection__key-info grid grid-cols-2">
                                        <div className="key-info__data">
                                            <div className="title">
                                                Last updated
                                            </div>
                                            <div>{datapage.lastUpdated}</div>
                                        </div>
                                        <div className="key-info__data">
                                            <div className="title">
                                                Next expected update
                                            </div>
                                            <div>{datapage.nextUpdate}</div>
                                        </div>
                                        <div className="key-info__data">
                                            <div className="title">Licence</div>
                                            <div>
                                                <a
                                                    href={
                                                        datapage.dataset
                                                            .datasetLicenseLink
                                                            .url
                                                    }
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {
                                                        datapage.dataset
                                                            .datasetLicenseLink
                                                            .title
                                                    }
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    {datapage.dataset?.codeUrl && (
                                        <a
                                            href={datapage.dataset.codeUrl}
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
