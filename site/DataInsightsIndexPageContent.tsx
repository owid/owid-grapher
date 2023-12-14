import React from "react"
import ReactDOM from "react-dom"
import {
    ImageMetadata,
    LinkedChart,
    OwidGdocPostInterface,
    merge,
} from "@ourworldindata/utils"
import { DataInsightBody, indexToIdMap } from "./gdocs/pages/DataInsight.js"
import { AttachmentsContext, DocumentContext } from "./gdocs/OwidGdoc.js"
import { DataInsightsIndexPageProps } from "./DataInsightsIndexPage.js"

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
                linkedDocuments: {} as Record<string, OwidGdocPostInterface>,
            }
        )
    return (
        <DocumentContext.Provider value={{ isPreviewing }}>
            <AttachmentsContext.Provider
                value={{
                    imageMetadata,
                    linkedCharts,
                    linkedDocuments,
                    relatedCharts: [], // not needed for the index page
                    latestDataInsights: [], // not needed for the index page
                }}
            >
                <header className="data-insights-index-page__header grid grid-cols-12-full-width span-cols-14">
                    <h2 className="span-cols-8 col-start-4 display-2-semibold">
                        Data insights
                    </h2>
                    <p className="span-cols-8 col-start-4 body-1-regular">
                        Bite-sized insights on how the world is changing,
                        written by our team.
                    </p>
                </header>
                {dataInsights.map((dataInsight, index) => {
                    const id =
                        pageNumber === 0 ? indexToIdMap[index] : undefined
                    return (
                        <DataInsightBody
                            key={dataInsight.id}
                            anchor={id}
                            {...dataInsight}
                        />
                    )
                })}
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
