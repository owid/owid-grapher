import * as _ from "lodash-es"
import cx from "classnames"
import {
    ImageMetadata,
    LinkedChart,
    OwidGdocMinimalPostInterface,
    LinkedAuthor,
} from "@ourworldindata/utils"
import { DataInsightBody } from "./gdocs/pages/DataInsight.js"
import { dataInsightIndexToIdMap } from "./SiteConstants.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DataInsightsIndexPageProps } from "./DataInsightsIndexPage.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faClose, faTag } from "@fortawesome/free-solid-svg-icons"
import { Pagination } from "./Pagination.js"
import { NewsletterSignupBlock } from "./NewsletterSignupBlock.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"

export const DataInsightsIndexPageContent = (
    props: DataInsightsIndexPageProps
) => {
    const { pageNumber, dataInsights, isPreviewing = false, topicTag } = props
    // Extract all attachments from the data insights and supply them to the AttachmentsContext
    const { imageMetadata, linkedAuthors, linkedCharts, linkedDocuments } =
        dataInsights.reduce(
            (acc, di) => ({
                imageMetadata: _.merge(acc.imageMetadata, di.imageMetadata),
                linkedAuthors: di.linkedAuthors
                    ? [...acc.linkedAuthors, ...di.linkedAuthors]
                    : acc.linkedAuthors,
                linkedCharts: _.merge(acc.linkedCharts, di.linkedCharts),
                linkedDocuments: _.merge(
                    acc.linkedDocuments,
                    di.linkedDocuments
                ),
            }),
            {
                imageMetadata: {} as Record<string, ImageMetadata>,
                linkedAuthors: [] as LinkedAuthor[],
                linkedCharts: {} as Record<string, LinkedChart>,
                linkedDocuments: {} as Record<
                    string,
                    OwidGdocMinimalPostInterface
                >,
            }
        )
    const firstDataInsight = dataInsights.slice(0, 1)
    const remainingDataInsights = dataInsights.slice(1)

    const renderDataInsight = (
        dataInsight: (typeof dataInsights)[number],
        index: number
    ) => {
        const id = pageNumber === 1 ? dataInsightIndexToIdMap[index] : undefined

        return (
            <DataInsightBody
                key={dataInsight.id}
                anchor={id}
                shouldLinkTitle
                {...dataInsight}
            />
        )
    }

    return (
        <DocumentContext.Provider value={{ isPreviewing }}>
            <AttachmentsContext.Provider
                value={{
                    imageMetadata,
                    linkedAuthors: _.uniqBy(linkedAuthors, ({ name }) => name),
                    linkedCharts,
                    linkedDocuments,
                    linkedIndicators: {}, // not needed for data insights
                    relatedCharts: [], // not needed for the index page
                    latestDataInsights: [], // not needed for the index page
                    tags: [], // not needed for the index page
                }}
            >
                <header className="data-insights-index-page__header grid grid-cols-12-full-width span-cols-14">
                    <h2 className="span-cols-6 col-start-5 col-md-start-4 span-md-cols-10 col-sm-start-2 span-sm-cols-12 display-2-semibold ">
                        Data Insights
                    </h2>
                    <p className="span-cols-6 col-start-5 col-md-start-4 span-md-cols-8 col-sm-start-2 span-sm-cols-12 body-1-regular">
                        Bite-sized insights on how the world is changing,
                        published every few days.
                    </p>
                    {topicTag?.name && (
                        <FilterPill
                            name={topicTag.name}
                            className="span-cols-6 col-start-5 col-md-start-4 span-md-cols-8 col-sm-start-2 span-sm-cols-12"
                        />
                    )}
                </header>
                {firstDataInsight.map((dataInsight, index) =>
                    renderDataInsight(dataInsight, index)
                )}
                <NewsletterSignupBlock
                    className="data-insights-index-page__newsletter-signup col-start-11 span-cols-3 span-md-cols-8 col-md-start-4 col-sm-start-1 span-sm-cols-14"
                    context={NewsletterSubscriptionContext.DataInsightsIndex}
                />
                {remainingDataInsights.map((dataInsight, index) =>
                    renderDataInsight(
                        dataInsight,
                        index + firstDataInsight.length
                    )
                )}
                <Pagination
                    totalPageCount={props.totalPageCount}
                    pageNumber={props.pageNumber}
                    basePath="/data-insights"
                    queryParams={
                        props.topicTag?.name
                            ? { topic: props.topicTag.name }
                            : undefined
                    }
                    className="span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"
                />
            </AttachmentsContext.Provider>
        </DocumentContext.Provider>
    )
}

export function FilterPill({
    name,
    className,
}: {
    name: string
    className?: string
}) {
    const nameLabel = name.replaceAll(" and ", " & ")

    return (
        <a
            key={name}
            aria-label={`Remove ${name}`}
            href="/data-insights"
            className={cx("filter-button", className)}
        >
            <span className="filter-pill">
                <FontAwesomeIcon className="filter-pill__icon" icon={faTag} />
                <span className="filter-pill__name">{nameLabel}</span>
                <span className="filter-pill__close">
                    <FontAwesomeIcon icon={faClose} />
                </span>
            </span>
        </a>
    )
}

export const _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA =
    "_OWID_DATA_INSIGHTS_INDEX_PAGE_DATA"
