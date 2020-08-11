import * as fs from "fs-extra"
import * as path from "path"
import * as db from "db/db"
import React from "react"
import { renderToHtmlPage } from "utils/server/serverUtil"
import { GIT_CONTENT_DIR, BAKED_SITE_DIR } from "serverSettings"
import {
    explorerFileSuffix,
    DataExplorerProgram
} from "../client/DataExplorerProgram"
import * as settings from "settings"
import { Head } from "site/server/views/Head"
import { SiteHeader } from "site/server/views/SiteHeader"
import { SiteFooter } from "site/server/views/SiteFooter"
import { LoadingIndicator } from "site/client/LoadingIndicator"
import { EmbedDetector } from "site/server/views/EmbedDetector"

import {
    covidDashboardSlug,
    coronaOpenGraphImagePath,
    covidPageTitle,
    covidPreloads
} from "charts/covidDataExplorer/CovidConstants"
import { SiteSubnavigation } from "site/server/views/SiteSubnavigation"
import { ChartConfigProps } from "charts/ChartConfig"
import { SwitcherBootstrapProps } from "dataExplorer/client/SwitcherDataExplorer"

export const bakeAllPublishedExplorers = async (
    inputFolder = `${GIT_CONTENT_DIR}/explorers/`,
    outputFolder = `${BAKED_SITE_DIR}/explorers/`
) => {
    const dataExplorers = await getAllDataExplorers(inputFolder)
    const published = dataExplorers.filter(exp => exp.isPublished)
    await bakeExplorersToDir(outputFolder, published)
}

export const getAllDataExplorers = async (
    directory = `${GIT_CONTENT_DIR}/explorers/`
) => {
    if (!fs.existsSync(directory)) return []
    const files = await fs.readdir(directory)
    const explorerFiles = files.filter(filename =>
        filename.endsWith(explorerFileSuffix)
    )
    const explorers: DataExplorerProgram[] = []
    for (const filename of explorerFiles) {
        const content = await fs.readFile(directory + "/" + filename, "utf8")
        explorers.push(
            new DataExplorerProgram(
                filename.replace(explorerFileSuffix, ""),
                content
            )
        )
    }
    return explorers
}

const write = async (outPath: string, content: string) => {
    await fs.mkdirp(path.dirname(outPath))
    await fs.writeFile(outPath, content)
    console.log(outPath)
}

const bakeExplorersToDir = async (
    directory: string,
    explorers: DataExplorerProgram[] = []
) => {
    for (const explorer of explorers) {
        await write(
            `${directory}/${explorer.slug}.html`,
            await renderSwitcherDataExplorerPage(
                explorer.slug,
                explorer.toString()
            )
        )
    }
}

export const switcherExplorerForm = () =>
    renderToHtmlPage(
        <form method="POST">
            <textarea name="code" placeholder="Code" rows={30}></textarea>
            <br />
            <input type="submit" />
        </form>
    )

export async function renderSwitcherDataExplorerPage(
    slug: string,
    code: string
) {
    const program = new DataExplorerProgram(slug, code)
    const chartConfigs: any[] = await db.query(
        `SELECT config FROM charts WHERE id IN (?)`,
        [program.requiredChartIds]
    )

    return renderToHtmlPage(
        <SwitcherDataExplorerPage
            title={program.title || ""}
            bindToWindow={true}
            slug={slug}
            switcherCode={program.switcherCode || ""}
            chartConfigs={chartConfigs.map(row => JSON.parse(row.config))}
        />
    )
}

export async function renderCovidDataExplorerPage(
    props?: CovidDataExplorerPageProps
) {
    return renderToHtmlPage(<CovidDataExplorerPage {...props} />)
}

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

const SwitcherDataExplorerPage = (props: SwitcherBootstrapProps) => {
    const script = `window.SwitcherDataExplorer.bootstrap(${JSON.stringify(
        props
    )})`

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

interface CovidDataExplorerPageProps {
    explorerQueryStr?: string
}

const CovidDataExplorerPage = (props: CovidDataExplorerPageProps) => {
    // This script allows us to replace existing Grapher pages with Explorer pages.
    // Part of the reason for doing the redirect client-side is that Netlify doesn't support
    // redirecting while preserving all query parameters.
    const script = `
    var props = {
        containerNode: document.getElementById("dataExplorerContainer"),
        queryStr: window.location.search,
        isExplorerPage: true,
        isEmbed: window != window.top,
        bindToWindow: true
    };
    window.CovidDataExplorer.replaceStateAndBootstrap(
        "${props.explorerQueryStr ?? ""}",
        props
    )
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
