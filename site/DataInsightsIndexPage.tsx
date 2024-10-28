import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    OwidGdocDataInsightInterface,
    SiteFooterContext,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import {
    DataInsightsIndexPageContent,
    _OWID_DATA_INSIGHTS_INDEX_PAGE_DATA,
} from "./DataInsightsIndexPageContent.js"
import { DATA_INSIGHT_ATOM_FEED_PROPS } from "./SiteConstants.js"
import { DebugProvider } from "./gdocs/DebugContext.js"
import { Html } from "./Html.js"

export interface DataInsightsIndexPageProps {
    dataInsights: OwidGdocDataInsightInterface[]
    baseUrl: string
    pageNumber: number
    totalPageCount: number
    isPreviewing?: boolean
}

export const DataInsightsIndexPage = (props: DataInsightsIndexPageProps) => {
    const { baseUrl, isPreviewing } = props
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/data-insights`}
                pageTitle="Daily Data Insights"
                baseUrl={baseUrl}
                pageDesc="Bite-sized insights on how the world is changing, published every weekday"
                imageUrl={`${baseUrl}/data-insights-thumbnail.png`}
                atom={DATA_INSIGHT_ATOM_FEED_PROPS}
            ></Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main
                    id="data-insights-index-page-container"
                    className="data-insights-index-page grid grid-cols-12-full-width"
                >
                    <DebugProvider debug={isPreviewing}>
                        <DataInsightsIndexPageContent {...props} />
                    </DebugProvider>
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
        </Html>
    )
}
