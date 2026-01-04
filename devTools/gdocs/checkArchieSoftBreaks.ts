#! /usr/bin/env node

import parseArgs from "minimist"
import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"

const VIEW_COLUMNS = ["views_7d", "views_14d", "views_365d"] as const
type ViewColumn = (typeof VIEW_COLUMNS)[number]

const DEFAULT_LIMIT = 10
const DEFAULT_VIEW_COLUMN: ViewColumn = "views_365d"

const whitespacePattern =
    "\\u0000\\u0009\\u000A\\u000B\\u000C\\u000D\\u0020\\u00A0\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u200B\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
const slugBlacklist = `${whitespacePattern}\\u005B\\u005C\\u005D\\u007B\\u007D\\u003A`

const startKey = new RegExp(
    `^\\s*([^${slugBlacklist}]+)[ \\t\\r]*:[ \\t\\r]*(.*)$`
)
const commandKey = new RegExp(
    "^\\s*:[ \\t\\r]*(endskip|ignore|skip|end).*?$",
    "i"
)
const arrayElement = new RegExp("^\\s*\\*[ \\t\\r]*(.*)$")
const scopePattern = new RegExp(
    `^\\s*(\\[|\\{)[ \\t\\r]*([\\+\\.]*)[ \\t\\r]*([^${slugBlacklist}]*)[ \\t\\r]*(?:\\]|\\}).*$`
)

interface PageRow {
    id: string
    slug: string
    views: number | null
}

interface DocStats {
    id: string
    slug: string
    views: number | null
    totalConstructs: number
    softBreakConstructs: number
}

function isArchieConstructLine(line: string): boolean {
    const normalizedLine = line.replace(/\r/g, "")
    return (
        commandKey.test(normalizedLine) ||
        startKey.test(normalizedLine) ||
        arrayElement.test(normalizedLine) ||
        scopePattern.test(normalizedLine)
    )
}

function splitParagraphLines(text: string): {
    contentLines: string[]
    softBreakLines: string[]
} {
    if (!text) return { contentLines: [], softBreakLines: [] }

    const normalizedText = text.replace(/\r/g, "")
    const lines = normalizedText.split("\n")
    const hasTrailingNewline = normalizedText.endsWith("\n")
    const lastContentIndex = hasTrailingNewline
        ? lines.length - 2
        : lines.length - 1

    if (lastContentIndex < 0) {
        return { contentLines: [], softBreakLines: [] }
    }

    const contentLines = lines.slice(0, lastContentIndex + 1)
    const softBreakLines = contentLines.slice(0, -1)
    return { contentLines, softBreakLines }
}

function paragraphToText(paragraph: docs_v1.Schema$Paragraph): string {
    const elements = paragraph.elements ?? []
    return elements.map((element) => element.textRun?.content ?? "").join("")
}

function collectParagraphTextsFromElements(
    elements: docs_v1.Schema$StructuralElement[],
    paragraphs: string[]
): void {
    for (const element of elements) {
        if (element.paragraph) {
            paragraphs.push(paragraphToText(element.paragraph))
        }

        if (element.table?.tableRows) {
            for (const row of element.table.tableRows) {
                const cells = row.tableCells ?? []
                for (const cell of cells) {
                    const cellContent = cell.content ?? []
                    collectParagraphTextsFromElements(cellContent, paragraphs)
                }
            }
        }

        if (element.tableOfContents?.content) {
            collectParagraphTextsFromElements(
                element.tableOfContents.content,
                paragraphs
            )
        }
    }
}

function countSoftBreakConstructs(
    paragraphText: string
): Pick<DocStats, "totalConstructs" | "softBreakConstructs"> {
    const { contentLines, softBreakLines } = splitParagraphLines(paragraphText)

    let totalConstructs = 0
    let softBreakConstructs = 0

    for (const line of contentLines) {
        if (isArchieConstructLine(line)) totalConstructs += 1
    }

    for (const line of softBreakLines) {
        if (isArchieConstructLine(line)) softBreakConstructs += 1
    }

    return { totalConstructs, softBreakConstructs }
}

async function fetchTopGdocs(
    limit: number,
    viewColumn: ViewColumn
): Promise<PageRow[]> {
    const query = `-- sql
        SELECT pg.id, pg.slug, ap.${viewColumn} AS views
        FROM analytics_pageviews ap
        JOIN posts_gdocs pg ON ap.url = CONCAT('https://ourworldindata.org/', pg.slug)
        WHERE pg.published = 1
        ORDER BY ap.${viewColumn} DESC
        LIMIT ?
    `

    return knexReadonlyTransaction((knex) => knexRaw<PageRow>(knex, query, [limit]))
}

async function fetchDocStats(
    docsClient: docs_v1.Docs,
    row: PageRow
): Promise<DocStats> {
    const response = await docsClient.documents.get({
        documentId: row.id,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })

    const paragraphs: string[] = []
    const document = response.data
    const content = document.body?.content ?? []
    collectParagraphTextsFromElements(content, paragraphs)

    let totalConstructs = 0
    let softBreakConstructs = 0

    for (const paragraphText of paragraphs) {
        const counts = countSoftBreakConstructs(paragraphText)
        totalConstructs += counts.totalConstructs
        softBreakConstructs += counts.softBreakConstructs
    }

    return {
        id: row.id,
        slug: row.slug,
        views: row.views,
        totalConstructs,
        softBreakConstructs,
    }
}

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    const limit = Number(parsedArgs["limit"] ?? parsedArgs["l"] ?? DEFAULT_LIMIT)
    const viewColumn = (parsedArgs["window"] ??
        parsedArgs["w"] ??
        DEFAULT_VIEW_COLUMN) as ViewColumn

    if (!VIEW_COLUMNS.includes(viewColumn)) {
        throw new Error(
            `Invalid --window value. Use one of: ${VIEW_COLUMNS.join(", ")}`
        )
    }

    if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error("--limit must be a positive number.")
    }

    const rows = await fetchTopGdocs(limit, viewColumn)
    if (rows.length === 0) {
        console.log("No gdocs found for the selected pageview window.")
        return
    }

    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    const stats: DocStats[] = []
    for (const row of rows) {
        stats.push(await fetchDocStats(docsClient, row))
    }

    let totalConstructs = 0
    let softBreakConstructs = 0
    for (const stat of stats) {
        totalConstructs += stat.totalConstructs
        softBreakConstructs += stat.softBreakConstructs
    }

    console.log(
        `Top ${rows.length} gdocs by ${viewColumn}: soft-break ArchieML constructs`
    )
    for (const stat of stats) {
        const viewsLabel =
            typeof stat.views === "number" ? stat.views.toLocaleString() : "n/a"
        console.log(
            `${stat.slug} (views=${viewsLabel}) softBreak=${stat.softBreakConstructs} totalConstructs=${stat.totalConstructs}`
        )
    }

    console.log(
        `TOTAL softBreak=${softBreakConstructs} totalConstructs=${totalConstructs}`
    )
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Check ArchieML constructs for soft line breaks in top gdocs.

Usage:
    yarn tsx devTools/gdocs/checkArchieSoftBreaks.ts [--limit 10] [--window views_365d]

Options:
    --limit, -l   Number of gdocs to inspect (default: 10)
    --window, -w  Pageview column to sort by: views_7d, views_14d, views_365d
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
