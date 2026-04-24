#!/usr/bin/env node
/**
 * Scaffold a new piece of content: write the file in the content repo and
 * insert a matching posts_gdocs row so the admin preview renders it.
 *
 * Does the minimum to replace the admin's "Add a document" flow when there's
 * no Google Doc. Generates a uuidv7 id (no Google Drive doc backs it),
 * writes a minimal ArchieML scaffold, parses it, and upserts.
 *
 * Templates per type are intentionally thin — richer scaffolds land when we
 * have canonical content-type templates.
 */

import parseArgs from "minimist"
import fs from "fs-extra"
import path from "path"
import { uuidv7 } from "uuidv7"
import {
    DbRawPostGdoc,
    GdocsContentSource,
    OwidGdocType,
    PostsGdocsTableName,
} from "@ourworldindata/types"

import * as db from "../../db/db.js"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"
import { GdocBase } from "../../db/model/Gdoc/GdocBase.js"
import {
    loadGdocFromGdocBase,
    upsertGdoc,
} from "../../db/model/Gdoc/GdocFactory.js"

const DEFAULT_OUTPUT = "/Users/matthieu/Code/owid-grapher-content"
const SHORT_ID_LEN = 12

const SUPPORTED_TYPES = [
    OwidGdocType.Article,
    OwidGdocType.DataInsight,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.Fragment,
] as const
type ContentType = (typeof SUPPORTED_TYPES)[number]

function printHelp(): void {
    console.log(`Scaffold a new content file + posts_gdocs row.

Usage:
    yarn tsx --tsconfig tsconfig.tsx.json devTools/gdocs/create-content.ts --type <type> --slug <slug> [options]

Required:
    --type <type>       One of: ${SUPPORTED_TYPES.join(", ")}
    --slug <slug>       URL-friendly slug (e.g. "my-new-article").

Options:
    --title <title>     Initial title (default: derived from slug).
    --author <name>     Author name (may be repeated). Default: "Your name".
    --output <dir>      Content repo path (default: ${DEFAULT_OUTPUT}).
    -h, --help          Show this message.
`)
}

function safeSlug(slug: string): string {
    return slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "")
}

function titleFromSlug(slug: string): string {
    return slug
        .split("-")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ")
}

function makeScaffold(
    type: ContentType,
    title: string,
    authors: string[]
): string {
    const authorLine = authors.length > 0 ? authors.join(", ") : "Your name"

    // Minimal valid ArchieML per type. Just enough frontmatter for the
    // renderer to pick the right subclass and show an empty body.
    const commonHeader = `title: ${title}\nauthors: ${authorLine}\ntype: ${type}\n`

    switch (type) {
        case OwidGdocType.Article:
            return `${commonHeader}subtitle: \nexcerpt: \n[+body]\n\nStart writing your article here.\n\n[]\n`
        case OwidGdocType.DataInsight:
            return `${commonHeader}approved-by: \n[+body]\n\nStart writing your data insight here.\n\n[]\n`
        case OwidGdocType.TopicPage:
        case OwidGdocType.LinearTopicPage:
            return `${commonHeader}[+body]\n\nStart writing your topic page here.\n\n[]\n`
        case OwidGdocType.Fragment:
            return `title: ${title}\ntype: fragment\n[+body]\n\nStart writing your fragment here.\n\n[]\n`
    }
}

async function main(): Promise<void> {
    const parsed = parseArgs(process.argv.slice(2), {
        boolean: ["help", "h"],
        string: ["type", "slug", "title", "output"],
    })
    if (parsed.h || parsed.help) {
        printHelp()
        return
    }
    const type = parsed.type as ContentType | undefined
    const slugArg = parsed.slug as string | undefined
    if (!type || !SUPPORTED_TYPES.includes(type))
        throw new Error(
            `--type is required and must be one of: ${SUPPORTED_TYPES.join(", ")}`
        )
    if (!slugArg) throw new Error("--slug is required")

    const slug = safeSlug(slugArg)
    const title = parsed.title || titleFromSlug(slug)
    const rawAuthors = parsed.author
    const authors: string[] = Array.isArray(rawAuthors)
        ? rawAuthors
        : rawAuthors
          ? [rawAuthors]
          : []
    const outputDir = path.resolve(parsed.output || DEFAULT_OUTPUT)

    const id = uuidv7()
    const shortId = id.slice(0, SHORT_ID_LEN)
    const filePath = path.join(outputDir, type, `${slug}--${shortId}.md`)
    const scaffoldText = makeScaffold(type, title, authors)

    try {
        await db.knexReadWriteTransaction(async (trx) => {
            // Soft-check: warn (don't block) on slug reuse inside the same type.
            const existing = await trx
                .table<DbRawPostGdoc>(PostsGdocsTableName)
                .select("id")
                .where({ slug, type })
            if (existing.length > 0) {
                console.warn(
                    `Note: another ${type} with slug "${slug}" already exists (id: ${existing[0].id}). Consider picking a different slug.`
                )
            }

            await fs.ensureDir(path.dirname(filePath))
            await fs.writeFile(filePath, scaffoldText)

            const base = new GdocBase(id)
            base.content = archieToEnriched(scaffoldText)
            base.slug = slug
            base.published = false
            base.source = GdocsContentSource.File

            const gdoc = await loadGdocFromGdocBase(trx, base, undefined, false, {
                loadState: false,
            })
            await upsertGdoc(trx, gdoc)

            console.log(`Created ${type}:`)
            console.log(`  id:         ${id}`)
            console.log(`  slug:       ${slug}`)
            console.log(`  file:       ${filePath}`)
            console.log(
                `  preview:    http://localhost:3030/admin/gdocs/${id}/preview`
            )
            console.log(
                `\nEdit the file; refresh the admin preview to see changes (source: file).`
            )
        })
    } finally {
        await db.closeTypeOrmAndKnexConnections()
    }
}

void main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
