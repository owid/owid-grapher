import * as React from "react"
import * as settings from "settings"
import { Head } from "site/server/views/Head"
import { SiteHeader } from "site/server/views/SiteHeader"
import { SiteFooter } from "site/server/views/SiteFooter"

// This page was modeled on ChartPage.
//
// TODO that ChartPage handles but this page doesn't:
// * JS error handling (try-catch if ExploreView.bootstrap fails)
// * noscript handling
// * iframe handling?
//
// -@jasoncrawford 2 Dec 2019

export const ExplorePage = () => {
    const script = `window.ExploreView.bootstrap({ containerNode: document.getElementById('explore'), queryStr: window.location.search }).bindToWindow();`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/explore`}
                pageTitle="Explore"
            ></Head>
            <body className="ExplorePage">
                <SiteHeader />
                <main>
                    <div id="explore"></div>
                </main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
