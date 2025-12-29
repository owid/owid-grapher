#! /usr/bin/env node

import parseArgs from "minimist"
import { type docs_v1 } from "@googleapis/docs"
import { OwidGdocType, type OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { diffLines } from "diff"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"
import { gdocAstToEnriched } from "../../db/model/Gdoc/gdocAstToEnriched.js"
import { documentToParagraphs } from "../../db/model/Gdoc/gdocAstToParagraphs.js"
import { paragraphsToArchieText } from "../../db/model/Gdoc/paragraphsToArchie.js"
import { enrichedBlockToRawBlock } from "../../db/model/Gdoc/enrichedToRaw.js"
import {
    buildGdocWriteBackPlan,
    parseRawBlockFromParagraphs,
    serializeRawBlockToArchieText,
} from "../../db/model/Gdoc/gdocWriteBack.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GdocAbout } from "../../db/model/Gdoc/GdocAbout.js"
import { GdocAuthor } from "../../db/model/Gdoc/GdocAuthor.js"
import { GdocHomepage } from "../../db/model/Gdoc/GdocHomepage.js"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"

const DEFAULT_LIMIT = 200
const DEFAULT_VIEW_COLUMN = "views_365d"

interface PageRow {
    id: string
    slug: string
    type: OwidGdocType
    rawGdoc: unknown
}

interface RoundTripIssue {
    slug: string
    id: string
    blockIndex: number | null
    blockType: string
    reason: string
    category: IssueCategory
    currentText?: string
    expectedText?: string
    whitespaceOnly?: boolean
}

type IssueCategory = "frontmatter" | "ref" | "default" | "structural" | "other"

function getEnricher(row: PageRow): (content: Record<string, unknown>) => void {
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

function normalizeArchieForCompare(text: string): string {
    const normalized = text.replace(/\r/g, "")
    const withoutLeading = normalized.startsWith("\n")
        ? normalized.slice(1)
        : normalized
    return withoutLeading.replace(/\n$/, "")
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim()
}

const DEFAULT_PROPERTY_LINES = new Set([
    "size: wide",
    "size: narrow",
    "hasOutline: true",
    "template: header-row",
])

function stripDefaultPropertyLines(text: string): string {
    return text
        .split("\n")
        .filter((line) => !DEFAULT_PROPERTY_LINES.has(line.trim()))
        .join("\n")
}

function stripRefMarkers(text: string): string {
    return text
        .replace(/\{\/?ref\}/g, "")
        .replace(/<a[^>]*class="ref"[^>]*>.*?<\/a>/g, "")
        .replace(/<a[^>]*href="#note-\d+"[^>]*>.*?<\/a>/g, "")
}

function isDefaultOnlyDiff(currentText: string, expectedText: string): boolean {
    const strippedCurrent = stripDefaultPropertyLines(currentText)
    const strippedExpected = stripDefaultPropertyLines(expectedText)
    return (
        normalizeArchieForCompare(strippedCurrent) ===
        normalizeArchieForCompare(strippedExpected)
    )
}

function isRefOnlyDiff(currentText: string, expectedText: string): boolean {
    const strippedCurrent = stripRefMarkers(currentText)
    const strippedExpected = stripRefMarkers(expectedText)
    return (
        normalizeArchieForCompare(strippedCurrent) ===
        normalizeArchieForCompare(strippedExpected)
    )
}

function classifyIssue(params: {
    reason: string
    currentText?: string
    expectedText?: string
}): IssueCategory {
    if (params.reason.startsWith("frontmatter:")) return "frontmatter"
    if (
        params.reason === "missing source range" ||
        params.reason === "source range out of bounds"
    ) {
        return "structural"
    }
    if (params.currentText && params.expectedText) {
        if (isDefaultOnlyDiff(params.currentText, params.expectedText)) {
            return "default"
        }
        if (isRefOnlyDiff(params.currentText, params.expectedText)) {
            return "ref"
        }
    }
    return "other"
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

function getCurrentTextForRange(
    paragraphs: ReturnType<typeof documentToParagraphs>,
    replacement: { startIndex: number; endIndex: number }
): string | null {
    const parts: string[] = []
    for (const paragraph of paragraphs) {
        if (
            paragraph.startIndex === undefined ||
            paragraph.endIndex === undefined
        ) {
            continue
        }
        const overlaps =
            replacement.startIndex < paragraph.endIndex &&
            replacement.endIndex > paragraph.startIndex
        if (!overlaps) continue
        if (paragraph.type !== "paragraph") return null

        const sliceStart = Math.max(
            0,
            replacement.startIndex - paragraph.startIndex
        )
        const sliceEnd = Math.min(
            paragraph.endIndex - paragraph.startIndex,
            replacement.endIndex - paragraph.startIndex
        )
        parts.push(paragraph.text.slice(sliceStart, sliceEnd))
    }
    if (parts.length === 0) return null
    return parts.join("")
}

function bumpCount<T extends string>(map: Map<T, number>, key: T): void {
    map.set(key, (map.get(key) ?? 0) + 1)
}

function isIgnoredIssue(issue: RoundTripIssue, ignored: Set<string>): boolean {
    if (ignored.has(issue.category)) return true
    if (issue.whitespaceOnly && ignored.has("whitespace")) return true
    return false
}

function alignListRangeText(currentText: string, expectedText: string): string {
    const expectedTrimmed = expectedText.trimEnd()
    if (!expectedTrimmed.endsWith("[]")) return currentText
    const currentTrimmed = currentText.trimEnd()
    if (currentTrimmed.endsWith("[]")) return currentText
    return `${currentText}\n[]`
}

function blockToArchieText(
    block: OwidEnrichedGdocBlock,
    currentRaw: ReturnType<typeof parseRawBlockFromParagraphs>
): string {
    const rawBlock = enrichedBlockToRawBlock(block)
    return serializeRawBlockToArchieText(rawBlock, currentRaw)
}

function parseRawGdoc(raw: unknown): docs_v1.Schema$Document | null {
    if (!raw) return null
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as docs_v1.Schema$Document
        } catch {
            return null
        }
    }
    if (typeof raw === "object") {
        return raw as docs_v1.Schema$Document
    }
    return null
}

async function fetchRows(
    limit: number | undefined,
    slug: string | undefined,
    all: boolean
): Promise<PageRow[]> {
    if (slug) {
        const query = `-- sql
            SELECT id, slug, type, rawGdoc
            FROM posts_gdocs
            WHERE slug = ?
            ORDER BY updatedAt DESC
            LIMIT 1
        `
        return knexReadonlyTransaction((knex) =>
            knexRaw<PageRow>(knex, query, [slug])
        )
    }

    if (all) {
        const query = `-- sql
            SELECT id, slug, type, rawGdoc
            FROM posts_gdocs
            WHERE published = 1
            ${limit === undefined ? "" : "LIMIT ?"}
        `
        return knexReadonlyTransaction((knex) =>
            knexRaw<PageRow>(knex, query, limit === undefined ? [] : [limit])
        )
    }

    if (limit === undefined) {
        throw new Error("--limit is required unless --all is set.")
    }

    const query = `-- sql
        SELECT pg.id, pg.slug, pg.type, pg.rawGdoc
        FROM (
            SELECT url
            FROM analytics_pageviews
            ORDER BY ${DEFAULT_VIEW_COLUMN} DESC
            LIMIT ?
        ) ap
        JOIN posts_gdocs pg ON ap.url = CONCAT('https://ourworldindata.org/', pg.slug)
        WHERE pg.published = 1
    `

    return knexReadonlyTransaction((knex) =>
        knexRaw<PageRow>(knex, query, [limit])
    )
}

function collectBodyIssues(
    row: PageRow,
    document: docs_v1.Schema$Document,
    blocks: OwidEnrichedGdocBlock[],
    options: { verbose: boolean }
): RoundTripIssue[] {
    const paragraphs = documentToParagraphs(document)
    const issues: RoundTripIssue[] = []

    blocks.forEach((block, index) => {
        const source = block._source
        if (
            !source ||
            source.paragraphStart === undefined ||
            source.paragraphEnd === undefined
        ) {
            issues.push({
                slug: row.slug,
                id: row.id,
                blockIndex: index,
                blockType: block.type,
                reason: "missing source range",
                category: "structural",
            })
            return
        }

        if (
            source.paragraphStart < 0 ||
            source.paragraphEnd < source.paragraphStart ||
            source.paragraphEnd >= paragraphs.length
        ) {
            issues.push({
                slug: row.slug,
                id: row.id,
                blockIndex: index,
                blockType: block.type,
                reason: "source range out of bounds",
                category: "structural",
            })
            return
        }

        const rangeParagraphs = paragraphs.slice(
            source.paragraphStart,
            source.paragraphEnd + 1
        )
        let currentText = paragraphsToArchieText(rangeParagraphs)
        const currentRaw = parseRawBlockFromParagraphs(rangeParagraphs)
        const expectedText = blockToArchieText(block, currentRaw)

        if (block.type === "list" || block.type === "numbered-list") {
            currentText = alignListRangeText(currentText, expectedText)
        }

        const normalizedCurrent = normalizeArchieForCompare(currentText)
        const normalizedExpected = normalizeArchieForCompare(expectedText)
        if (normalizedCurrent !== normalizedExpected) {
            const whitespaceOnly =
                normalizeWhitespace(normalizedCurrent) ===
                normalizeWhitespace(normalizedExpected)
            const category = classifyIssue({
                reason: "archie text mismatch",
                currentText,
                expectedText,
            })
            issues.push({
                slug: row.slug,
                id: row.id,
                blockIndex: index,
                blockType: block.type,
                reason: "archie text mismatch",
                category,
                currentText: options.verbose ? currentText : undefined,
                expectedText: options.verbose ? expectedText : undefined,
                whitespaceOnly,
            })
        }
    })

    return issues
}

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    if (parsedArgs.help || parsedArgs.h) {
        console.log(`Round-trip audit for cached raw gdoc responses.

Usage:
  yarn tsx devTools/gdocs/roundTripRawGdoc.ts [options]

Options:
  --all                   Scan all published gdocs (default: top by pageviews)
  --limit, -l <n>          Limit rows (ignored when --all without --limit)
  --slug, -s <slug>        Scan a specific gdoc slug
  --list                  Print per-doc diffs
  --max-list <n>          Limit per-doc output (default: 50)
  --ignore <list>         Comma-separated categories to ignore (whitespace,ref,default,frontmatter,structural,other)
  --list-all              Print per-doc diffs even when --ignore is used
  --json                  Emit JSON summary (with issues when --list)
  --verbose               Include text diffs for each issue
`)
        return
    }

    const list = Boolean(parsedArgs["list"])
    const listAll = Boolean(parsedArgs["list-all"])
    const all = Boolean(parsedArgs["all"])
    const maxList = Number(parsedArgs["max-list"] ?? 50)
    const verbose = Boolean(parsedArgs["verbose"])
    const json = Boolean(parsedArgs["json"])
    const slug = parsedArgs["slug"] ?? parsedArgs["s"]
    const limitArg = parsedArgs["limit"] ?? parsedArgs["l"]
    const limit =
        all && limitArg === undefined
            ? undefined
            : Number(limitArg ?? DEFAULT_LIMIT)

    const ignoreArg = parsedArgs["ignore"]
    const ignoreList = Array.isArray(ignoreArg)
        ? ignoreArg.flatMap((entry) =>
              String(entry)
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
          )
        : typeof ignoreArg === "string"
          ? ignoreArg
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
          : []
    const ignoredCategories = new Set(ignoreList)

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
        throw new Error("--limit must be a positive number.")
    }

    const rows = await fetchRows(limit, slug ? String(slug) : undefined, all)
    if (rows.length === 0) {
        console.log("No gdocs found for the selected criteria.")
        return
    }

    let missingRaw = 0
    let parseErrors = 0
    let totalIssues = 0
    const issuesBySlug = new Map<string, RoundTripIssue[]>()
    const filteredIssuesBySlug = new Map<string, RoundTripIssue[]>()
    const countsByCategory = new Map<IssueCategory, number>()
    const countsByCategoryFiltered = new Map<IssueCategory, number>()
    let whitespaceOnlyCount = 0
    let whitespaceOnlyFilteredCount = 0
    let totalFilteredIssues = 0

    for (const row of rows) {
        const document = parseRawGdoc(row.rawGdoc)
        if (!document) {
            missingRaw += 1
            continue
        }

        let content
        try {
            const enricher = getEnricher(row)
            content = gdocAstToEnriched(document, enricher)
        } catch {
            parseErrors += 1
            continue
        }

        const bodyIssues = collectBodyIssues(
            row,
            document,
            content.body ?? [],
            { verbose }
        )
        const paragraphs = documentToParagraphs(document)
        const plan = buildGdocWriteBackPlan(document, content, content)
        const frontmatterIssues = plan.replacements
            .filter((replacement) =>
                replacement.reason.startsWith("frontmatter:")
            )
            .map((replacement) => {
                const currentText =
                    getCurrentTextForRange(paragraphs, replacement) ?? ""
                const expectedText = replacement.newText
                const whitespaceOnly =
                    normalizeWhitespace(currentText) ===
                    normalizeWhitespace(expectedText)
                return {
                    slug: row.slug,
                    id: row.id,
                    blockIndex: null,
                    blockType: "frontmatter",
                    reason: replacement.reason,
                    category: "frontmatter",
                    currentText: verbose ? currentText : undefined,
                    expectedText: verbose ? expectedText : undefined,
                    whitespaceOnly,
                }
            })

        const issues = [...frontmatterIssues, ...bodyIssues]
        if (issues.length > 0) {
            issuesBySlug.set(row.slug, issues)
            totalIssues += issues.length
            issues.forEach((issue) => {
                bumpCount(countsByCategory, issue.category)
                if (issue.whitespaceOnly) whitespaceOnlyCount += 1
            })
        }

        const filteredIssues = issues.filter(
            (issue) => !isIgnoredIssue(issue, ignoredCategories)
        )
        if (filteredIssues.length > 0) {
            filteredIssuesBySlug.set(row.slug, filteredIssues)
            totalFilteredIssues += filteredIssues.length
            filteredIssues.forEach((issue) => {
                bumpCount(countsByCategoryFiltered, issue.category)
                if (issue.whitespaceOnly) whitespaceOnlyFilteredCount += 1
            })
        }
    }

    const summaries = {
        scanned: rows.length,
        missingRawGdoc: missingRaw,
        parseErrors,
        docsWithDiffs: issuesBySlug.size,
        totalDiffs: totalIssues,
        whitespaceOnly: whitespaceOnlyCount,
        docsWithDiffsAfterIgnore: filteredIssuesBySlug.size,
        totalDiffsAfterIgnore: totalFilteredIssues,
        whitespaceOnlyAfterIgnore: whitespaceOnlyFilteredCount,
        ignored: [...ignoredCategories],
        categoryCounts: Object.fromEntries(countsByCategory),
        categoryCountsAfterIgnore: Object.fromEntries(countsByCategoryFiltered),
    }

    if (json) {
        const issuesForOutput =
            list || listAll
                ? Object.fromEntries(
                      (listAll ? issuesBySlug : filteredIssuesBySlug).entries()
                  )
                : undefined
        console.log(
            JSON.stringify(
                { summary: summaries, issues: issuesForOutput },
                null,
                2
            )
        )
        return
    }

    console.log(`Scanned ${summaries.scanned} gdocs.`)
    console.log(`Missing rawGdoc: ${summaries.missingRawGdoc}`)
    console.log(`Parse errors: ${summaries.parseErrors}`)
    console.log(`Docs with diffs: ${summaries.docsWithDiffs}`)
    console.log(`Total diffs: ${summaries.totalDiffs}`)
    console.log(`Whitespace-only diffs: ${summaries.whitespaceOnly}`)
    if (ignoredCategories.size > 0) {
        console.log(
            `Docs with diffs after ignore: ${summaries.docsWithDiffsAfterIgnore}`
        )
        console.log(
            `Total diffs after ignore: ${summaries.totalDiffsAfterIgnore}`
        )
        console.log(
            `Whitespace-only diffs after ignore: ${summaries.whitespaceOnlyAfterIgnore}`
        )
    }

    const categories = Object.entries(summaries.categoryCounts)
        .map(([category, count]) => `${category}=${count}`)
        .join(", ")
    if (categories) {
        console.log(`Categories: ${categories}`)
    }

    if (ignoredCategories.size > 0) {
        const filteredCategories = Object.entries(
            summaries.categoryCountsAfterIgnore
        )
            .map(([category, count]) => `${category}=${count}`)
            .join(", ")
        if (filteredCategories) {
            console.log(`Categories after ignore: ${filteredCategories}`)
        }
    }

    const issuesForListing = listAll ? issuesBySlug : filteredIssuesBySlug

    if (list && issuesForListing.size > 0) {
        let printed = 0
        for (const [slugKey, issues] of issuesForListing.entries()) {
            console.log(`\n${slugKey} (${issues[0].id})`)
            issues.forEach((issue) => {
                const whitespaceTag = issue.whitespaceOnly
                    ? " (whitespace-only)"
                    : ""
                console.log(
                    `- ${issue.reason}${whitespaceTag} [${issue.category}] (${
                        issue.blockType
                    }${issue.blockIndex !== null ? `:${issue.blockIndex}` : ""})`
                )
                if (verbose && issue.currentText !== undefined) {
                    const diff = formatDiff(
                        issue.currentText,
                        issue.expectedText ?? ""
                    )
                    const trimmedDiff = diff.trimEnd()
                    console.log(trimmedDiff ? trimmedDiff : "(no diff text)")
                }
            })
            printed += 1
            if (printed >= maxList) break
        }
    }
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs.help || parsedArgs.h) {
    main(parsedArgs)
        .catch((error) => {
            console.error(error)
            process.exitCode = 1
        })
        .finally(() => {
            process.exit()
        })
} else {
    main(parsedArgs)
        .catch((error) => {
            console.error(error)
            process.exitCode = 1
        })
        .finally(() => {
            process.exit()
        })
}
