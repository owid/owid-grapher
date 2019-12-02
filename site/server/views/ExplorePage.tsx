import * as React from "react"
import * as settings from "settings"

import { webpack } from "utils/server/staticGen"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

export const ExplorePage = () => {
    const script = `
        var div = document.getElementById('explore');
        window.ExploreView.bootstrap({ containerNode: div });
    `

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/explore`}
                pageTitle="Explore"
            >
                <link rel="stylesheet" href={webpack("commons.css")} />
            </Head>
            <body className="ExplorePage">
                <SiteHeader />
                <main>
                    <div id="explore">
                    </div>
                </main>
                <script src="https://cdn.polyfill.io/v2/polyfill.min.js?features=es6,fetch" />
                <script src={webpack("commons.js")} />
                <script src={webpack("owid.js")} />
                <script dangerouslySetInnerHTML={{ __html: script }} />
                <SiteFooter />
            </body>
        </html>
    )
}
