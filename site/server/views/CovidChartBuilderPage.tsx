import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

export const CovidChartBuilderPage = () => {
    const script = `window.CovidChartBuilder.bootstrap()`

    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/covid-chart-builder`}
                pageTitle="Covid-19 Dashboard"
            ></Head>
            <body>
                <SiteHeader />
                <main id="chartBuilder"></main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
