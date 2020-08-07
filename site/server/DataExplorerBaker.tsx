#! /usr/bin/env yarn tsn

import * as fs from "fs-extra"
import * as path from "path"
import * as db from "db/db"
import React from "react"
import { SwitcherDataExplorerPage } from "./views/DataExplorerPages"
import { renderToHtmlPage } from "utils/server/serverUtil"
import { SwitcherOptions } from "charts/SwitcherOptions"
import { GIT_CONTENT_DIR, BAKED_SITE_DIR } from "serverSettings"

export const bakeAllPublishedExplorers = async (
    inputFolder = `${GIT_CONTENT_DIR}/explorers/`,
    outputFolder = `${BAKED_SITE_DIR}/explorers/`
) => {
    const dataExplorers = await getAllDataExplorers(inputFolder)
    const published = dataExplorers.filter(exp => exp.isPublished)
    await bakeExplorersToDir(outputFolder, published)
}

// Todo: JSON schema?
interface DataExplorerProgram {
    slug: string
    title: string
    switcherCode: string
    isPublished: boolean
}

const getAllDataExplorers = async (directory: string) => {
    if (!fs.existsSync(directory)) return []
    const files = await fs.readdir(directory)
    const explorerFiles = files.filter(filename =>
        filename.endsWith(".explorer.json")
    )
    const explorers: DataExplorerProgram[] = []
    for (const file of explorerFiles) {
        const content = await fs.readFile(directory + "/" + file, "utf8")
        explorers.push(JSON.parse(content))
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
                explorer.title,
                explorer.switcherCode,
                explorer.slug
            )
        )
    }
}

export const switcherExplorerForm = () =>
    renderToHtmlPage(
        <form method="POST">
            <input type="text" placeholder="Title" name="title" />
            <br />
            <textarea name="code" placeholder="Code"></textarea>
            <br />
            <input type="submit" />
        </form>
    )

export async function renderSwitcherDataExplorerPage(
    title: string,
    switcherCode: string,
    slug: string
) {
    const chartIds = SwitcherOptions.getRequiredChartIds(switcherCode)
    const chartConfigs: any[] = await db.query(
        `SELECT config FROM charts WHERE id IN (?)`,
        [chartIds]
    )

    return renderToHtmlPage(
        <SwitcherDataExplorerPage
            title={title}
            slug={slug}
            switcherCode={switcherCode}
            chartConfigs={chartConfigs.map(row => JSON.parse(row.config))}
        />
    )
}

const main = async () => {
    await bakeAllPublishedExplorers()
    db.end()
}

if (!module.parent) main()
