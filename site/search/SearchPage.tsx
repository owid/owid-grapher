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
            <script
                dangerouslySetInnerHTML={{
                    // Structured data for google
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        url: baseUrl,
                        potentialAction: {
                            "@type": "SearchAction",
                            target: `${baseUrl}/search?q={search_term_string}`,
                            "query-input": "required name=search_term_string",
                        },
                    }),
                }}
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
