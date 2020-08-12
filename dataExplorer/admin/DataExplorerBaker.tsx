import * as fs from "fs-extra"
import * as path from "path"
import * as db from "db/db"
import React from "react"
import { renderToHtmlPage } from "utils/server/serverUtil"
import { BAKED_SITE_DIR } from "serverSettings"
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
import { Request, Response } from "admin/server/authentication"

import {
    covidDashboardSlug,
    coronaOpenGraphImagePath,
    covidPageTitle,
    covidPreloads
} from "charts/covidDataExplorer/CovidConstants"
import { SiteSubnavigation } from "site/server/views/SiteSubnavigation"
import { SwitcherBootstrapProps } from "dataExplorer/client/SwitcherDataExplorer"
import { FunctionalRouter } from "admin/server/FunctionalRouter"
import { getChartById } from "db/model/Chart"
import { Router } from "express"
import { GIT_CMS_DIR } from "gitCms/constants"

const storageFolder = `${GIT_CMS_DIR}/explorers/`

export const addExplorerApiRoutes = (app: FunctionalRouter) => {
    // http://localhost:3030/admin/api/explorers.json
    // Download all explorers for the admin index page
    app.get("/explorers.json", async () => {
        const explorers = await getAllDataExplorers()
        return {
            explorers: explorers.map(explorer => {
                return {
                    program: explorer.toString(),
                    slug: explorer.slug
                }
            })
        }
    })

    // Download all chart configs for Explorer create page
    app.get(
        "/charts/explorer-charts.json",
        async (req: Request, res: Response) => {
            const chartIds = req.query.chartIds.split("~")
            const configs = []
            for (const chartId of chartIds) {
                try {
                    configs.push(await getChartById(chartId))
                } catch (err) {
                    console.log(`Error with chartId '${chartId}'`)
                }
            }
            return configs
        }
    )
}

export const addExplorerAdminRoutes = (app: Router) => {
    // http://localhost:3030/admin/explorers/preview/some-slug
    app.get(`/explorers/preview/:slug`, async (req, res) => {
        const code = await getExplorerCodeBySlug(req.params.slug)
        if (code === undefined) res.send(`File not found`)
        res.send(await renderSwitcherDataExplorerPage(req.params.slug, code!))
    })
}

const getExplorerCodeBySlug = async (
    slug: string,
    directory = storageFolder
) => {
    const path = directory + "/" + slug + explorerFileSuffix
    if (!fs.existsSync(path)) return undefined
    return await fs.readFile(path, "utf8")
}

export const bakeAllPublishedExplorers = async (
    inputFolder = storageFolder,
    outputFolder = `${BAKED_SITE_DIR}/explorers/`
) => {
    const dataExplorers = await getAllDataExplorers(inputFolder)
    const published = dataExplorers.filter(exp => exp.isPublished)
    await bakeExplorersToDir(outputFolder, published)
}

const getAllDataExplorers = async (directory = storageFolder) => {
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

async function renderSwitcherDataExplorerPage(slug: string, code: string) {
    const program = new DataExplorerProgram(slug, code)
    const chartConfigs: any[] = await db.query(
        `SELECT config FROM charts WHERE id IN (?)`,
        [program.requiredChartIds]
    )

    const props: SwitcherBootstrapProps = {
        title: program.title || "",
        bindToWindow: true,
        slug,
        switcherCode: program.switcherCode || "",
        chartConfigs: chartConfigs.map(row => JSON.parse(row.config))
    }

    const script = `window.SwitcherDataExplorer.bootstrap(${JSON.stringify(
        props
    )})`

    return renderToHtmlPage(
        <DataExplorerPage
            title={props.title}
            slug={props.slug}
            imagePath=""
            preloads={[]}
            inlineJs={script}
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
