import * as _ from "lodash-es"
import cx from "classnames"
import {
    ImageMetadata,
    LinkedChart,
    OwidGdocMinimalPostInterface,
    LinkedAuthor,
    getPaginationPageNumbers,
} from "@ourworldindata/utils"
import { DataInsightBody } from "./gdocs/pages/DataInsight.js"
import { dataInsightIndexToIdMap } from "./SiteConstants.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DataInsightsIndexPageProps } from "./DataInsightsIndexPage.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"
import DataInsightsNewsletterBanner from "./DataInsightsNewsletterBanner.js"

const Pagination = (props: { pageNumber: number; totalPageCount: number }) => {
    const { pageNumber, totalPageCount } = props
    if (totalPageCount <= 1) return null

    // pageNumber is 0-indexed, even though the page routes are 1-indexed. Also pageNumber === 0 is a special case.
    // e.g. /data-insights, /data-insights/2, /data-insights/3
    const prevTarget =
        pageNumber === 1
            ? "/data-insights"
            : // pageNumber is already "one less" than the page route we're on
              `/data-insights/${pageNumber}`
    const isLeftArrowDisabled = pageNumber === 0

    const nextTarget =
        // pageNumber + 1 is the same as the route we're on, hence pageNumber + 2
        pageNumber < totalPageCount - 1
            ? `/data-insights/${pageNumber + 2}`
            : ""
    const isRightArrowDisabled = pageNumber === totalPageCount - 1

    // Select 5 values around the current page number
    const pageNumbers = getPaginationPageNumbers(pageNumber, totalPageCount)

    return (
        <div className="data-insights-index-page__pagination span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
            <a
                href={prevTarget}
                aria-disabled={isLeftArrowDisabled}
                className={cx("data-insights-index-page__pagination-link", {
                    "data-insights-index-page__pagination-link--disabled":
                        isLeftArrowDisabled,
                })}
            >
                <FontAwesomeIcon icon={faArrowLeft} />
            </a>
            {pageNumbers.map((i) => (
                <a
                    href={`/data-insights${i === 0 ? "" : `/${i + 1}`}`}
                    key={i}
                    className={cx("data-insights-index-page__pagination-link", {
                        "data-insights-index-page__pagination-link--active":
                            i === pageNumber,
                    })}
                >
                    {i + 1}
                </a>
            ))}
            <a
                href={nextTarget}
                aria-disabled={isRightArrowDisabled}
                className={cx("data-insights-index-page__pagination-link", {
                    "data-insights-index-page__pagination-link--disabled":
                        isRightArrowDisabled,
                })}
            >
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
        </div>
    )
}

export const DataInsightsIndexPageContent = (
    props: DataInsightsIndexPageProps
) => {
    const { pageNumber, dataInsights, isPreviewing = false } = props
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
                </header>
                {dataInsights.map((dataInsight, index) => {
                    const id =
                        pageNumber === 0
                            ? dataInsightIndexToIdMap[index]
                            : undefined
                    return (
                        <DataInsightBody
                            key={dataInsight.id}
                            anchor={id}
                            shouldLinkTitle
                            {...dataInsight}
                        />
                    )
                })}
                <Pagination
                    totalPageCount={props.totalPageCount}
                    pageNumber={props.pageNumber}
                />
                <DataInsightsNewsletterBanner />
            </AttachmentsContext.Provider>
        </DocumentContext.Provider>
    )
}

export const _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA =
    "_OWID_DATA_INSIGHTS_INDEX_PAGE_DATA"
