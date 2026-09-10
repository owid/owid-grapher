import { Head } from "./Head.js"
import { Html } from "./Html.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteFooterContext } from "@ourworldindata/types"
import { serializeJSONForInlineScript } from "@ourworldindata/utils"
import {
    __OWID_EXPLORER_INDEX_PAGE_PROPS,
    ExplorerIndex,
    ExplorerIndexProps,
} from "./ExplorerIndex.js"

interface ExplorerIndexPageProps extends ExplorerIndexProps {
    baseUrl: string
}

export const ExplorerIndexPage = ({
    baseUrl,
    items,
}: ExplorerIndexPageProps) => {
    const inlineJs = `window.${__OWID_EXPLORER_INDEX_PAGE_PROPS} = ${serializeJSONForInlineScript(
        { items }
    )}`
    return (
        <Html>
            <Head
                canonicalUrl={`${baseUrl}/${EXPLORERS_ROUTE_FOLDER}`}
                pageTitle="Data Explorers"
                pageDesc="An index of all Our World in Data data explorers."
                baseUrl={baseUrl}
            ></Head>
            <body>
                <SiteHeader />
                <main className="explorer-index-page grid grid-cols-12-full-width">
                    <ExplorerIndex items={items} />
                </main>
                <SiteFooter context={SiteFooterContext.explorerIndexPage} />
                <script dangerouslySetInnerHTML={{ __html: inlineJs }} />
            </body>
        </Html>
    )
}
