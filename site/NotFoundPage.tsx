import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

export const NotFoundPage = (props: { baseUrl: string }) => {
    return (
        <html>
            <Head
                canonicalUrl={`${props.baseUrl}/search`}
                pageTitle="404 Not Found"
                pageDesc="Search articles and charts on Our World in Data."
                baseUrl={props.baseUrl}
            />
            <body className="NotFoundPage">
                <SiteHeader baseUrl={props.baseUrl} />
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
                <SiteFooter hideDonate={true} baseUrl={props.baseUrl} />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: `
                window.runNotFoundPage()
            `,
                    }}
                />
            </body>
        </html>
    )
}
