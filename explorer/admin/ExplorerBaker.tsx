import * as fs from "fs-extra"
import * as path from "path"
import * as db from "db/db"
import React from "react"
import { renderToHtmlPage } from "utils/server/serverUtil"
import { BAKED_SITE_DIR } from "serverSettings"
import {
    EXPLORER_FILE_SUFFIX,
    ExplorerProgram,
} from "explorer/client/ExplorerProgram"
import { Request, Response } from "adminSite/server/utils/authentication"
import { ExplorerProps } from "explorer/client/Explorer"
import { FunctionalRouter } from "adminSite/server/utils/FunctionalRouter"
import { getGrapherById } from "db/model/Chart"
import { Router } from "express"
import { GIT_CMS_DIR } from "gitCms/constants"
import { getBlockContent } from "db/wpdb"
import { ExplorerPage } from "./ExplorerPage"
import moment from "moment"
import {
    getGitBranchNameForDir,
    getLastModifiedTime,
    getShortHash,
} from "gitCms/GitUtils"
import { ExplorersRoute } from "explorer/client/ExplorerConstants"

const EXPLORERS_FOLDER = `${GIT_CMS_DIR}/explorers/`

export const addExplorerApiRoutes = (app: FunctionalRouter) => {
    // http://localhost:3030/admin/api/explorers.json
    // Download all explorers for the admin index page
    app.get(`/${ExplorersRoute}`, async () => {
        const explorers = await getAllExplorers()
        const gitCmsBranchName = await getGitBranchNameForDir(EXPLORERS_FOLDER)
        return {
            gitCmsBranchName,
            explorers: explorers.map((explorer) => explorer.toJson()),
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
                    configs.push(await getGrapherById(chartId))
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
        const shortHash = await getShortHash(EXPLORERS_FOLDER)
        const filename = req.params.slug + EXPLORER_FILE_SUFFIX
        if (!fs.existsSync(EXPLORERS_FOLDER + filename))
            return res.send(`File not found`)
        const explorer = await getExplorerFromFile(
            EXPLORERS_FOLDER,
            filename,
            shortHash
        )
        return res.send(
            await renderExplorerPage(
                explorer.slug,
                explorer.toString(),
                explorer.shortHash ?? ""
            )
        )
    })
}

const getExplorerFromFile = async (
    directory = EXPLORERS_FOLDER,
    filename: string,
    shortHash: string
) => {
    const fullPath = directory + "/" + filename
    const content = await fs.readFile(fullPath, "utf8")
    const lastModified = await getLastModifiedTime(directory, filename)
    return new ExplorerProgram(
        filename.replace(EXPLORER_FILE_SUFFIX, ""),
        content,
        undefined,
        moment.utc(lastModified).unix(),
        shortHash
    )
}

export const bakeAllPublishedExplorers = async (
    inputFolder = EXPLORERS_FOLDER,
    outputFolder = `${BAKED_SITE_DIR}/explorers/`
) => {
    const explorers = await getAllExplorers(inputFolder)
    const published = explorers.filter((exp) => exp.isPublished)
    await bakeExplorersToDir(outputFolder, published)
}

const getAllExplorers = async (directory = EXPLORERS_FOLDER) => {
    if (!fs.existsSync(directory)) return []
    const files = await fs.readdir(directory)
    const explorerFiles = files.filter((filename) =>
        filename.endsWith(EXPLORER_FILE_SUFFIX)
    )
    const shortHash = await getShortHash(directory)
    const explorers: ExplorerProgram[] = []
    for (const filename of explorerFiles) {
        const explorer = await getExplorerFromFile(
            directory,
            filename,
            shortHash
        )

        explorers.push(explorer)
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
            await renderExplorerPage(
                explorer.slug,
                explorer.toString(),
                explorer.shortHash ?? ""
            )
        )
    }
}

// todo: can we remove this sort of thing?
const makeInlineJs = (program: ExplorerProgram, chartConfigs: any[]) => {
    const props: ExplorerProps = {
        bindToWindow: true,
        slug: program.slug,
        shortHash: program.shortHash,
        program: program.toString(),
        chartConfigs: chartConfigs.map((row) => {
            const config = JSON.parse(row.config)
            config.id = row.id // Ensure each grapher has an id
            return config
        }),
    }

    return `window.Explorer.bootstrap(${JSON.stringify(props, null, 2)})`
}

export const renderExplorerPage = async (
    slug: string,
    code: string,
    shortHash: string
) => {
    const program = new ExplorerProgram(
        slug,
        code,
        undefined,
        undefined,
        shortHash
    )
    const { requiredChartIds } = program
    let chartConfigs: any[] = []
    if (requiredChartIds.length)
        chartConfigs = await db.query(
            `SELECT id, config FROM charts WHERE id IN (?)`,
            [requiredChartIds]
        )

    const wpContent = program.wpBlockId
        ? await getBlockContent(program.wpBlockId)
        : undefined

    return renderToHtmlPage(
        <ExplorerPage
            title={program.title ?? ""}
            slug={slug}
            imagePath={program.thumbnail ?? ""}
            subnavId={program.subNavId}
            subnavCurrentId={program.subNavCurrentId}
            preloads={[]}
            inlineJs={makeInlineJs(program, chartConfigs)}
            hideAlertBanner={program.hideAlertBanner}
            wpContent={wpContent}
        />
    )
}
