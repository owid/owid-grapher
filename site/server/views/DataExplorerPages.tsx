import * as React from "react"
import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { LoadingIndicator } from "site/client/LoadingIndicator"
import { EmbedDetector } from "./EmbedDetector"

import {
    covidDashboardSlug,
    coronaOpenGraphImagePath,
    covidPageTitle,
    covidPreloads
} from "charts/covidDataExplorer/CovidConstants"
import { SiteSubnavigation } from "./SiteSubnavigation"
import { ChartConfigProps } from "charts/ChartConfig"

interface DataExplorerPageSettings {
    title: string
    slug: string
    imagePath: string
    preloads: string[]
    inlineJs: string
    hideAlertBanner?: boolean
    subNav?: JSX.Element
}

const DataExplorerPage = (props: DataExplorerPageSettings) => {
    return (
        <html>
            <Head
                canonicalUrl={`${settings.BAKED_BASE_URL}/${props.slug}`}
                pageTitle={props.title}
                imageUrl={`${settings.BAKED_BASE_URL}/${props.imagePath}`}
            >
                <EmbedDetector />
                {props.preloads.map((url: string, index: number) => (
                    <link
                        key={`preload${index}`}
                        rel="preload"
                        href={url}
                        as="fetch"
                        crossOrigin="anonymous"
                    />
                ))}
            </Head>
            <body className="ChartPage">
                <SiteHeader hideAlertBanner={props.hideAlertBanner || false} />
                {props.subNav}
                <main id="dataExplorerContainer">
                    <LoadingIndicator color="#333" />
                </main>
                <SiteFooter />
                <script dangerouslySetInnerHTML={{ __html: props.inlineJs }} />
            </body>
        </html>
    )
}

interface SwitcherDataExplorerPageProps {
    title: string
    slug: string
    switcherCode: string
    chartConfigs: ChartConfigProps[]
}

export const SwitcherDataExplorerPage = (
    props: SwitcherDataExplorerPageProps
) => {
    const script = `const switcherConfig = \`${props.switcherCode}\`;
const chartConfigs = ${JSON.stringify(props.chartConfigs)};
window.SwitcherDataExplorer.bootstrap(document.getElementById("dataExplorerContainer"), chartConfigs, switcherConfig, "${
        props.title
    }")`

    return (
        <DataExplorerPage
            title={props.title}
            slug={props.slug}
            imagePath=""
            preloads={[]}
            inlineJs={script}
        />
    )
}

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
