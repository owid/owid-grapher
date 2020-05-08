import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

export const CovidDataExplorerPage = () => {
    const script = `window.CovidDataExplorer.bootstrap()`

    const iframeScript = `
    if (window != window.top) {
        document.documentElement.classList.add('iframe')
    }
`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/covid-data-explorer`}
                pageTitle="Covid-19 Data Explorer"
            >
                <script dangerouslySetInnerHTML={{ __html: iframeScript }} />
                <link
                    rel="preload"
                    href="https://covid.ourworldindata.org/data/owid-covid-data.csv"
                    as="fetch"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="ChartPage">
                <SiteHeader />
                <main id="covidDataExplorerContainer"></main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
