import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteFooterContext, TagGraphRoot } from "@ourworldindata/utils"
import { DataCatalog } from "./DataCatalog.js"

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
        <html>
            <Head
                canonicalUrl={`${baseUrl}/charts`}
                pageTitle="Charts"
                pageDesc="All of the interactive charts on Our World in Data."
                baseUrl={baseUrl}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_TAG_GRAPH = ${JSON.stringify(
                            tagGraph
                        )}`,
                    }}
                ></script>
            </Head>
            <body className="ChartsIndexPage">
                <SiteHeader baseUrl={baseUrl} hideDonationFlag />
                <main
                    id="charts-index-page-root"
                    className="grid grid-cols-12-full-width"
                >
                    <DataCatalog tagGraph={tagGraph} />
                </main>
                <SiteFooter
                    context={SiteFooterContext.chartsPage}
                    baseUrl={baseUrl}
                    hideDonationFlag
                />
            </body>
        </html>
    )
}
