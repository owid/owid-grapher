import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, TagGraphRoot } from "@ourworldindata/utils"
import { SearchInstantSearchWrapper } from "./SearchInstantSearchWrapper.js"
import { Html } from "../Html.js"

declare global {
    interface Window {
        _OWID_TAG_GRAPH: TagGraphRoot
    }
}

export const SearchPage = (props: {
    baseUrl: string
    tagGraph: TagGraphRoot
}) => {
    const { baseUrl, tagGraph } = props

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
                        __html: `window._OWID_TAG_GRAPH = ${JSON.stringify(
                            tagGraph
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
                    <SearchInstantSearchWrapper tagGraph={tagGraph} />
                </main>
                <SiteFooter context={SiteFooterContext.searchPage} />
            </body>
        </Html>
    )
}
