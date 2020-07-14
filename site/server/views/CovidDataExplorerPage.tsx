import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import {
    covidDashboardSlug,
    coronaOpenGraphImagePath,
    covidDataExplorerContainerId,
    covidLastUpdatedPath,
    covidDataPath,
    covidChartAndVariableMetaPath
} from "charts/covidDataExplorer/CovidConstants"
import { LoadingIndicator } from "site/client/LoadingIndicator"
import { SiteSubnavigation } from "./SiteSubnavigation"

export interface CovidDataExplorerPageProps {
    explorerQueryStr?: string
}

export const CovidDataExplorerPage = (props: CovidDataExplorerPageProps) => {
    const iframeScript = `
    if (window != window.top) {
        document.documentElement.classList.add('iframe')
    }
`

    // This script allows us to replace existing Grapher pages with Explorer pages.
    // Part of the reason for doing the redirect client-side is that Netlify doesn't support
    // redirecting while preserving all query parameters.
    const script = `
    var props = {
        containerNode: document.getElementById("${covidDataExplorerContainerId}"),
        queryStr: window.location.search,
        isEmbed: window != window.top
    };
    window.CovidDataExplorer.replaceStateAndBootstrap(
        "${props.explorerQueryStr ?? ""}",
        props
    ).then(function(view) {
        view.bindToWindow();
    })
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
                    href={covidChartAndVariableMetaPath}
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
                <SiteHeader hideAlertBanner={true} />
                <SiteSubnavigation
                    subnavId="coronavirus"
                    subnavCurrentId="data-explorer"
                />
                <main id={covidDataExplorerContainerId}>
                    <LoadingIndicator color="#333" />
                </main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
