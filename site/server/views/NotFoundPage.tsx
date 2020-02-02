import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export const NotFoundPage = () => {
    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/search`}
                pageTitle="404 Not Found"
                pageDesc="Search articles and charts on Our World in Data."
            />
            <body className="NotFoundPage">
                <SiteHeader />
                <main>
                    <h1>Sorry, that page doesn’t exist!</h1>
                    <p>
                        You can search below or{" "}
                        <a href="/">return to the homepage</a>.
                    </p>
                    <form action="/search" method="GET">
                        <div className="inputWrapper">
                            <input
                                id="search_q"
                                type="search"
                                name="q"
                                autoFocus
                            />
                            <FontAwesomeIcon icon={faSearch} />
                        </div>
                        <button className="btn" type="submit">
                            Search
                        </button>
                    </form>
                </main>
                <SiteFooter hideDonate={true} />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                window.runNotFoundPage()
            `
                    }}
                />
            </body>
        </html>
    )
}
