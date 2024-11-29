import React from "react"
import { Head } from "./Head.js"
import { Html } from "./Html.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteFooterContext } from "@ourworldindata/types"
import {
    __OWID_EXPLORER_INDEX_PAGE_PROPS,
    ExplorerIndex,
    ExplorerIndexPageProps,
} from "./ExplorerIndex.js"

export const ExplorerIndexPage = ({
    baseUrl,
    explorers,
}: ExplorerIndexPageProps) => {
    const inlineJs = `window.${__OWID_EXPLORER_INDEX_PAGE_PROPS} = ${JSON.stringify(
        {
            baseUrl,
            explorers,
        }
    )}`
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/${EXPLORERS_ROUTE_FOLDER}`}
                pageTitle={`Data Explorers`}
                pageDesc={"An index of all Our World in Data data explorers"}
                baseUrl={baseUrl}
            ></Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main className="explorer-index-page grid grid-cols-12-full-width">
                    <ExplorerIndex baseUrl={baseUrl} explorers={explorers} />
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.explorerIndexPage}
                />
                <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
            </body>
        </Html>
    )
}
