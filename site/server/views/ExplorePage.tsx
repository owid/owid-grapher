import * as React from "react"
import * as settings from "settings"

import { webpack } from "utils/server/staticGen"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

// This page was modeled on ChartPage.
//
// TODO that ChartPage handles but this page doesn't:
// * JS error handling (try-catch if ExploreView.bootstrap fails)
// * noscript handling
// * iframe handling?
//
// -@jasoncrawford 2 Dec 2019

export const ExplorePage = () => {
    const script = `
        var div = document.getElementById('explore');
        var view = window.ExploreView.bootstrap({ containerNode: div, queryStr: window.location.search });
        view.bindToWindow();
    `

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
