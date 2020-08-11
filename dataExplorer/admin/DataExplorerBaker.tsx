import * as fs from "fs-extra"
import * as path from "path"
import * as db from "db/db"
import React from "react"
import { SwitcherDataExplorerPage } from "dataExplorer/client/DataExplorerPages"
import { renderToHtmlPage } from "utils/server/serverUtil"
import { GIT_CONTENT_DIR, BAKED_SITE_DIR } from "serverSettings"
import {
    explorerFileSuffix,
    DataExplorerProgram
} from "../client/DataExplorerProgram"

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
            slug={slug}
            switcherCode={program.switcherCode || ""}
            chartConfigs={chartConfigs.map(row => JSON.parse(row.config))}
        />
    )
}
