import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

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
            <body className="SearchPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <article className="page">
                        <div className="searchWrapper"></div>
                    </article>
                </main>
                <SiteFooter hideDonate={true} baseUrl={baseUrl} />
                <script>{`window.runSearchPage()`}</script>
            </body>
        </html>
    )
}
