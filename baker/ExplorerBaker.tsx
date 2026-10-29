import { traceJob } from "../serverUtils/sentryTracing.js"
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
import { getLatestArchivedExplorerPageVersionsIfEnabled } from "../db/model/ArchivedExplorerVersion.js"

export const bakeAllPublishedExplorers = async (
    outputFolder: string,
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    // Remove the existing explorer pages, so that unpublished ones disappear.
    // Only the HTML, since other bake steps write artifacts into this folder
    // (e.g. _explorerRedirects.json) that we must not delete.
    await traceJob("cleanup-explorer-pages", () =>
        removeBakedExplorerPages(outputFolder)
    )

    const published = await traceJob("load-explorer-pages", () =>
        explorerAdminServer.getAllPublishedExplorers(knex)
    )
    await bakeExplorersToDir(outputFolder, published, knex)
}

export const removeBakedExplorerPages = async (outputFolder: string) => {
    await fs.mkdirp(outputFolder)
    const entries = await fs.readdir(outputFolder, { withFileTypes: true })
    const pages = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith(".html")
    )
    await Promise.all(
        pages.map((page) => fs.unlink(path.join(outputFolder, page.name)))
    )
}

const bakeExplorersToDir = async (
    directory: string,
    explorers: ExplorerProgram[] = [],
    knex: db.KnexReadonlyTransaction
) => {
    const { latestArchivedBySlug } = await traceJob(
        "prepare-explorer-pages",
        async () => {
            const latestArchivedBySlug =
                await getLatestArchivedExplorerPageVersionsIfEnabled(
                    knex,
                    explorers.map((e) => e.slug)
                )
            return { latestArchivedBySlug }
        }
    )

    for (const explorer of explorers) {
        await traceJob(
            "bake-explorer-page",
            async () => {
                await write(
                    `${directory}/${explorer.slug}.html`,
                    await renderExplorerPage(explorer, knex, {
                        archiveContext: latestArchivedBySlug[explorer.slug],
                    })
                )
            },
            { "page.slug": explorer.slug }
        )
    }
}

export const bakeAllExplorerRedirects = async (
    outputFolder: string,
    explorerAdminServer: ExplorerAdminServer,
    knex: db.KnexReadonlyTransaction
) => {
    const { explorers, redirects } = await traceJob(
        "prepare-explorer-redirects",
        async () => {
            const explorers = await explorerAdminServer.getAllExplorers(knex)
            const redirects = explorerRedirectTable.rows
            return { explorers, redirects }
        }
    )

    for (const redirect of redirects) {
        await traceJob(
            "bake-explorer-redirect-page",
            async () => {
                const {
                    migrationId,
                    path: redirectPath,
                    baseQueryStr,
                } = redirect
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
                await write(
                    path.join(outputFolder, `${redirectPath}.html`),
                    html
                )
            },
            { "page.slug": redirect.path }
        )
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
            archiveContext: archiveInfo,
        })
    )
    const outPathManifest = `${bakedSiteDir}/explorers/${program.slug}.manifest.json`
    await fs.writeFile(outPathManifest, stringify(manifest, undefined, 2))
}
