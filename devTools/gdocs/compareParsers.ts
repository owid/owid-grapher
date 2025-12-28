#! /usr/bin/env node

import parseArgs from "minimist"
import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import { diffLines } from "diff"
import {
    OwidGdocType,
    type OwidGdocPostContent,
    type OwidGdocErrorMessage,
} from "@ourworldindata/types"
import { traverseEnrichedBlock } from "@ourworldindata/utils"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"
import { gdocAstToEnriched } from "../../db/model/Gdoc/gdocAstToEnriched.js"
import { enrichedBlocksToMarkdown } from "../../db/model/Gdoc/enrichedToMarkdown.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GdocAbout } from "../../db/model/Gdoc/GdocAbout.js"
import { GdocAuthor } from "../../db/model/Gdoc/GdocAuthor.js"
import { GdocHomepage } from "../../db/model/Gdoc/GdocHomepage.js"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"

const DEFAULT_LIMIT = 5
const DEFAULT_VIEW_COLUMN = "views_365d"

interface PageRow {
    id: string
    slug: string
    type: OwidGdocType
}

interface ParserResult {
    content: OwidGdocPostContent
    markdown: string
    parseErrors: string[]
    refErrors: string[]
}

function getEnricher(
    row: PageRow
): (content: Record<string, unknown>) => void {
    const type = row.type
    if (
        type === OwidGdocType.Article ||
        type === OwidGdocType.LinearTopicPage ||
        type === OwidGdocType.TopicPage ||
        type === OwidGdocType.Fragment
    ) {
        const gdoc = new GdocPost(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.AboutPage) {
        const gdoc = new GdocAbout(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.Author) {
        const gdoc = new GdocAuthor(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.Homepage) {
        const gdoc = new GdocHomepage(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.Announcement) {
        const gdoc = new GdocAnnouncement(row.id)
        return gdoc._enrichSubclassContent
    }
    if (type === OwidGdocType.DataInsight) {
        const gdoc = new GdocDataInsight(row.id)
        return gdoc._enrichSubclassContent
    }

    return () => undefined
}

function normalizeMarkdown(markdown: string | undefined): string {
    return (markdown ?? "").trim()
}

function collectParseErrors(
    content: OwidGdocPostContent
): string[] {
    const errors: string[] = []
    const body = content.body ?? []

    body.forEach((block) =>
        traverseEnrichedBlock(block, (child) => {
            const parseErrors = "parseErrors" in child ? child.parseErrors : []
            if (!parseErrors) return
            parseErrors.forEach((error) => {
                const prefix = error.isWarning ? "warning" : "error"
                errors.push(`${prefix}:${error.message}`)
            })
        })
    )

    return errors.sort()
}

function collectRefErrors(
    content: OwidGdocPostContent
): string[] {
    const errors: OwidGdocErrorMessage[] = content.refs?.errors ?? []
    return errors.map((error) => `${error.type}:${error.message}`).sort()
}

function formatDiff(oldText: string, newText: string): string {
    const parts = diffLines(oldText, newText)
    return parts
        .map((part) => {
            const prefix = part.added ? "+" : part.removed ? "-" : " "
            return part.value
                .split("\n")
                .map((line) => `${prefix}${line}`)
                .join("\n")
        })
        .join("\n")
}

async function fetchDocument(
    docsClient: docs_v1.Docs,
    row: PageRow
): Promise<docs_v1.Schema$Document> {
    const response = await docsClient.documents.get({
        documentId: row.id,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    return response.data
}

async function runOldParser(
    document: docs_v1.Schema$Document,
    enricher: (content: Record<string, unknown>) => void
): Promise<ParserResult> {
    const { text } = await gdocToArchie(document)
    const content = archieToEnriched(text, enricher)
    const markdown = normalizeMarkdown(
        enrichedBlocksToMarkdown(content.body, true)
    )
    return {
        content,
        markdown,
        parseErrors: collectParseErrors(content),
        refErrors: collectRefErrors(content),
    }
}

async function runNewParser(
    document: docs_v1.Schema$Document,
    enricher: (content: Record<string, unknown>) => void
): Promise<ParserResult> {
    const content = gdocAstToEnriched(document, enricher)
    const markdown = normalizeMarkdown(
        enrichedBlocksToMarkdown(content.body, true)
    )
    return {
        content,
        markdown,
        parseErrors: collectParseErrors(content),
        refErrors: collectRefErrors(content),
    }
}

function compareArrays(label: string, oldArr: string[], newArr: string[]): string[] {
    if (oldArr.length !== newArr.length) {
        return [
            `${label} count mismatch (old=${oldArr.length}, new=${newArr.length})`,
        ]
    }
    const mismatch = oldArr.some((value, index) => value !== newArr[index])
    if (mismatch) {
        return [`${label} content mismatch`]
    }
    return []
}

async function fetchRows(
    limit: number,
    slug: string | undefined
): Promise<PageRow[]> {
    if (slug) {
        const query = `-- sql
            SELECT id, slug, type
            FROM posts_gdocs
            WHERE slug = ?
            ORDER BY updatedAt DESC
        `
        return knexReadonlyTransaction((knex) =>
            knexRaw<PageRow>(knex, query, [slug])
        )
    }

    const query = `-- sql
        SELECT pg.id, pg.slug, pg.type
        FROM analytics_pageviews ap
        JOIN posts_gdocs pg ON ap.url = CONCAT('https://ourworldindata.org/', pg.slug)
        WHERE pg.published = 1
        ORDER BY ap.${DEFAULT_VIEW_COLUMN} DESC
        LIMIT ?
    `

    return knexReadonlyTransaction((knex) =>
        knexRaw<PageRow>(knex, query, [limit])
    )
}

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    const limit = Number(parsedArgs["limit"] ?? parsedArgs["l"] ?? DEFAULT_LIMIT)
    const slug = parsedArgs["slug"] ?? parsedArgs["s"]

    if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error("--limit must be a positive number.")
    }

    const rows = await fetchRows(limit, slug ? String(slug) : undefined)
    if (rows.length === 0) {
        console.log("No gdocs found for the selected criteria.")
        return
    }

    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    let mismatchCount = 0

    for (const row of rows) {
        const enricher = getEnricher(row)
        const document = await fetchDocument(docsClient, row)
        const oldResult = await runOldParser(document, enricher)
        const newResult = await runNewParser(document, enricher)

        const issues: string[] = []
        if (oldResult.markdown !== newResult.markdown) {
            issues.push("markdown mismatch")
        }

        issues.push(
            ...compareArrays(
                "parseErrors",
                oldResult.parseErrors,
                newResult.parseErrors
            )
        )
        issues.push(
            ...compareArrays(
                "refErrors",
                oldResult.refErrors,
                newResult.refErrors
            )
        )

        if (issues.length === 0) {
            console.log(`${row.slug} (${row.id}): OK`)
            continue
        }

        mismatchCount += 1
        console.log(`${row.slug} (${row.id}): ${issues.join(", ")}`)

        if (oldResult.markdown !== newResult.markdown) {
            console.log("Markdown diff:")
            console.log(formatDiff(oldResult.markdown, newResult.markdown))
        }
        if (oldResult.parseErrors.length || newResult.parseErrors.length) {
            console.log("Parse errors (old):", oldResult.parseErrors)
            console.log("Parse errors (new):", newResult.parseErrors)
        }
        if (oldResult.refErrors.length || newResult.refErrors.length) {
            console.log("Ref errors (old):", oldResult.refErrors)
            console.log("Ref errors (new):", newResult.refErrors)
        }
    }

    if (mismatchCount > 0) {
        console.log(`Mismatches: ${mismatchCount}/${rows.length}`)
    } else {
        console.log(`All ${rows.length} gdocs matched.`)
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Compare old vs new gdoc parsers.

Usage:
    yarn tsx devTools/gdocs/compareParsers.ts [--limit 5]
    yarn tsx devTools/gdocs/compareParsers.ts --slug <slug>

Options:
    --limit, -l   Number of gdocs to inspect (default: 5)
    --slug, -s    Compare a specific gdoc slug (latest updated)
`)
    process.exit(0)
} else {
    main(parsedArgs)
        .catch((error) => {
            console.error("Encountered an error:", error)
            process.exitCode = 1
        })
        .finally(() => {
            process.exit()
        })
}
