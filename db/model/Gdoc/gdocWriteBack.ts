import { type docs_v1, docs as googleDocs } from "@googleapis/docs"
import {
    type OwidEnrichedGdocBlock,
    type OwidGdocPostContent,
} from "@ourworldindata/utils"
import {
    type GdocParagraph,
    type OwidRawGdocBlock,
    type Span,
} from "@ourworldindata/types"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import {
    getParagraphContentLines,
    parseScopeMarkerLine,
    type ArchieScopeMarker,
    whitespacePattern,
} from "./archieParagraphParser.js"
import { parseBodyParagraphBlocks } from "./archieParagraphBlockParser.js"
import { loadArchieFromLines } from "./archieLineParser.js"
import { documentToParagraphs } from "./gdocAstToParagraphs.js"
import { paragraphsToArchieText } from "./paragraphsToArchie.js"
import { spansToSimpleString } from "./gdocUtils.js"
import { computeBlockFingerprint } from "./gdocSourceMetadata.js"
import { enrichedBlockToRawBlock } from "./enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLStringGenerator } from "./rawToArchie.js"
import { isEqual, isPlainObject } from "lodash-es"

const slugBlacklist = `${whitespacePattern}\\u005B\\u005C\\u005D\\u007B\\u007D\\u003A`
const frontmatterKeyPattern = new RegExp(
    `^(\\s*)([^${slugBlacklist}]+)[ \\t\\r]*:[ \\t\\r]*(.*)$`
)

const SIMPLE_FRONTMATTER_KEYS = new Set([
    "title",
    "supertitle",
    "subtitle",
    "authors",
    "dateline",
    "excerpt",
    "type",
    "sidebar-toc",
    "heading-variant",
    "hide-subscribe-banner",
    "hide-citation",
    "cover-image",
    "cover-color",
    "featured-image",
    "atom-title",
    "atom-excerpt",
])

const UNSUPPORTED_SPAN_TYPES = new Set([
    "span-ref",
    "span-dod",
    "span-guided-chart-link",
])

interface FrontmatterLineLocation {
    key: string
    rawLine: string
    leadingWhitespace: string
    value: string
    startIndex?: number
    endIndex?: number
    paragraphIndex: number
    lineIndex: number
}

export interface GdocTextReplacement {
    startIndex: number
    endIndex: number
    newText: string
    reason: string
}

export interface GdocWriteBackPlan {
    replacements: GdocTextReplacement[]
    requests: docs_v1.Schema$Request[]
    warnings: string[]
    skipped: string[]
}

export interface GdocWriteBackResult extends GdocWriteBackPlan {
    applied: boolean
}

export interface GdocWriteBackOptions {
    dryRun?: boolean
    document?: docs_v1.Schema$Document
    originalContent?: OwidGdocPostContent
}

function normalizeParagraphText(text: string): string {
    return text.replace(/\r/g, "").replace(/\n$/, "")
}

function normalizeReplacementText(text: string): string {
    return normalizeParagraphText(text)
}

function isBodyMarker(marker: ArchieScopeMarker | undefined): boolean {
    return Boolean(
        marker &&
            marker.bracket === "[" &&
            marker.slug === "body" &&
            marker.flags.includes("+")
    )
}

function buildParagraphLineRanges(
    paragraph: GdocParagraph
): FrontmatterLineLocation[] {
    if (paragraph.type !== "paragraph") return []
    const lines = getParagraphContentLines(paragraph.text)
    if (lines.length === 0) return []

    const normalizedText = paragraph.text.replace(/\r/g, "")
    const lineRanges: FrontmatterLineLocation[] = []
    let offset = 0

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? ""
        const startIndex =
            paragraph.startIndex !== undefined
                ? paragraph.startIndex + offset
                : undefined
        const endIndex =
            startIndex !== undefined ? startIndex + line.length : undefined

        lineRanges.push({
            key: "",
            rawLine: line,
            leadingWhitespace: "",
            value: "",
            startIndex,
            endIndex,
            paragraphIndex: paragraph.index,
            lineIndex: i,
        })

        offset += line.length + 1
        if (offset > normalizedText.length) {
            break
        }
    }

    return lineRanges
}

function parseFrontmatterLine(
    line: string
): { key: string; value: string; leadingWhitespace: string } | null {
    const match = frontmatterKeyPattern.exec(line)
    if (!match) return null
    const leadingWhitespace = match[1] ?? ""
    const key = (match[2] ?? "").trim()
    const value = match[3] ?? ""
    if (!key) return null
    return { key, value, leadingWhitespace }
}

function collectFrontmatterLines(
    paragraphs: GdocParagraph[]
): Map<string, FrontmatterLineLocation> {
    const linesByKey = new Map<string, FrontmatterLineLocation>()
    const scopeStack: ArchieScopeMarker[] = []
    let inBody = false

    for (const paragraph of paragraphs) {
        if (inBody) break
        const lineRanges = buildParagraphLineRanges(paragraph)

        for (const lineRange of lineRanges) {
            const line = lineRange.rawLine
            const marker = parseScopeMarkerLine(line)

            if (marker) {
                if (isBodyMarker(marker)) {
                    inBody = true
                    break
                }

                if (marker.slug === "") {
                    scopeStack.pop()
                } else {
                    scopeStack.push(marker)
                }
                continue
            }

            if (scopeStack.length > 0) continue

            const parsed = parseFrontmatterLine(line)
            if (!parsed) continue

            if (!SIMPLE_FRONTMATTER_KEYS.has(parsed.key)) continue
            if (linesByKey.has(parsed.key)) continue

            linesByKey.set(parsed.key, {
                ...lineRange,
                key: parsed.key,
                value: parsed.value,
                leadingWhitespace: parsed.leadingWhitespace,
            })
        }
    }

    return linesByKey
}

function getFrontmatterValue(
    content: OwidGdocPostContent,
    key: string
): string | null {
    const value = content[key as keyof OwidGdocPostContent]
    if (value === undefined || value === null) return null

    if (typeof value === "string") return value
    if (typeof value === "number") return String(value)
    if (typeof value === "boolean") return value ? "true" : "false"

    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        return value.join(", ")
    }

    return null
}

function spanContainsUnsupportedMarkup(span: Span): boolean {
    if (UNSUPPORTED_SPAN_TYPES.has(span.spanType)) return true
    if ("children" in span && Array.isArray(span.children)) {
        return span.children.some(spanContainsUnsupportedMarkup)
    }
    return false
}

function spansContainUnsupportedMarkup(spans: Span[]): boolean {
    return spans.some(spanContainsUnsupportedMarkup)
}

function paragraphHasUnsupportedContent(paragraph: GdocParagraph): boolean {
    if (paragraph.tableContext) return true
    if ((paragraph.inlineObjectIds ?? []).length > 0) return true
    if ((paragraph.footnoteReferenceIds ?? []).length > 0) return true
    if (paragraph.hasEquation) return true
    return false
}

function getParagraphReplaceRange(
    paragraph: GdocParagraph
): { startIndex: number; endIndex: number } | null {
    if (
        paragraph.startIndex === undefined ||
        paragraph.endIndex === undefined
    ) {
        return null
    }

    if (paragraph.endIndex < paragraph.startIndex) return null

    const endIndex = Math.max(paragraph.startIndex, paragraph.endIndex - 1)
    return { startIndex: paragraph.startIndex, endIndex }
}

function buildFrontmatterReplacements(
    linesByKey: Map<string, FrontmatterLineLocation>,
    content: OwidGdocPostContent,
    warnings: string[]
): GdocTextReplacement[] {
    const replacements: GdocTextReplacement[] = []

    for (const [key, line] of linesByKey.entries()) {
        const newValue = getFrontmatterValue(content, key)
        if (newValue === null) continue
        if (newValue.includes("\n")) {
            warnings.push(
                `Skipping frontmatter "${key}" because the value is multiline.`
            )
            continue
        }

        if (line.startIndex === undefined || line.endIndex === undefined) {
            warnings.push(
                `Skipping frontmatter "${key}" because the line range is missing.`
            )
            continue
        }

        const newLine = `${line.leadingWhitespace}${key}: ${newValue}`
        if (newLine === line.rawLine) continue

        replacements.push({
            startIndex: line.startIndex,
            endIndex: line.endIndex,
            newText: newLine,
            reason: `frontmatter:${key}`,
        })
    }

    return replacements
}

function buildTextReplacementForParagraph(
    paragraph: GdocParagraph,
    newText: string,
    reason: string,
    warnings: string[]
): GdocTextReplacement | null {
    if (paragraph.type !== "paragraph") {
        warnings.push(`Skipping ${reason} because paragraph is not text.`)
        return null
    }

    if (paragraphHasUnsupportedContent(paragraph)) {
        warnings.push(
            `Skipping ${reason} because paragraph has unsupported content.`
        )
        return null
    }

    const range = getParagraphReplaceRange(paragraph)
    if (!range) {
        warnings.push(`Skipping ${reason} because paragraph range is missing.`)
        return null
    }

    const normalizedNew = normalizeReplacementText(newText)
    const existing = normalizeParagraphText(paragraph.text)
    if (normalizedNew === existing) return null

    return {
        startIndex: range.startIndex,
        endIndex: range.endIndex,
        newText: normalizedNew,
        reason,
    }
}

function buildTextReplacementForRange(
    paragraphs: GdocParagraph[],
    paragraphStart: number,
    paragraphEnd: number,
    newText: string,
    reason: string,
    warnings: string[]
): GdocTextReplacement | null {
    const startParagraph = paragraphs[paragraphStart]
    const endParagraph = paragraphs[paragraphEnd]
    if (!startParagraph || !endParagraph) {
        warnings.push(`Skipping ${reason} because range is missing.`)
        return null
    }

    if (
        startParagraph.startIndex === undefined ||
        endParagraph.endIndex === undefined
    ) {
        warnings.push(`Skipping ${reason} because range indices are missing.`)
        return null
    }

    const rangeParagraphs = paragraphs.slice(
        paragraphStart,
        paragraphEnd + 1
    )
    if (rangeParagraphs.some(paragraphHasUnsupportedContent)) {
        warnings.push(
            `Skipping ${reason} because the range has unsupported content.`
        )
        return null
    }

    const normalizedNew = normalizeReplacementText(newText)
    return {
        startIndex: startParagraph.startIndex,
        endIndex: Math.max(startParagraph.startIndex, endParagraph.endIndex - 1),
        newText: normalizedNew,
        reason,
    }
}

function blockToArchieText(block: OwidEnrichedGdocBlock): string {
    const rawBlock = enrichedBlockToRawBlock(block)
    const lines = [...OwidRawGdocBlockToArchieMLStringGenerator(rawBlock)]
    return lines.join("\n")
}

function rawBlockToArchieText(block: OwidRawGdocBlock): string {
    const lines = [...OwidRawGdocBlockToArchieMLStringGenerator(block)]
    return lines.join("\n")
}

function splitArchieLines(text: string): string[] {
    const normalized = text.replace(/\r/g, "")
    return normalized.split("\n")
}

function isRawBlock(value: unknown): value is OwidRawGdocBlock {
    return Boolean(value && typeof value === "object" && "type" in value)
}

function parseRawBlockFromParagraphs(
    paragraphs: GdocParagraph[]
): OwidRawGdocBlock | null {
    const archieText = paragraphsToArchieText(paragraphs)
    const wrappedText = `[+body]\n${archieText}\n[]`
    const parsed = loadArchieFromLines(splitArchieLines(wrappedText))
    const rawBody = parsed.body
    if (!Array.isArray(rawBody)) return null
    const block = rawBody.find((entry) => isRawBlock(entry))
    return block ?? null
}

function mergeRawValues(
    currentValue: unknown,
    originalValue: unknown,
    updatedValue: unknown
): unknown {
    if (isEqual(originalValue, updatedValue)) return currentValue

    if (Array.isArray(updatedValue) || Array.isArray(originalValue)) {
        return updatedValue
    }

    if (
        isPlainObject(updatedValue) &&
        isPlainObject(originalValue) &&
        isPlainObject(currentValue)
    ) {
        const merged: Record<string, unknown> = {
            ...(currentValue as Record<string, unknown>),
        }
        const originalObj = originalValue as Record<string, unknown>
        const updatedObj = updatedValue as Record<string, unknown>
        const keys = new Set([
            ...Object.keys(originalObj),
            ...Object.keys(updatedObj),
        ])

        keys.forEach((key) => {
            const hasUpdated = Object.hasOwn(updatedObj, key)
            const hasOriginal = Object.hasOwn(originalObj, key)
            const hasCurrent = Object.hasOwn(merged, key)
            const nextOriginal = hasOriginal ? originalObj[key] : undefined
            const nextUpdated = hasUpdated ? updatedObj[key] : undefined
            const nextCurrent = hasCurrent ? merged[key] : undefined

            if (!hasUpdated && hasOriginal) {
                if (hasCurrent) delete merged[key]
                return
            }

            if (isEqual(nextOriginal, nextUpdated)) return

            merged[key] = mergeRawValues(nextCurrent, nextOriginal, nextUpdated)
        })

        return merged
    }

    return updatedValue
}

function mergeRawBlocks(
    currentBlock: OwidRawGdocBlock,
    originalBlock: OwidRawGdocBlock,
    updatedBlock: OwidRawGdocBlock
): OwidRawGdocBlock {
    if (currentBlock.type !== updatedBlock.type) return updatedBlock
    if (originalBlock.type !== updatedBlock.type) return updatedBlock

    const currentValue = (currentBlock as Record<string, unknown>).value
    const originalValue = (originalBlock as Record<string, unknown>).value
    const updatedValue = (updatedBlock as Record<string, unknown>).value

    if (updatedValue === undefined) return updatedBlock

    const mergedValue = mergeRawValues(
        currentValue,
        originalValue,
        updatedValue
    )

    return {
        ...updatedBlock,
        value: mergedValue,
    } as OwidRawGdocBlock
}

function buildOriginalBlockLookup(
    blocks: OwidEnrichedGdocBlock[] | undefined
): Map<string, OwidEnrichedGdocBlock> {
    const lookup = new Map<string, OwidEnrichedGdocBlock>()
    if (!blocks) return lookup

    for (const block of blocks) {
        const source = block._source
        if (
            source &&
            source.paragraphStart !== undefined &&
            source.paragraphEnd !== undefined
        ) {
            const key = `${source.paragraphStart}:${source.paragraphEnd}`
            if (!lookup.has(key)) {
                lookup.set(key, block)
            }
        }
    }

    return lookup
}

function buildBodyReplacements(
    blocks: OwidEnrichedGdocBlock[] | undefined,
    paragraphs: GdocParagraph[],
    originalBlocks: OwidEnrichedGdocBlock[] | undefined,
    warnings: string[],
    skipped: string[]
): GdocTextReplacement[] {
    if (!blocks || blocks.length === 0) return []

    const replacements: GdocTextReplacement[] = []
    const originalLookup = buildOriginalBlockLookup(originalBlocks)

    blocks.forEach((block, index) => {
        const source = block._source
        if (
            !source ||
            source.paragraphStart === undefined ||
            source.paragraphEnd === undefined
        ) {
            skipped.push(`body[${index}]: missing source range`)
            return
        }

        if (!source.fingerprint) {
            skipped.push(`body[${index}]: missing source fingerprint`)
            return
        }

        const nextFingerprint = computeBlockFingerprint(block)
        if (nextFingerprint === source.fingerprint) return

        const paragraphStart = source.paragraphStart
        const paragraphEnd = source.paragraphEnd
        if (
            paragraphStart < 0 ||
            paragraphEnd < paragraphStart ||
            paragraphEnd >= paragraphs.length
        ) {
            warnings.push(
                `Skipping body[${index}] because source range is out of bounds.`
            )
            return
        }
        const rangeParagraphs = paragraphs.slice(
            paragraphStart,
            paragraphEnd + 1
        )

        if (rangeParagraphs.length === 0) {
            warnings.push(`Skipping body[${index}] because range is empty.`)
            return
        }

        if (block.type === "text") {
            if (spansContainUnsupportedMarkup(block.value)) {
                warnings.push(
                    `Skipping body[${index}] text because it contains refs or guided links.`
                )
                return
            }
            if (rangeParagraphs.length !== 1) {
                warnings.push(
                    `Skipping body[${index}] text because it spans multiple paragraphs.`
                )
                return
            }
            const paragraph = rangeParagraphs[0]
            const text = spansToSimpleString(block.value)
            const replacement = buildTextReplacementForParagraph(
                paragraph,
                text,
                `body[${index}]:text`,
                warnings
            )
            if (replacement) replacements.push(replacement)
            return
        }

        if (block.type === "heading") {
            const supertitle = block.supertitle
                ? spansToSimpleString(block.supertitle)
                : undefined
            const title = spansToSimpleString(block.text)
            if (
                spansContainUnsupportedMarkup(block.text) ||
                (block.supertitle &&
                    spansContainUnsupportedMarkup(block.supertitle))
            ) {
                warnings.push(
                    `Skipping body[${index}] heading because it contains refs or guided links.`
                )
                return
            }
            if (rangeParagraphs.length !== 1) {
                warnings.push(
                    `Skipping body[${index}] heading because it spans multiple paragraphs.`
                )
                return
            }
            const paragraph = rangeParagraphs[0]
            const text = supertitle ? `${supertitle}\u000b${title}` : title
            const replacement = buildTextReplacementForParagraph(
                paragraph,
                text,
                `body[${index}]:heading`,
                warnings
            )
            if (replacement) replacements.push(replacement)
            return
        }

        if (block.type === "list" || block.type === "numbered-list") {
            const items = block.items
            if (items.length !== rangeParagraphs.length) {
                warnings.push(
                    `Skipping body[${index}] list because item count does not match paragraph count.`
                )
                return
            }

            if (
                items.some((item) => spansContainUnsupportedMarkup(item.value))
            ) {
                warnings.push(
                    `Skipping body[${index}] list because it contains refs or guided links.`
                )
                return
            }

            items.forEach((item, itemIndex) => {
                const paragraph = rangeParagraphs[itemIndex]
                if (!paragraph) return
                const text = spansToSimpleString(item.value)
                const replacement = buildTextReplacementForParagraph(
                    paragraph,
                    text,
                    `body[${index}]:list:${itemIndex}`,
                    warnings
                )
                if (replacement) replacements.push(replacement)
            })
            return
        }

        const key = `${paragraphStart}:${paragraphEnd}`
        const originalBlock = originalLookup.get(key)
        const updatedRaw = enrichedBlockToRawBlock(block)
        const currentRaw = parseRawBlockFromParagraphs(rangeParagraphs)

        let replacementText = blockToArchieText(block)
        if (currentRaw && originalBlock) {
            const originalRaw = enrichedBlockToRawBlock(originalBlock)
            const mergedRaw = mergeRawBlocks(
                currentRaw,
                originalRaw,
                updatedRaw
            )
            replacementText = rawBlockToArchieText(mergedRaw)
        }

        const replacement = buildTextReplacementForRange(
            paragraphs,
            paragraphStart,
            paragraphEnd,
            replacementText,
            `body[${index}]:${block.type}`,
            warnings
        )
        if (replacement) {
            replacements.push(replacement)
        } else {
            skipped.push(`body[${index}]: ${block.type} replacement skipped`)
        }
    })

    return replacements
}

function replacementsOverlap(replacements: GdocTextReplacement[]): boolean {
    const sorted = [...replacements].sort(
        (a, b) => a.startIndex - b.startIndex
    )

    for (let i = 1; i < sorted.length; i++) {
        const previous = sorted[i - 1]
        const current = sorted[i]
        if (previous.endIndex > current.startIndex) {
            return true
        }
    }

    return false
}

function buildRequestsFromReplacements(
    replacements: GdocTextReplacement[],
    warnings: string[]
): docs_v1.Schema$Request[] {
    if (replacements.length === 0) return []
    if (replacementsOverlap(replacements)) {
        warnings.push("Skipping write-back because replacements overlap.")
        return []
    }

    const sorted = [...replacements].sort(
        (a, b) => b.startIndex - a.startIndex
    )
    const requests: docs_v1.Schema$Request[] = []

    for (const replacement of sorted) {
        if (replacement.endIndex > replacement.startIndex) {
            requests.push({
                deleteContentRange: {
                    range: {
                        startIndex: replacement.startIndex,
                        endIndex: replacement.endIndex,
                    },
                },
            })
        }

        if (replacement.newText.length > 0) {
            requests.push({
                insertText: {
                    location: { index: replacement.startIndex },
                    text: replacement.newText,
                },
            })
        }
    }

    return requests
}

export function buildGdocWriteBackPlan(
    document: docs_v1.Schema$Document,
    content: OwidGdocPostContent,
    originalContent?: OwidGdocPostContent
): GdocWriteBackPlan {
    const warnings: string[] = []
    const skipped: string[] = []

    const paragraphs = documentToParagraphs(document)
    const { bodyRange } = parseBodyParagraphBlocks(paragraphs)

    const frontmatterParagraphs = bodyRange
        ? paragraphs.slice(0, Math.max(0, bodyRange.paragraphStart))
        : paragraphs

    const frontmatterLines = collectFrontmatterLines(frontmatterParagraphs)
    const replacements = [
        ...buildFrontmatterReplacements(frontmatterLines, content, warnings),
        ...buildBodyReplacements(
            content.body,
            paragraphs,
            originalContent?.body,
            warnings,
            skipped
        ),
    ]

    const requests = buildRequestsFromReplacements(replacements, warnings)

    return {
        replacements,
        requests,
        warnings,
        skipped,
    }
}

export async function applyGdocWriteBack(
    documentId: string,
    content: OwidGdocPostContent,
    options: GdocWriteBackOptions = {}
): Promise<GdocWriteBackResult> {
    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    const document =
        options.document ??
        (
            await docsClient.documents.get({
                documentId,
                suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
            })
        ).data

    const plan = buildGdocWriteBackPlan(
        document,
        content,
        options.originalContent
    )
    if (options.dryRun || plan.requests.length === 0) {
        return { ...plan, applied: false }
    }

    await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: plan.requests },
    })

    return { ...plan, applied: true }
}
