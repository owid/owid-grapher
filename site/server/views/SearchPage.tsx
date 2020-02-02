import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export const SearchPage = () => {
    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/search`}
                pageTitle="Search"
                pageDesc="Search articles and charts on Our World in Data."
            />
            <body className="SearchPage">
                <SiteHeader />
                <main>
                    <form action="/search" method="GET">
                        <div className="inputWrapper">
                            <input
                                type="search"
                                name="q"
                                placeholder={`Try "Poverty", "Population growth" or "Plastic pollution"`}
                                autoFocus
                            />
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                        <button type="submit">Search</button>
                    </form>
                    <div className="searchResults"></div>
                </main>
                <SiteFooter hideDonate={true} />
                <script>{`window.runSearchPage()`}</script>
            </body>
        </html>
    )
}
