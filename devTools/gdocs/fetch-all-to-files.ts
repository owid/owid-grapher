#!/usr/bin/env node
/**
 * Fetch gdocs from posts_gdocs and write the ArchieML content to files.
 * Migrates each exported row to source='file' — i.e. the exported file is now
 * the source of truth, and subsequent admin fetches read from disk.
 *
 *     <output>/<type>/<slug>--<short-id>.md
 *
 * No frontmatter, no link rewriting — just the content.
 */

import parseArgs from "minimist"
import fs from "fs-extra"
import path from "path"
import pMap from "p-map"
import { docs as googleDocs } from "@googleapis/docs"
import { GdocsContentSource, PostsGdocsTableName } from "@ourworldindata/types"

import * as db from "../../db/db.js"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"

const DEFAULT_OUTPUT = "/Users/matthieu/Code/owid-grapher-content"
const SHORT_ID_LEN = 12
const DEFAULT_CONCURRENCY = 4

type GdocMeta = {
    id: string
    slug: string | null
    type: string | null
    source: string | null
}

function printHelp(): void {
    console.log(`Fetch gdocs from posts_gdocs and write ArchieML to files.

Usage:
    yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocs/fetch-all-to-files.ts [options]

Options:
    --output <dir>      Output dir (default: ${DEFAULT_OUTPUT}).
    --dry-run           Don't write files.
    --force             Re-export rows already marked source='file' and overwrite existing files.
    --type <type>       Only gdocs of this type (article, data-insight, ...).
    --id <gdocId>       Only this gdoc.
    --concurrency <n>   Parallel API requests (default: ${DEFAULT_CONCURRENCY}).
    -h, --help          Show this message.
`)
}

function safeSlug(slug: string): string {
    return slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
}

function getFilePath(outputDir: string, meta: GdocMeta): string {
    const shortId = meta.id.slice(0, SHORT_ID_LEN)
    const slugPart = meta.slug ? safeSlug(meta.slug) : "untitled"
    const typeDir = meta.type || "unknown"
    return path.join(outputDir, typeDir, `${slugPart}--${shortId}.md`)
}

async function main(): Promise<void> {
    const parsed = parseArgs(process.argv.slice(2), {
        boolean: ["dry-run", "force", "help", "h"],
        string: ["output", "type", "id"],
    })
    if (parsed.h || parsed.help) {
        printHelp()
        return
    }
    const output = path.resolve(parsed.output ?? DEFAULT_OUTPUT)
    const dryRun = !!parsed["dry-run"]
    const force = !!parsed.force
    const concurrency = Number(parsed.concurrency ?? DEFAULT_CONCURRENCY)
    if (!Number.isFinite(concurrency) || concurrency <= 0)
        throw new Error("--concurrency must be a positive number")

    const knex = db.knexInstance()
    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docs = googleDocs({ version: "v1", auth })

    try {
        let metas: GdocMeta[] = await knex
            .table<GdocMeta>("posts_gdocs")
            .select("id", "slug", "type", "source")

        if (parsed.type) metas = metas.filter((m) => m.type === parsed.type)
        if (parsed.id) metas = metas.filter((m) => m.id === parsed.id)
        if (!force)
            metas = metas.filter((m) => m.source !== GdocsContentSource.File)

        console.log(
            `${metas.length} gdocs -> ${output}${dryRun ? " (dry-run)" : ""}`
        )

        let ok = 0
        let failed = 0

        await pMap(
            metas,
            async (meta, idx) => {
                const label = `${meta.type ?? "?"}/${meta.slug ?? "(no-slug)"}`
                try {
                    const filePath = getFilePath(output, meta)
                    if (!force && !dryRun && (await fs.pathExists(filePath))) {
                        failed++
                        console.error(
                            `[${idx + 1}/${metas.length}] ${label} FAILED: output file already exists at ${filePath}. Re-run with --force to overwrite.`
                        )
                        return
                    }
                    const response = await docs.documents.get({
                        documentId: meta.id,
                        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
                    })
                    const { text } = await gdocToArchie(response.data)
                    if (!dryRun) {
                        await fs.ensureDir(path.dirname(filePath))
                        await fs.writeFile(filePath, text)
                        await knex
                            .table(PostsGdocsTableName)
                            .where({ id: meta.id })
                            .update({ source: GdocsContentSource.File })
                    }
                    ok++
                    console.log(
                        `${dryRun ? "[dry] " : ""}[${idx + 1}/${metas.length}] ${label}`
                    )
                } catch (err) {
                    failed++
                    console.error(
                        `[${idx + 1}/${metas.length}] ${label} FAILED: ${(err as Error).message ?? err}`
                    )
                }
            },
            { concurrency }
        )

        console.log(`\nDone. ${ok} exported, ${failed} failed.`)
    } finally {
        await db.closeTypeOrmAndKnexConnections()
    }
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
