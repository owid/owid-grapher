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
import { Request } from "adminSite/server/utils/authentication"
import { ExplorerProps } from "explorer/client/Explorer"
import { FunctionalRouter } from "adminSite/server/utils/FunctionalRouter"
import { getGrapherById } from "db/model/Chart"
import { Router } from "express"
import { GIT_CMS_DIR } from "gitCms/GitCmsConstants"
import { getBlockContent } from "db/wpdb"
import { ExplorerPage } from "./ExplorerPage"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    EXPLORERS_PREVIEW_ROUTE,
    ExplorersRoute,
    EXPLORERS_ROUTE_FOLDER,
    ExplorersRouteGrapherConfigs,
    ExplorersRouteQueryParam,
    ExplorersRouteResponse,
} from "explorer/client/ExplorerConstants"
import simpleGit from "simple-git"
import { GitCommit } from "gitCms/GitTypes"
import { slugify } from "grapher/utils/Util"

const git = simpleGit({
    baseDir: GIT_CMS_DIR,
    binary: "git",
    maxConcurrentProcesses: 1,
})

const EXPLORERS_FOLDER = `${GIT_CMS_DIR}/${EXPLORERS_GIT_CMS_FOLDER}/`

export const addExplorerApiRoutes = (app: FunctionalRouter) => {
    // Add `table http://localhost:3030/admin/api/errorTest.csv?code=404` to test fetch download failures
    app.get("/errorTest.csv", async (req, res) => {
        const code =
            req.query.code && !isNaN(parseInt(req.query.code))
                ? req.query.code
                : 400
        res.status(code)

        return `Simulating code ${code}`
    })

    // http://localhost:3030/admin/api/explorers.json
    // Download all explorers for the admin index page
    app.get(`/${ExplorersRoute}`, async () => {
        try {
            const explorers = await getAllExplorers()
            const branches = await git.branchLocal()
            const gitCmsBranchName = await branches.current
            const needsPull = false // todo: add

            return {
                success: true,
                gitCmsBranchName,
                needsPull,
                explorers: explorers.map((explorer) => explorer.toJson()),
            } as ExplorersRouteResponse
        } catch (err) {
            console.log(err)
            return {
                success: false,
                errorMessage: err,
            } as ExplorersRouteResponse
        }
    })

    // Download all chart configs for Explorer create page
    app.get(`/${ExplorersRouteGrapherConfigs}`, async (req: Request) => {
        const grapherIds = req.query[ExplorersRouteQueryParam].split("~")
        const configs = []
        for (const grapherId of grapherIds) {
            try {
                configs.push(await getGrapherById(grapherId))
            } catch (err) {
                console.log(`Error with grapherId '${grapherId}'`)
            }
        }
        return configs
    })
}

export const addExplorerAdminRoutes = (app: Router) => {
    // i.e. http://localhost:3030/admin/explorers/preview/some-slug
    app.get(`/${EXPLORERS_PREVIEW_ROUTE}/:slug`, async (req, res) => {
        const slug = slugify(req.params.slug)
        const filename = slug + EXPLORER_FILE_SUFFIX
        if (!slug || !fs.existsSync(EXPLORERS_FOLDER + filename))
            return res.send(`File not found`)
        const explorer = await getExplorerFromFile(EXPLORERS_FOLDER, filename)
        return res.send(
            await renderExplorerPage(
                explorer.slug,
                explorer.toString(),
                explorer.lastCommit
            )
        )
    })
}

const getExplorerFromFile = async (
    directory = EXPLORERS_FOLDER,
    filename: string
) => {
    const fullPath = directory + "/" + filename
    const content = await fs.readFile(fullPath, "utf8")
    const commits = await git.log({ file: fullPath, n: 1 })
    return new ExplorerProgram(
        filename.replace(EXPLORER_FILE_SUFFIX, ""),
        content,
        commits.latest as GitCommit
    )
}

export const bakeAllPublishedExplorers = async (
    inputFolder = EXPLORERS_FOLDER,
    outputFolder = `${BAKED_SITE_DIR}/${EXPLORERS_ROUTE_FOLDER}/`
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

    const explorers: ExplorerProgram[] = []
    for (const filename of explorerFiles) {
        const explorer = await getExplorerFromFile(directory, filename)

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
                explorer.lastCommit
            )
        )
    }
}

// todo: can we remove this sort of thing?
const makeInlineJs = (program: ExplorerProgram, grapherConfigs: any[]) => {
    const props: ExplorerProps = {
        bindToWindow: true,
        slug: program.slug,
        lastCommit: program.lastCommit,
        program: program.toString(),
        grapherConfigs: grapherConfigs.map((row) => {
            const config = JSON.parse(row.config)
            config.id = row.id // Ensure each grapher has an id
            return config
        }),
    }

    return `window.Explorer.renderSingleExplorerOnExplorerPage(${JSON.stringify(
        props,
        null,
        2
    )})`
}

export const renderExplorerPage = async (
    slug: string,
    code: string,
    lastCommit?: GitCommit
) => {
    const program = new ExplorerProgram(slug, code, lastCommit)
    const { requiredGrapherIds } = program
    let grapherConfigs: any[] = []
    if (requiredGrapherIds.length)
        grapherConfigs = await db.query(
            `SELECT id, config FROM charts WHERE id IN (?)`,
            [requiredGrapherIds]
        )

    const wpContent = program.wpBlockId
        ? await getBlockContent(program.wpBlockId)
        : undefined

    return renderToHtmlPage(
        <ExplorerPage
            title={program.explorerTitle ?? ""}
            slug={slug}
            imagePath={program.thumbnail ?? ""}
            subnavId={program.subNavId}
            subnavCurrentId={program.subNavCurrentId}
            preloads={[]}
            inlineJs={makeInlineJs(program, grapherConfigs)}
            hideAlertBanner={program.hideAlertBanner}
            wpContent={wpContent}
        />
    )
}
