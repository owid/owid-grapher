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
import { DebugProvider } from "./gdocs/DebugProvider.js"
import { Html } from "./Html.js"

export interface DataInsightsIndexPageProps {
    dataInsights: OwidGdocDataInsightInterface[]
    baseUrl: string
    pageNumber: number
    totalPageCount: number
    isPreviewing?: boolean
    topicTag?: TopicTag
}

export type TopicTag = {
    name: string
    slug: string
}

export const DataInsightsIndexPage = (props: DataInsightsIndexPageProps) => {
    const { baseUrl, isPreviewing } = props
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/data-insights`}
                pageTitle="Data Insights"
                baseUrl={baseUrl}
                pageDesc="Bite-sized insights on how the world is changing, published every few days"
                imageUrl={`${baseUrl}/data-insights-thumbnail.png`}
                atom={DATA_INSIGHT_ATOM_FEED_PROPS}
            ></Head>
            <body>
                <SiteHeader />
                <main
                    id="data-insights-index-page-container"
                    className="data-insights-index-page grid grid-cols-12-full-width"
                >
                    <DebugProvider debug={isPreviewing}>
                        <DataInsightsIndexPageContent {...props} />
                    </DebugProvider>
                </main>
                <SiteFooter context={SiteFooterContext.dataInsightsIndexPage} />
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
