import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import {
    covidLastUpdatedPath,
    covidDataPath
} from "charts/covidDataExplorer/CovidDataUtils"
import {
    covidDashboardSlug,
    coronaOpenGraphImagePath
} from "charts/covidDataExplorer/CovidConstants"
import { LoadingIndicator } from "site/client/LoadingIndicator"

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
                canonicalUrl={`${settings.BAKED_BASE_URL}/${covidDashboardSlug}`}
                pageTitle="Coronavirus Pandemic Data Explorer"
                imageUrl={`${settings.BAKED_BASE_URL}/${coronaOpenGraphImagePath}`}
            >
                <script dangerouslySetInnerHTML={{ __html: iframeScript }} />
                <link
                    rel="preload"
                    href={covidDataPath}
                    as="fetch"
                    crossOrigin="anonymous"
                />
                <link
                    rel="preload"
                    href={covidLastUpdatedPath}
                    as="fetch"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="ChartPage">
                <SiteHeader />
                <main id="covidDataExplorerContainer">
                    <LoadingIndicator color="#333" />
                </main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
