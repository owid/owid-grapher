import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, TagGraphRoot } from "@ourworldindata/utils"
import { SearchWrapper } from "./SearchWrapper.js"
import { Html } from "../Html.js"

declare global {
    interface Window {
        _OWID_TOPIC_TAG_GRAPH: TagGraphRoot
    }
}

export const SearchPage = (props: {
    baseUrl: string
    topicTagGraph: TagGraphRoot
}) => {
    const { baseUrl, topicTagGraph } = props

    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/data`}
                pageTitle="Data Catalog"
                pageDesc="Explore Our World in Data's extensive collection of charts. Use the search bar to find specific data visualizations or browse by topic. Filter by country or subject area to discover insights on global issues supported by reliable data."
                baseUrl={baseUrl}
                imageUrl={`${baseUrl}/data-catalog-thumbnail.png`}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TOPIC_TAG_GRAPH = ${JSON.stringify(
                            topicTagGraph
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader />
                <main
                    id="search-page-root"
                    className="grid grid-cols-12-full-width"
                >
                    <SearchWrapper topicTagGraph={topicTagGraph} />
                </main>
                <SiteFooter context={SiteFooterContext.searchPage} />
            </body>
        </Html>
    )
}
