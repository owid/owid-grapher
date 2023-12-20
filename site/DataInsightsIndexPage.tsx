import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    IMAGES_DIRECTORY,
    OwidGdocDataInsightInterface,
    SiteFooterContext,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import {
    DataInsightsIndexPageContent,
    _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA,
} from "./DataInsightsIndexPageContent.js"

export interface DataInsightsIndexPageProps {
    dataInsights: OwidGdocDataInsightInterface[]
    baseUrl: string
    pageNumber: number
    totalPageCount: number
    isPreviewing?: boolean
}

export const DataInsightsIndexPage = (props: DataInsightsIndexPageProps) => {
    const { baseUrl } = props
    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/data-insights`}
                pageTitle="Data Insights"
                baseUrl={baseUrl}
                pageDesc="Bite-sized insights on how the world is changing, written by our team"
                imageUrl={`${baseUrl}/data-insights-thumbnail.png`}
            ></Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main
                    id="data-insights-index-page-container"
                    className="data-insights-index-page grid grid-cols-12-full-width"
                >
                    <DataInsightsIndexPageContent {...props} />
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.dataInsightsIndexPage}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window.${_OWID_DATA_INSIGHTS_INDEX_PAGE_DATA} = ${serializeJSONForHTML(
                            props
                        )}`,
                    }}
                />
            </body>
        </html>
    )
}
