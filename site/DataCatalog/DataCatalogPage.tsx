import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, TagGraphRoot } from "@ourworldindata/utils"
import { DataCatalogInstantSearchWrapper } from "./DataCatalog.js"
import { Html } from "../Html.js"

declare global {
    interface Window {
        _OWID_TAG_GRAPH: TagGraphRoot
    }
}

export const DataCatalogPage = (props: {
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
            <body className="DataCatalogPage">
                <SiteHeader />
                <main
                    id="data-catalog-page-root"
                    className="grid grid-cols-12-full-width"
                >
                    <DataCatalogInstantSearchWrapper tagGraph={tagGraph} />
                </main>
                <SiteFooter context={SiteFooterContext.dataCatalogPage} />
            </body>
        </Html>
    )
}
