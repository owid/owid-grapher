import * as fs from "fs-extra"
import * as path from "path"
import * as db from "db/db"
import React from "react"
import { renderToHtmlPage } from "utils/server/serverUtil"
import { BAKED_SITE_DIR } from "serverSettings"
import {
    explorerFileSuffix,
    ExplorerProgram,
} from "explorer/client/ExplorerProgram"
import { Request, Response } from "adminSite/server/utils/authentication"

import {
    covidDashboardSlug,
    coronaOpenGraphImagePath,
    covidPageTitle,
    covidPreloads,
    covidWpBlockId,
} from "explorer/covidExplorer/CovidConstants"

import { SwitcherBootstrapProps } from "explorer/client/SwitcherExplorer"
import { FunctionalRouter } from "adminSite/server/utils/FunctionalRouter"
import { getChartById } from "db/model/Chart"
import { Router } from "express"
import { GIT_CMS_DIR } from "gitCms/constants"
import { getBlockContent } from "db/wpdb"
import { ExplorerPage } from "./ExplorerPage"

const storageFolder = `${GIT_CMS_DIR}/explorers/`

export const addExplorerApiRoutes = (app: FunctionalRouter) => {
    // http://localhost:3030/admin/api/explorers.json
    // Download all explorers for the admin index page
    app.get("/explorers.json", async () => {
        const explorers = await getAllExplorers()
        return {
            explorers: explorers.map((explorer) => {
                return {
                    program: explorer.toString(),
                    slug: explorer.slug,
                }
            }),
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
        res.send(await renderSwitcherExplorerPage(req.params.slug, code!))
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
    const explorers = await getAllExplorers(inputFolder)
    const published = explorers.filter((exp) => exp.isPublished)
    await bakeExplorersToDir(outputFolder, published)
}

const getAllExplorers = async (directory = storageFolder) => {
    if (!fs.existsSync(directory)) return []
    const files = await fs.readdir(directory)
    const explorerFiles = files.filter((filename) =>
        filename.endsWith(explorerFileSuffix)
    )
    const explorers: ExplorerProgram[] = []
    for (const filename of explorerFiles) {
        const content = await fs.readFile(directory + "/" + filename, "utf8")
        explorers.push(
            new ExplorerProgram(
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
    explorers: ExplorerProgram[] = []
) => {
    for (const explorer of explorers) {
        await write(
            `${directory}/${explorer.slug}.html`,
            await renderSwitcherExplorerPage(explorer.slug, explorer.toString())
        )
    }
}

async function renderSwitcherExplorerPage(slug: string, code: string) {
    const program = new ExplorerProgram(slug, code)
    const chartConfigs: any[] = await db.query(
        `SELECT id, config FROM charts WHERE id IN (?)`,
        [program.requiredChartIds]
    )

    const props: SwitcherBootstrapProps = {
        bindToWindow: true,
        slug,
        explorerProgramCode: program.toString(),
        chartConfigs: chartConfigs.map((row) => {
            const config = JSON.parse(row.config)
            config.id = row.id
            return config
        }),
    }

    const script = `window.SwitcherExplorer.bootstrap(${JSON.stringify(props)})`

    const wpContent = program.wpBlockId
        ? await getBlockContent(program.wpBlockId)
        : undefined

    return renderToHtmlPage(
        <ExplorerPage
            title={program.title || ""}
            slug={props.slug}
            imagePath={program.thumbnail || ""}
            subnavId={program.subNavId}
            subnavCurrentId={program.subNavCurrentId}
            preloads={[]}
            inlineJs={script}
            wpContent={wpContent}
        />
    )
}

export async function renderCovidExplorerPage(props?: CovidExplorerPageProps) {
    const wpContent = await getBlockContent(covidWpBlockId)
    return renderToHtmlPage(
        <CovidExplorerPage {...props} wpContent={wpContent} />
    )
}

interface CovidExplorerPageProps {
    explorerQueryStr?: string
    wpContent?: string
}

const CovidExplorerPage = (props: CovidExplorerPageProps) => {
    // This script allows us to replace existing Grapher pages with Explorer pages.
    // Part of the reason for doing the redirect client-side is that Netlify doesn't support
    // redirecting while preserving all query parameters.
    const script = `
    var props = {
        containerNode: document.getElementById("explorerContainer"),
        queryStr: window.location.search,
        isEmbed: window != window.top,
        bindToWindow: true
    };
    window.CovidExplorer.replaceStateAndBootstrap(
        "${props.explorerQueryStr ?? ""}",
        props
    )
`

    return (
        <ExplorerPage
            subnavId="coronavirus"
            subnavCurrentId="data-explorer"
            title={covidPageTitle}
            slug={covidDashboardSlug}
            imagePath={coronaOpenGraphImagePath}
            preloads={covidPreloads}
            inlineJs={script}
            hideAlertBanner={true}
            wpContent={props.wpContent}
        />
    )
}
