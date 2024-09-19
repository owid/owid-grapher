import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, TagGraphRoot } from "@ourworldindata/utils"
import { DataCatalogInstantSearchWrapper } from "./DataCatalog.js"

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
                pageTitle="Data Catalog"
                pageDesc="A searchable database of all our charts."
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
            <body className="DataCatalogPage">
                <SiteHeader baseUrl={baseUrl} hideDonationFlag />
                <main
                    id="data-catalog-page-root"
                    className="grid grid-cols-12-full-width"
                >
                    <DataCatalogInstantSearchWrapper tagGraph={tagGraph} />
                </main>
                <SiteFooter
                    context={SiteFooterContext.dataCatalogPage}
                    baseUrl={baseUrl}
                    hideDonationFlag
                />
            </body>
        </html>
    )
}
