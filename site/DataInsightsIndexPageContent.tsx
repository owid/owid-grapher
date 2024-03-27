import React from "react"
import cx from "classnames"
import ReactDOM from "react-dom"
import {
    ImageMetadata,
    LinkedChart,
    OwidGdocMinimalPostInterface,
    merge,
} from "@ourworldindata/utils"
import {
    DataInsightBody,
    dataInsightIndexToIdMap,
} from "./gdocs/pages/DataInsight.js"
import { AttachmentsContext, DocumentContext } from "./gdocs/OwidGdoc.js"
import { DataInsightsIndexPageProps } from "./DataInsightsIndexPage.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowLeft, faArrowRight } from "@fortawesome/free-solid-svg-icons"

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
    const pageNumbers = []
    const start = Math.max(0, pageNumber - 2)
    for (let i = start; i < Math.min(start + 5, totalPageCount); i++) {
        pageNumbers.push(i)
    }

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
    const { imageMetadata, linkedCharts, linkedDocuments } =
        dataInsights.reduce(
            (acc, di) => ({
                imageMetadata: merge(acc.imageMetadata, di.imageMetadata),
                linkedCharts: merge(acc.linkedCharts, di.linkedCharts),
                linkedDocuments: merge(acc.linkedDocuments, di.linkedDocuments),
            }),
            {
                imageMetadata: {} as Record<string, ImageMetadata>,
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
                    linkedCharts,
                    linkedDocuments,
                    linkedIndicators: {}, // not needed for data insights
                    relatedCharts: [], // not needed for the index page
                    latestDataInsights: [], // not needed for the index page
                }}
            >
                <header className="data-insights-index-page__header grid grid-cols-12-full-width span-cols-14">
                    <h2 className="span-cols-8 col-start-4 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12 display-2-semibold ">
                        Data Insights
                    </h2>
                    <p className="span-cols-8 col-start-4 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12 body-1-regular">
                        Bite-sized insights on how the world is changing,
                        written by our team.
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
                            {...dataInsight}
                        />
                    )
                })}
                <Pagination
                    totalPageCount={props.totalPageCount}
                    pageNumber={props.pageNumber}
                />
            </AttachmentsContext.Provider>
        </DocumentContext.Provider>
    )
}

export const _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA =
    "_OWID_DATA_INSIGHTS_INDEX_PAGE_DATA"

export function hydrateDataInsightsIndexPage() {
    const props = (window as any)[_OWID_DATA_INSIGHTS_INDEX_PAGE_DATA]
    const container = document.querySelector(
        `#data-insights-index-page-container`
    )

    if (container && props) {
        ReactDOM.hydrate(<DataInsightsIndexPageContent {...props} />, container)
    }
}
