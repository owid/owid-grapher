import fs from "fs-extra"
import path from "path"
import {
    ExplorerProgram,
    explorerUrlMigrationsById,
} from "@ourworldindata/explorer"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { explorerRedirectTable } from "../explorerAdminServer/ExplorerRedirects.js"
import { renderExplorerPage } from "./siteRenderers.js"
import * as db from "../db/db.js"
import { stringify } from "safe-stable-stringify"
import { ExplorerArchivalManifest } from "../serverUtils/archivalUtils.js"
import { ArchiveMetaInformation } from "@ourworldindata/types"
import { getLatestExplorerArchivedVersionsIfEnabled } from "../db/model/archival/archivalDb.js"

export const bakeAllPublishedExplorers = async (
    outputFolder: string,
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    // remove all existing explorers, since we're re-baking every single one anyway
    await fs.remove(outputFolder)
    await fs.mkdirp(outputFolder)

    const published = await explorerAdminServer.getAllPublishedExplorers(knex)
    await bakeExplorersToDir(outputFolder, published, knex)
}

const bakeExplorersToDir = async (
    directory: string,
    explorers: ExplorerProgram[] = [],
    knex: db.KnexReadonlyTransaction
) => {
    const latestArchivedBySlug =
        await getLatestExplorerArchivedVersionsIfEnabled(
            knex,
            explorers.map((e) => e.slug)
        )

    for (const explorer of explorers) {
        await write(
            `${directory}/${explorer.slug}.html`,
            await renderExplorerPage(explorer, knex, {
                archivedChartInfo: latestArchivedBySlug[explorer.slug],
            })
        )
    }
}

export const bakeAllExplorerRedirects = async (
    outputFolder: string,
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    const explorers = await explorerAdminServer.getAllExplorers(knex)
    const redirects = explorerRedirectTable.rows
    for (const redirect of redirects) {
        const { migrationId, path: redirectPath, baseQueryStr } = redirect
        const transform = explorerUrlMigrationsById[migrationId]
        if (!transform) {
            throw new Error(
                `No explorer URL migration with id '${migrationId}'. Fix the list of explorer redirects and retry.`
            )
        }
        const { explorerSlug } = transform
        const program = explorers.find(
            (program) => program.slug === explorerSlug
        )
        if (!program) {
            throw new Error(
                `No explorer with slug '${explorerSlug}'. Fix the list of explorer redirects and retry.`
            )
        }
        const html = await renderExplorerPage(program, knex, {
            urlMigrationSpec: {
                explorerUrlMigrationId: migrationId,
                baseQueryStr,
            },
        })
        await write(path.join(outputFolder, `${redirectPath}.html`), html)
    }
}

// todo: merge with SiteBaker's?
const write = async (outPath: string, content: string) => {
    await fs.mkdirp(path.dirname(outPath))
    await fs.writeFile(outPath, content)
    console.log(outPath)
}

export const bakeSingleExplorerPageForArchival = async (
    bakedSiteDir: string,
    program: ExplorerProgram,
    knex: db.KnexReadonlyTransaction,
    {
        manifest,
        archiveInfo,
    }: {
        manifest: ExplorerArchivalManifest
        archiveInfo: ArchiveMetaInformation
    }
) => {
    const outPathHtml = `${bakedSiteDir}/explorers/${program.slug}.html`
    await fs.writeFile(
        outPathHtml,
        await renderExplorerPage(program, knex, {
            archivedChartInfo: archiveInfo,
        })
    )
    const outPathManifest = `${bakedSiteDir}/explorers/${program.slug}.manifest.json`
    await fs.writeFile(outPathManifest, stringify(manifest, undefined, 2))
}
