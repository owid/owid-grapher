import React from "react"
import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"

export const SearchPage = (props: { baseUrl: string }) => {
    const { baseUrl } = props
    return (
        <html>
            <Head
                canonicalUrl={`${baseUrl}/search`}
                pageTitle="Search"
                pageDesc="Search articles and charts on Our World in Data."
                baseUrl={baseUrl}
            />
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <main className="search-page-container" />
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
                <script type="module">{`window.runSearchPage()`}</script>
            </body>
        </html>
    )
}
