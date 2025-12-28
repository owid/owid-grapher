#! /usr/bin/env node

import parseArgs from "minimist"
import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { knexRaw, knexReadonlyTransaction } from "../../db/db.js"

const VIEW_COLUMNS = ["views_7d", "views_14d", "views_365d"] as const
type ViewColumn = (typeof VIEW_COLUMNS)[number]

const DEFAULT_LIMIT = 200
const DEFAULT_VIEW_COLUMN: ViewColumn = "views_365d"
const MAX_SLUGS_PER_ISSUE = 20

const whitespacePattern =
    "\\u0000\\u0009\\u000A\\u000B\\u000C\\u000D\\u0020\\u00A0\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u200B\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
const slugBlacklist = `${whitespacePattern}\\u005B\\u005C\\u005D\\u007B\\u007D\\u003A`

const scopePattern = new RegExp(
    `^\\s*(\\[|\\{)[ \\t\\r]*([\\+\\.]*)[ \\t\\r]*([^${slugBlacklist}]*)[ \\t\\r]*(?:\\]|\\}).*$`
)
const scopeMarkerOnly = new RegExp(
    `^\\s*(\\[|\\{)[ \\t\\r]*([\\+\\.]*)[ \\t\\r]*([^${slugBlacklist}]*)[ \\t\\r]*(\\]|\\})\\s*$`
)

const ORDERED_GLYPH_TYPES = new Set([
    "DECIMAL",
    "UPPER_ROMAN",
    "LOWER_ROMAN",
    "UPPER_ALPHA",
    "LOWER_ALPHA",
])

interface PageRow {
    id: string
    slug: string
    views?: number | null
}

interface DocAuditFlags {
    hasScopeTrailingText: boolean
    hasScopeInMultilineParagraph: boolean
    hasLegacyHeadingDirective: boolean
    hasHeadingStyle: boolean
    hasTableOutsideMarkers: boolean
    hasInlineObjects: boolean
    hasEquations: boolean
    hasFootnotes: boolean
    hasCheckboxLists: boolean
    hasNestedLists: boolean
    hasOrderedLists: boolean
}

type IssueKey =
    | "scopeTrailingText"
    | "scopeInMultilineParagraph"
    | "legacyHeadingDirective"
    | "tableOutsideMarkers"
    | "inlineObjects"
    | "equations"
    | "footnotes"
    | "checkboxLists"
    | "nestedLists"
    | "orderedLists"

const ISSUE_LABELS: Record<IssueKey, string> = {
    scopeTrailingText: "scope markers with trailing text",
    scopeInMultilineParagraph: "scope markers in multiline paragraphs",
    legacyHeadingDirective: "legacy {.heading} directives",
    tableOutsideMarkers: "tables outside {.table} markers",
    inlineObjects: "inline objects",
    equations: "equations",
    footnotes: "footnote references",
    checkboxLists: "checkbox lists",
    nestedLists: "nested lists",
    orderedLists: "ordered lists",
}

interface AuditTotals {
    docs: number
    paragraphs: number
    scopeDirectiveLines: number
    scopeDirectiveLinesWithTrailingText: number
    scopeDirectiveLinesInMultilineParagraph: number
    legacyHeadingDirectiveLines: number
    headingStyleParagraphs: number
    tablesTotal: number
    tablesOutsideMarkers: number
    tablesInsideMarkers: number
    listParagraphs: number
    listIds: Set<string>
    listGlyphTypeCounts: Map<string, number>
    listNestedParagraphs: number
    inlineObjectCount: number
    equationCount: number
    footnoteCount: number
}

interface ScopeLineInfo {
    bracket: string
    flags: string
    slug: string
    markerOnly: boolean
}

interface LineIssueGroup {
    paragraphIndex: number
    lineIndex: number
    lines: string[]
    keys: Set<IssueKey>
}

interface LineContext {
    paragraphIndex: number
    lineIndex: number
    text: string
}

interface TableIssueDetail {
    elementIndex: number
    before?: LineContext
    after?: LineContext
}

function normalizeParagraphText(paragraph: docs_v1.Schema$Paragraph): string {
    const elements = paragraph.elements ?? []
    return elements.map((element) => element.textRun?.content ?? "").join("")
}

function getParagraphLines(text: string): string[] {
    if (!text) return []
    const normalized = text.replace(/\r/g, "")
    const content = normalized.endsWith("\n")
        ? normalized.slice(0, -1)
        : normalized
    if (content.length === 0) return []
    return content.split("\n")
}

function parseScopeLine(line: string): ScopeLineInfo | undefined {
    const normalizedLine = line.replace(/\r/g, "")
    const match = scopePattern.exec(normalizedLine)
    if (!match) return undefined

    const markerOnlyMatch = scopeMarkerOnly.exec(normalizedLine)
    const markerOnly = Boolean(markerOnlyMatch)

    return {
        bracket: match[1],
        flags: match[2],
        slug: match[3].trim(),
        markerOnly,
    }
}

function getListGlyphType(
    document: docs_v1.Schema$Document,
    listId: string,
    nestingLevel: number
): string {
    const list = document.lists?.[listId]
    const levels = list?.listProperties?.nestingLevels
    const level = levels?.[nestingLevel]
    const glyphType = level?.glyphType ?? "unknown"
    return glyphType
}

function incrementMapCount(
    map: Map<string, number>,
    key: string
): void {
    map.set(key, (map.get(key) ?? 0) + 1)
}

function recordIssue(
    issueSlugs: Map<IssueKey, Set<string>>,
    key: IssueKey,
    slug: string
): void {
    const set = issueSlugs.get(key)
    if (set) {
        set.add(slug)
    } else {
        issueSlugs.set(key, new Set([slug]))
    }
}

function recordLineIssue(
    lineIssues: Map<string, LineIssueGroup>,
    key: IssueKey,
    paragraphIndex: number,
    lineIndex: number,
    lines: string[]
): void {
    const safeLines = lines.length > 0 ? lines : [""]
    const safeLineIndex = Math.min(
        Math.max(lineIndex, 0),
        safeLines.length - 1
    )
    const mapKey = `${paragraphIndex}:${safeLineIndex}`
    const existing = lineIssues.get(mapKey)
    if (existing) {
        existing.keys.add(key)
        return
    }

    lineIssues.set(mapKey, {
        paragraphIndex,
        lineIndex: safeLineIndex,
        lines: safeLines,
        keys: new Set([key]),
    })
}

async function fetchGdocsBySlug(slug: string): Promise<PageRow[]> {
    const query = `-- sql
        SELECT id, slug
        FROM posts_gdocs
        WHERE slug = ?
        ORDER BY updatedAt DESC
    `
    return knexReadonlyTransaction((knex) =>
        knexRaw<PageRow>(knex, query, [slug])
    )
}

async function fetchGdocs(
    limit: number | undefined,
    viewColumn: ViewColumn,
    includeAllPublished: boolean
): Promise<PageRow[]> {
    if (includeAllPublished) {
        const baseQuery = `-- sql
            SELECT id, slug
            FROM posts_gdocs
            WHERE published = 1
            ORDER BY updatedAt DESC
        `
        const query = limit
            ? `${baseQuery} LIMIT ?`
            : baseQuery
        const params = limit ? [limit] : []
        return knexReadonlyTransaction((knex) =>
            knexRaw<PageRow>(knex, query, params)
        )
    }

    if (limit === undefined) {
        throw new Error("--limit is required when using pageview ranking.")
    }

    const query = `-- sql
        SELECT pg.id, pg.slug, ap.${viewColumn} AS views
        FROM analytics_pageviews ap
        JOIN posts_gdocs pg ON ap.url = CONCAT('https://ourworldindata.org/', pg.slug)
        WHERE pg.published = 1
        ORDER BY ap.${viewColumn} DESC
        LIMIT ?
    `

    return knexReadonlyTransaction((knex) =>
        knexRaw<PageRow>(knex, query, [limit])
    )
}

function initTotals(): AuditTotals {
    return {
        docs: 0,
        paragraphs: 0,
        scopeDirectiveLines: 0,
        scopeDirectiveLinesWithTrailingText: 0,
        scopeDirectiveLinesInMultilineParagraph: 0,
        legacyHeadingDirectiveLines: 0,
        headingStyleParagraphs: 0,
        tablesTotal: 0,
        tablesOutsideMarkers: 0,
        tablesInsideMarkers: 0,
        listParagraphs: 0,
        listIds: new Set<string>(),
        listGlyphTypeCounts: new Map<string, number>(),
        listNestedParagraphs: 0,
        inlineObjectCount: 0,
        equationCount: 0,
        footnoteCount: 0,
    }
}

function initDocFlags(): DocAuditFlags {
    return {
        hasScopeTrailingText: false,
        hasScopeInMultilineParagraph: false,
        hasLegacyHeadingDirective: false,
        hasHeadingStyle: false,
        hasTableOutsideMarkers: false,
        hasInlineObjects: false,
        hasEquations: false,
        hasFootnotes: false,
        hasCheckboxLists: false,
        hasNestedLists: false,
        hasOrderedLists: false,
    }
}

function auditParagraph(
    paragraph: docs_v1.Schema$Paragraph,
    document: docs_v1.Schema$Document,
    totals: AuditTotals,
    flags: DocAuditFlags
): void {
    totals.paragraphs += 1

    if (paragraph.paragraphStyle?.namedStyleType?.includes("HEADING")) {
        totals.headingStyleParagraphs += 1
        flags.hasHeadingStyle = true
    }

    if (paragraph.bullet?.listId) {
        totals.listParagraphs += 1
        totals.listIds.add(paragraph.bullet.listId)
        const nestingLevel = paragraph.bullet.nestingLevel ?? 0
        const glyphType = getListGlyphType(
            document,
            paragraph.bullet.listId,
            nestingLevel
        )
        incrementMapCount(totals.listGlyphTypeCounts, glyphType)

        if (nestingLevel > 0) {
            totals.listNestedParagraphs += 1
            flags.hasNestedLists = true
        }

        if (ORDERED_GLYPH_TYPES.has(glyphType)) {
            flags.hasOrderedLists = true
        }

        if (glyphType.includes("CHECKBOX")) {
            flags.hasCheckboxLists = true
        }
    }

    const elements = paragraph.elements ?? []
    for (const element of elements) {
        if (element.inlineObjectElement) {
            totals.inlineObjectCount += 1
            flags.hasInlineObjects = true
        }
        if (element.equation) {
            totals.equationCount += 1
            flags.hasEquations = true
        }
        if (element.footnoteReference) {
            totals.footnoteCount += 1
            flags.hasFootnotes = true
        }
    }

    const lines = getParagraphLines(normalizeParagraphText(paragraph))
    const hasMultipleLines = lines.length > 1

    for (const line of lines) {
        const scopeInfo = parseScopeLine(line)
        if (!scopeInfo) continue

        totals.scopeDirectiveLines += 1

        if (!scopeInfo.markerOnly) {
            totals.scopeDirectiveLinesWithTrailingText += 1
            flags.hasScopeTrailingText = true
        }

        if (hasMultipleLines) {
            totals.scopeDirectiveLinesInMultilineParagraph += 1
            flags.hasScopeInMultilineParagraph = true
        }

        if (scopeInfo.slug.toLowerCase() === "heading") {
            totals.legacyHeadingDirectiveLines += 1
            flags.hasLegacyHeadingDirective = true
        }
    }
}

function auditParagraphWithDetails(
    paragraph: docs_v1.Schema$Paragraph,
    document: docs_v1.Schema$Document,
    totals: AuditTotals,
    lineIssues: Map<string, LineIssueGroup>,
    paragraphIndex: number
): void {
    totals.paragraphs += 1

    if (paragraph.paragraphStyle?.namedStyleType?.includes("HEADING")) {
        totals.headingStyleParagraphs += 1
    }

    const lines = getParagraphLines(normalizeParagraphText(paragraph))
    const hasMultipleLines = lines.length > 1

    if (paragraph.bullet?.listId) {
        totals.listParagraphs += 1
        totals.listIds.add(paragraph.bullet.listId)
        const nestingLevel = paragraph.bullet.nestingLevel ?? 0
        const glyphType = getListGlyphType(
            document,
            paragraph.bullet.listId,
            nestingLevel
        )
        incrementMapCount(totals.listGlyphTypeCounts, glyphType)

        if (nestingLevel > 0) {
            totals.listNestedParagraphs += 1
            recordLineIssue(
                lineIssues,
                "nestedLists",
                paragraphIndex,
                0,
                lines
            )
        }

        if (ORDERED_GLYPH_TYPES.has(glyphType)) {
            recordLineIssue(
                lineIssues,
                "orderedLists",
                paragraphIndex,
                0,
                lines
            )
        }

        if (glyphType.includes("CHECKBOX")) {
            recordLineIssue(
                lineIssues,
                "checkboxLists",
                paragraphIndex,
                0,
                lines
            )
        }
    }

    let hasInlineObject = false
    let hasEquation = false
    let hasFootnote = false

    const elements = paragraph.elements ?? []
    for (const element of elements) {
        if (element.inlineObjectElement) {
            totals.inlineObjectCount += 1
            hasInlineObject = true
        }
        if (element.equation) {
            totals.equationCount += 1
            hasEquation = true
        }
        if (element.footnoteReference) {
            totals.footnoteCount += 1
            hasFootnote = true
        }
    }

    if (hasInlineObject) {
        recordLineIssue(
            lineIssues,
            "inlineObjects",
            paragraphIndex,
            0,
            lines
        )
    }
    if (hasEquation) {
        recordLineIssue(
            lineIssues,
            "equations",
            paragraphIndex,
            0,
            lines
        )
    }
    if (hasFootnote) {
        recordLineIssue(
            lineIssues,
            "footnotes",
            paragraphIndex,
            0,
            lines
        )
    }

    for (const [lineIndex, line] of lines.entries()) {
        const scopeInfo = parseScopeLine(line)
        if (!scopeInfo) continue

        totals.scopeDirectiveLines += 1

        if (!scopeInfo.markerOnly) {
            totals.scopeDirectiveLinesWithTrailingText += 1
            recordLineIssue(
                lineIssues,
                "scopeTrailingText",
                paragraphIndex,
                lineIndex,
                lines
            )
        }

        if (hasMultipleLines) {
            totals.scopeDirectiveLinesInMultilineParagraph += 1
            recordLineIssue(
                lineIssues,
                "scopeInMultilineParagraph",
                paragraphIndex,
                lineIndex,
                lines
            )
        }

        if (scopeInfo.slug.toLowerCase() === "heading") {
            totals.legacyHeadingDirectiveLines += 1
            recordLineIssue(
                lineIssues,
                "legacyHeadingDirective",
                paragraphIndex,
                lineIndex,
                lines
            )
        }
    }
}

function updateTableContextFromParagraph(
    paragraph: docs_v1.Schema$Paragraph,
    isInTable: boolean
): boolean {
    const lines = getParagraphLines(normalizeParagraphText(paragraph))
    if (lines.length !== 1) return isInTable
    const scopeInfo = parseScopeLine(lines[0])
    if (!scopeInfo || !scopeInfo.markerOnly) return isInTable

    if (scopeInfo.bracket === "{" && scopeInfo.slug === "table") {
        return true
    }

    if (scopeInfo.bracket === "{" && scopeInfo.slug === "" && isInTable) {
        return false
    }

    return isInTable
}

function auditStructuralElements(
    elements: docs_v1.Schema$StructuralElement[],
    document: docs_v1.Schema$Document,
    totals: AuditTotals,
    flags: DocAuditFlags
): void {
    for (const element of elements) {
        if (element.paragraph) {
            auditParagraph(element.paragraph, document, totals, flags)
        }

        if (element.table?.tableRows) {
            for (const row of element.table.tableRows) {
                const cells = row.tableCells ?? []
                for (const cell of cells) {
                    const cellContent = cell.content ?? []
                    auditStructuralElements(cellContent, document, totals, flags)
                }
            }
        }

        if (element.tableOfContents?.content) {
            auditStructuralElements(
                element.tableOfContents.content,
                document,
                totals,
                flags
            )
        }
    }
}

function auditStructuralElementsWithDetails(
    elements: docs_v1.Schema$StructuralElement[],
    document: docs_v1.Schema$Document,
    totals: AuditTotals,
    lineIssues: Map<string, LineIssueGroup>,
    paragraphCounter: { value: number }
): void {
    for (const element of elements) {
        if (element.paragraph) {
            auditParagraphWithDetails(
                element.paragraph,
                document,
                totals,
                lineIssues,
                paragraphCounter.value
            )
            paragraphCounter.value += 1
        }

        if (element.table?.tableRows) {
            for (const row of element.table.tableRows) {
                const cells = row.tableCells ?? []
                for (const cell of cells) {
                    const cellContent = cell.content ?? []
                    auditStructuralElementsWithDetails(
                        cellContent,
                        document,
                        totals,
                        lineIssues,
                        paragraphCounter
                    )
                }
            }
        }

        if (element.tableOfContents?.content) {
            auditStructuralElementsWithDetails(
                element.tableOfContents.content,
                document,
                totals,
                lineIssues,
                paragraphCounter
            )
        }
    }
}

async function auditGdoc(
    docsClient: docs_v1.Docs,
    row: PageRow,
    totals: AuditTotals,
    issueSlugs: Map<IssueKey, Set<string>>
): Promise<void> {
    const response = await docsClient.documents.get({
        documentId: row.id,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })

    const document = response.data
    const flags = initDocFlags()
    totals.docs += 1

    const bodyContent = document.body?.content ?? []
    let isInTable = false
    for (const element of bodyContent) {
        if (element.paragraph) {
            isInTable = updateTableContextFromParagraph(
                element.paragraph,
                isInTable
            )
        }
        if (element.table) {
            totals.tablesTotal += 1
            if (isInTable) {
                totals.tablesInsideMarkers += 1
            } else {
                totals.tablesOutsideMarkers += 1
                flags.hasTableOutsideMarkers = true
            }
        }
    }

    auditStructuralElements(bodyContent, document, totals, flags)

    if (flags.hasScopeTrailingText) {
        recordIssue(issueSlugs, "scopeTrailingText", row.slug)
    }
    if (flags.hasScopeInMultilineParagraph) {
        recordIssue(issueSlugs, "scopeInMultilineParagraph", row.slug)
    }
    if (flags.hasLegacyHeadingDirective) {
        recordIssue(issueSlugs, "legacyHeadingDirective", row.slug)
    }
    if (flags.hasTableOutsideMarkers) {
        recordIssue(issueSlugs, "tableOutsideMarkers", row.slug)
    }
    if (flags.hasInlineObjects) {
        recordIssue(issueSlugs, "inlineObjects", row.slug)
    }
    if (flags.hasEquations) {
        recordIssue(issueSlugs, "equations", row.slug)
    }
    if (flags.hasFootnotes) {
        recordIssue(issueSlugs, "footnotes", row.slug)
    }
    if (flags.hasCheckboxLists) {
        recordIssue(issueSlugs, "checkboxLists", row.slug)
    }
    if (flags.hasNestedLists) {
        recordIssue(issueSlugs, "nestedLists", row.slug)
    }
    if (flags.hasOrderedLists) {
        recordIssue(issueSlugs, "orderedLists", row.slug)
    }
}

function formatLineIssueKeys(keys: Set<IssueKey>): string {
    return Array.from(keys)
        .map((key) => ISSUE_LABELS[key] ?? key)
        .join("; ")
}

function printLineIssueContext(issue: LineIssueGroup): void {
    const before = issue.lines[issue.lineIndex - 1]
    const current = issue.lines[issue.lineIndex]
    const after = issue.lines[issue.lineIndex + 1]

    console.log(`Issue: ${formatLineIssueKeys(issue.keys)}`)
    console.log(
        `Paragraph ${issue.paragraphIndex + 1}, line ${issue.lineIndex + 1}`
    )
    console.log(`  -1: ${before ?? "<none>"}`)
    console.log(`   0: ${current ?? "<empty>"}`)
    console.log(`  +1: ${after ?? "<none>"}`)
}

function printTableIssueContext(issue: TableIssueDetail): void {
    console.log(`Issue: ${ISSUE_LABELS.tableOutsideMarkers}`)
    console.log(`Table element index ${issue.elementIndex}`)
    if (issue.before) {
        console.log(
            `  before: (paragraph ${issue.before.paragraphIndex + 1}, line ${
                issue.before.lineIndex + 1
            }) ${issue.before.text}`
        )
    } else {
        console.log("  before: <none>")
    }
    if (issue.after) {
        console.log(
            `  after: (paragraph ${issue.after.paragraphIndex + 1}, line ${
                issue.after.lineIndex + 1
            }) ${issue.after.text}`
        )
    } else {
        console.log("  after: <none>")
    }
}

function buildLineContext(
    paragraphIndex: number,
    lineIndex: number,
    lines: string[]
): LineContext | undefined {
    if (lines.length === 0) return undefined
    const safeLineIndex = Math.min(Math.max(lineIndex, 0), lines.length - 1)
    return {
        paragraphIndex,
        lineIndex: safeLineIndex,
        text: lines[safeLineIndex],
    }
}

function buildTableIssueContexts(
    topLevelParagraphs: Array<{
        elementIndex: number
        paragraphIndex: number
        lines: string[]
    }>,
    tableIssueElementIndices: number[]
): TableIssueDetail[] {
    const issues: TableIssueDetail[] = []
    for (const elementIndex of tableIssueElementIndices) {
        const beforeParagraph = [...topLevelParagraphs]
            .filter((entry) => entry.elementIndex < elementIndex)
            .pop()
        const afterParagraph = topLevelParagraphs.find(
            (entry) => entry.elementIndex > elementIndex
        )

        issues.push({
            elementIndex,
            before: beforeParagraph
                ? buildLineContext(
                      beforeParagraph.paragraphIndex,
                      beforeParagraph.lines.length - 1,
                      beforeParagraph.lines
                  )
                : undefined,
            after: afterParagraph
                ? buildLineContext(
                      afterParagraph.paragraphIndex,
                      0,
                      afterParagraph.lines
                  )
                : undefined,
        })
    }

    return issues
}

async function auditSlug(
    docsClient: docs_v1.Docs,
    slug: string
): Promise<void> {
    const rows = await fetchGdocsBySlug(slug)
    if (rows.length === 0) {
        console.log(`No gdocs found for slug "${slug}".`)
        return
    }

    for (const row of rows) {
        const response = await docsClient.documents.get({
            documentId: row.id,
            suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        })

        const document = response.data
        const totals = initTotals()
        totals.docs = 1
        const lineIssues = new Map<string, LineIssueGroup>()
        const tableIssueElementIndices: number[] = []
        const paragraphCounter = { value: 0 }

        const bodyContent = document.body?.content ?? []
        const topLevelParagraphs: Array<{
            elementIndex: number
            paragraphIndex: number
            lines: string[]
        }> = []

        let isInTable = false
        for (const [index, element] of bodyContent.entries()) {
            if (element.paragraph) {
                auditParagraphWithDetails(
                    element.paragraph,
                    document,
                    totals,
                    lineIssues,
                    paragraphCounter.value
                )
                const lines = getParagraphLines(
                    normalizeParagraphText(element.paragraph)
                )
                topLevelParagraphs.push({
                    elementIndex: index,
                    paragraphIndex: paragraphCounter.value,
                    lines,
                })
                paragraphCounter.value += 1
                isInTable = updateTableContextFromParagraph(
                    element.paragraph,
                    isInTable
                )
            }

            if (element.table) {
                totals.tablesTotal += 1
                if (isInTable) {
                    totals.tablesInsideMarkers += 1
                } else {
                    totals.tablesOutsideMarkers += 1
                    tableIssueElementIndices.push(index)
                }
                const rows = element.table.tableRows ?? []
                for (const row of rows) {
                    const cells = row.tableCells ?? []
                    for (const cell of cells) {
                        const cellContent = cell.content ?? []
                        auditStructuralElementsWithDetails(
                            cellContent,
                            document,
                            totals,
                            lineIssues,
                            paragraphCounter
                        )
                    }
                }
            }

            if (element.tableOfContents?.content) {
                auditStructuralElementsWithDetails(
                    element.tableOfContents.content,
                    document,
                    totals,
                    lineIssues,
                    paragraphCounter
                )
            }
        }

        const tableIssues = buildTableIssueContexts(
            topLevelParagraphs,
            tableIssueElementIndices
        )

        console.log(`Slug: ${row.slug}`)
        console.log(`Gdoc id: ${row.id}`)
        console.log(`Paragraphs: ${totals.paragraphs}`)
        console.log(
            `Scope directives with trailing text: ${totals.scopeDirectiveLinesWithTrailingText}`
        )
        console.log(
            `Scope directives in multiline paragraphs: ${totals.scopeDirectiveLinesInMultilineParagraph}`
        )
        console.log(
            `Legacy {.heading} directives: ${totals.legacyHeadingDirectiveLines}`
        )
        console.log(
            `Tables outside {.table}: ${totals.tablesOutsideMarkers}`
        )
        console.log(`Inline objects: ${totals.inlineObjectCount}`)
        console.log(`Equations: ${totals.equationCount}`)
        console.log(`Footnotes: ${totals.footnoteCount}`)
        console.log(`Nested list paragraphs: ${totals.listNestedParagraphs}`)
        console.log(
            `Ordered list paragraphs: ${Array.from(
                totals.listGlyphTypeCounts.entries()
            )
                .filter(([glyph]) => ORDERED_GLYPH_TYPES.has(glyph))
                .reduce((sum, [, count]) => sum + count, 0)}`
        )
        console.log(`Checkbox list paragraphs: ${Array.from(
            totals.listGlyphTypeCounts.entries()
        )
            .filter(([glyph]) => glyph.includes("CHECKBOX"))
            .reduce((sum, [, count]) => sum + count, 0)}`)

        const sortedLineIssues = Array.from(lineIssues.values()).sort((a, b) =>
            a.paragraphIndex === b.paragraphIndex
                ? a.lineIndex - b.lineIndex
                : a.paragraphIndex - b.paragraphIndex
        )

        if (sortedLineIssues.length > 0) {
            console.log("Line issues:")
            for (const issue of sortedLineIssues) {
                printLineIssueContext(issue)
            }
        } else {
            console.log("Line issues: none")
        }

        if (tableIssues.length > 0) {
            console.log("Table issues:")
            for (const issue of tableIssues) {
                printTableIssueContext(issue)
            }
        } else {
            console.log("Table issues: none")
        }
    }
}

function formatGlyphTypeCounts(map: Map<string, number>): string {
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return "none"
    return entries.map(([glyph, count]) => `${glyph}=${count}`).join(", ")
}

function printIssueSummary(
    issueSlugs: Map<IssueKey, Set<string>>,
    includeSlugs: boolean
): void {
    for (const [key, label] of Object.entries(
        ISSUE_LABELS
    ) as [IssueKey, string][]) {
        const slugs = issueSlugs.get(key)
        const count = slugs?.size ?? 0
        console.log(`Docs with ${label}: ${count}`)
        if (includeSlugs && slugs && slugs.size > 0) {
            const list = Array.from(slugs).slice(0, MAX_SLUGS_PER_ISSUE)
            const suffix =
                slugs.size > MAX_SLUGS_PER_ISSUE ? " (truncated)" : ""
            console.log(`  ${list.join(", ")}${suffix}`)
        }
    }
}

async function main(parsedArgs: parseArgs.ParsedArgs): Promise<void> {
    const slugArg = parsedArgs["slug"] ?? parsedArgs["s"]
    const includeAll = Boolean(parsedArgs["all"])
    const includeSlugs = Boolean(parsedArgs["list"])
    const limitArg = parsedArgs["limit"] ?? parsedArgs["l"]
    const limit = includeAll && limitArg === undefined
        ? undefined
        : Number(limitArg ?? DEFAULT_LIMIT)
    const viewColumn = (parsedArgs["window"] ??
        parsedArgs["w"] ??
        DEFAULT_VIEW_COLUMN) as ViewColumn

    if (slugArg) {
        const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
        const docsClient = googleDocs({ version: "v1", auth })
        await auditSlug(docsClient, String(slugArg))
        return
    }

    if (!includeAll && !VIEW_COLUMNS.includes(viewColumn)) {
        throw new Error(
            `Invalid --window value. Use one of: ${VIEW_COLUMNS.join(", ")}`
        )
    }

    if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
        throw new Error("--limit must be a positive number.")
    }

    const rows = await fetchGdocs(limit, viewColumn, includeAll)
    if (rows.length === 0) {
        console.log("No gdocs found for the selected criteria.")
        return
    }

    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    const totals = initTotals()
    const issueSlugs = new Map<IssueKey, Set<string>>()

    for (const row of rows) {
        await auditGdoc(docsClient, row, totals, issueSlugs)
    }

    console.log(`Processed ${totals.docs} gdocs`)
    console.log(`Paragraphs: ${totals.paragraphs}`)
    console.log(`Scope directives: ${totals.scopeDirectiveLines}`)
    console.log(
        `Scope directives with trailing text: ${totals.scopeDirectiveLinesWithTrailingText}`
    )
    console.log(
        `Scope directives in multiline paragraphs: ${totals.scopeDirectiveLinesInMultilineParagraph}`
    )
    console.log(
        `Legacy {.heading} directives: ${totals.legacyHeadingDirectiveLines}`
    )
    console.log(`Heading-style paragraphs: ${totals.headingStyleParagraphs}`)
    console.log(`Tables total: ${totals.tablesTotal}`)
    console.log(`Tables outside {.table}: ${totals.tablesOutsideMarkers}`)
    console.log(`Tables inside {.table}: ${totals.tablesInsideMarkers}`)
    console.log(`List paragraphs: ${totals.listParagraphs}`)
    console.log(`List ids: ${totals.listIds.size}`)
    console.log(
        `List glyph types: ${formatGlyphTypeCounts(
            totals.listGlyphTypeCounts
        )}`
    )
    console.log(`Nested list paragraphs: ${totals.listNestedParagraphs}`)
    console.log(`Inline objects: ${totals.inlineObjectCount}`)
    console.log(`Equations: ${totals.equationCount}`)
    console.log(`Footnotes: ${totals.footnoteCount}`)

    printIssueSummary(issueSlugs, includeSlugs)
}

const parsedArgs = parseArgs(process.argv.slice(2))

if (parsedArgs["h"] || parsedArgs["help"]) {
    console.log(`Audit Google Docs for ArchieML / structure assumptions.

Usage:
    yarn tsx devTools/gdocs/auditGdocAssumptions.ts [--limit 200] [--window views_365d]
    yarn tsx devTools/gdocs/auditGdocAssumptions.ts --all [--limit 500]
    yarn tsx devTools/gdocs/auditGdocAssumptions.ts --slug <slug>

Options:
    --limit, -l   Number of gdocs to inspect (default: 200)
    --window, -w  Pageview window (views_7d, views_14d, views_365d)
    --all         Scan all published gdocs (ignores pageviews)
    --list        Print up to ${MAX_SLUGS_PER_ISSUE} slugs per issue
    --slug, -s    Audit a specific gdoc slug with line context
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
