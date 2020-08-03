import * as React from "react"
import {
    covidDashboardSlug,
    coronaOpenGraphImagePath,
    covidPageTitle,
    covidPreloads
} from "charts/covidDataExplorer/CovidConstants"
import { SiteSubnavigation } from "./SiteSubnavigation"
import { DataExplorerPage } from "./DataExplorerPage"

export interface CovidDataExplorerPageProps {
    explorerQueryStr?: string
}

export const CovidDataExplorerPage = (props: CovidDataExplorerPageProps) => {
    // This script allows us to replace existing Grapher pages with Explorer pages.
    // Part of the reason for doing the redirect client-side is that Netlify doesn't support
    // redirecting while preserving all query parameters.
    const script = `
    var props = {
        containerNode: document.getElementById("dataExplorerContainer"),
        queryStr: window.location.search,
        isExplorerPage: true,
        isEmbed: window != window.top
    };
    window.CovidDataExplorer.replaceStateAndBootstrap(
        "${props.explorerQueryStr ?? ""}",
        props
    ).then(function(view) {
        view.bindToWindow();
    })
`

    const subNav = (
        <SiteSubnavigation
            subnavId="coronavirus"
            subnavCurrentId="data-explorer"
        />
    )

    return (
        <DataExplorerPage
            subNav={subNav}
            title={covidPageTitle}
            slug={covidDashboardSlug}
            imagePath={coronaOpenGraphImagePath}
            preloads={covidPreloads}
            inlineJs={script}
            hideAlertBanner={true}
        />
    )
}
