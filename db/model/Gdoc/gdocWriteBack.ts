import { type docs_v1, docs as googleDocs } from "@googleapis/docs"
import {
    type OwidEnrichedGdocBlock,
    type OwidGdocPostContent,
} from "@ourworldindata/utils"
import {
    type GdocParagraph,
    type GdocParagraphRange,
    type OwidRawGdocBlock,
    type Span,
} from "@ourworldindata/types"
import { OwidGoogleAuth } from "../../OwidGoogleAuth.js"
import {
    getParagraphContentLines,
    parseScopeMarkerParagraph,
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

interface TextStyleFragment {
    text: string
    style: docs_v1.Schema$TextStyle
}

export interface GdocTextReplacement {
    startIndex: number
    endIndex: number
    newText: string
    reason: string
    styleFragments?: TextStyleFragment[]
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

function ensureTrailingNewline(text: string): string {
    if (!text) return "\n"
    return text.endsWith("\n") ? text : `${text}\n`
}

const defaultTextStyle: docs_v1.Schema$TextStyle = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    baselineOffset: "NONE",
    link: undefined,
}

function mergeStyleStack(
    styleStack: docs_v1.Schema$TextStyle[]
): docs_v1.Schema$TextStyle {
    return styleStack.reduce(
        (acc, style) => ({
            ...acc,
            ...style,
        }),
        { ...defaultTextStyle }
    )
}

function spansToTextFragments(
    spans: Span[],
    styleStack: docs_v1.Schema$TextStyle[] = []
): TextStyleFragment[] {
    const fragments: TextStyleFragment[] = []

    for (const span of spans) {
        switch (span.spanType) {
            case "span-simple-text": {
                if (span.text) {
                    fragments.push({
                        text: span.text,
                        style: mergeStyleStack(styleStack),
                    })
                }
                break
            }
            case "span-newline": {
                fragments.push({
                    text: "\n",
                    style: mergeStyleStack(styleStack),
                })
                break
            }
            case "span-link": {
                const nextStack = [
                    ...styleStack,
                    {
                        link: {
                            url: span.url ?? "",
                        },
                    },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack)
                )
                break
            }
            case "span-italic": {
                const nextStack = [...styleStack, { italic: true }]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack)
                )
                break
            }
            case "span-bold": {
                const nextStack = [...styleStack, { bold: true }]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack)
                )
                break
            }
            case "span-underline": {
                const nextStack = [...styleStack, { underline: true }]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack)
                )
                break
            }
            case "span-subscript": {
                const nextStack = [
                    ...styleStack,
                    { baselineOffset: "SUBSCRIPT" },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack)
                )
                break
            }
            case "span-superscript": {
                const nextStack = [
                    ...styleStack,
                    { baselineOffset: "SUPERSCRIPT" },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack)
                )
                break
            }
            case "span-quote":
            case "span-fallback": {
                fragments.push(
                    ...spansToTextFragments(span.children, styleStack)
                )
                break
            }
            default: {
                if ("children" in span && Array.isArray(span.children)) {
                    fragments.push(
                        ...spansToTextFragments(span.children, styleStack)
                    )
                }
                break
            }
        }
    }

    return fragments
}

function mergeAdjacentFragments(
    fragments: TextStyleFragment[]
): TextStyleFragment[] {
    const merged: TextStyleFragment[] = []
    for (const fragment of fragments) {
        if (!fragment.text) continue
        const last = merged[merged.length - 1]
        if (last && isEqual(last.style, fragment.style)) {
            last.text += fragment.text
            continue
        }
        merged.push({ ...fragment })
    }
    return merged
}

function isDefaultStyle(style: docs_v1.Schema$TextStyle): boolean {
    return (
        !style.bold &&
        !style.italic &&
        !style.underline &&
        !style.strikethrough &&
        (style.baselineOffset === undefined ||
            style.baselineOffset === "NONE") &&
        (!style.link || !style.link.url)
    )
}

function trimFragmentsToLength(
    fragments: TextStyleFragment[],
    length: number
): TextStyleFragment[] {
    if (length <= 0) return []
    const trimmed: TextStyleFragment[] = []
    let remaining = length

    for (const fragment of fragments) {
        if (remaining <= 0) break
        if (fragment.text.length <= remaining) {
            trimmed.push(fragment)
            remaining -= fragment.text.length
            continue
        }
        trimmed.push({
            ...fragment,
            text: fragment.text.slice(0, remaining),
        })
        remaining = 0
    }

    return trimmed
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

    if (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
    ) {
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
    warnings: string[],
    options: { allowSameText?: boolean } = {}
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
    if (normalizedNew === existing && !options.allowSameText) return null

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

    const rangeParagraphs = paragraphs.slice(paragraphStart, paragraphEnd + 1)
    if (rangeParagraphs.some(paragraphHasUnsupportedContent)) {
        warnings.push(
            `Skipping ${reason} because the range has unsupported content.`
        )
        return null
    }

    const normalizedNew = normalizeReplacementText(newText)
    return {
        startIndex: startParagraph.startIndex,
        endIndex: Math.max(
            startParagraph.startIndex,
            endParagraph.endIndex - 1
        ),
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

function getSourceKey(block: OwidEnrichedGdocBlock | undefined): string | null {
    const source = block?._source
    if (
        !source ||
        source.paragraphStart === undefined ||
        source.paragraphEnd === undefined
    ) {
        return null
    }
    return `${source.paragraphStart}:${source.paragraphEnd}`
}

function buildSourceKeySequence(
    blocks: OwidEnrichedGdocBlock[] | undefined
): string[] {
    if (!blocks) return []
    return blocks
        .map((block) => getSourceKey(block))
        .filter((key): key is string => Boolean(key))
}

function computeStableSourceKeys(
    originalBlocks: OwidEnrichedGdocBlock[] | undefined,
    updatedBlocks: OwidEnrichedGdocBlock[] | undefined
): Set<string> {
    const updatedKeys = buildSourceKeySequence(updatedBlocks)
    if (!originalBlocks || !updatedBlocks) {
        return new Set(updatedKeys)
    }

    const originalKeys = buildSourceKeySequence(originalBlocks)
    const dp: number[][] = Array.from({ length: originalKeys.length + 1 }, () =>
        new Array<number>(updatedKeys.length + 1).fill(0)
    )

    for (let i = originalKeys.length - 1; i >= 0; i--) {
        for (let j = updatedKeys.length - 1; j >= 0; j--) {
            if (originalKeys[i] === updatedKeys[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
            }
        }
    }

    const lcsKeys: string[] = []
    let i = 0
    let j = 0
    while (i < originalKeys.length && j < updatedKeys.length) {
        if (originalKeys[i] === updatedKeys[j]) {
            lcsKeys.push(originalKeys[i])
            i += 1
            j += 1
            continue
        }
        if (dp[i + 1][j] >= dp[i][j + 1]) {
            i += 1
        } else {
            j += 1
        }
    }

    return new Set(lcsKeys)
}

function getBodyClosingMarkerIndex(
    paragraphs: GdocParagraph[],
    bodyRange: GdocParagraphRange | undefined,
    hasBodyMarker: boolean
): number | null {
    if (!hasBodyMarker || !bodyRange) return null
    const candidateIndex = bodyRange.paragraphEnd + 1
    const paragraph = paragraphs[candidateIndex]
    if (!paragraph) return null
    const marker = parseScopeMarkerParagraph(paragraph)
    if (!marker) return null
    if (marker.bracket === "[" && marker.slug === "") {
        return candidateIndex
    }
    return null
}

function getInsertionIndex(
    paragraphs: GdocParagraph[],
    bodyRange: GdocParagraphRange | undefined,
    hasBodyMarker: boolean,
    previousSource: GdocParagraphRange | undefined,
    nextSource: GdocParagraphRange | undefined
): number | null {
    if (nextSource) {
        const nextParagraph = paragraphs[nextSource.paragraphStart]
        return nextParagraph?.startIndex ?? null
    }

    const closingMarkerIndex = getBodyClosingMarkerIndex(
        paragraphs,
        bodyRange,
        hasBodyMarker
    )
    if (closingMarkerIndex !== null) {
        return paragraphs[closingMarkerIndex]?.startIndex ?? null
    }

    if (previousSource) {
        const lastParagraph = paragraphs[previousSource.paragraphEnd]
        return lastParagraph?.endIndex ?? null
    }

    if (bodyRange) {
        const firstBodyParagraph = paragraphs[bodyRange.paragraphStart]
        return firstBodyParagraph?.startIndex ?? null
    }

    return paragraphs[0]?.startIndex ?? null
}

function mergeInsertions(
    replacements: GdocTextReplacement[]
): GdocTextReplacement[] {
    const merged: GdocTextReplacement[] = []
    const insertions = new Map<number, GdocTextReplacement>()

    for (const replacement of replacements) {
        const isInsertion = replacement.startIndex === replacement.endIndex
        if (!isInsertion) {
            merged.push(replacement)
            continue
        }

        const existing = insertions.get(replacement.startIndex)
        if (existing) {
            existing.newText += replacement.newText
            existing.reason = `${existing.reason},${replacement.reason}`
            continue
        }

        insertions.set(replacement.startIndex, { ...replacement })
    }

    merged.push(...insertions.values())
    return merged
}

function buildDeletionReplacement(
    paragraphs: GdocParagraph[],
    paragraphStart: number,
    paragraphEnd: number,
    reason: string,
    warnings: string[]
): GdocTextReplacement | null {
    const startParagraph = paragraphs[paragraphStart]
    const endParagraph = paragraphs[paragraphEnd]
    if (!startParagraph || !endParagraph) {
        warnings.push(`Skipping ${reason} because the range is missing.`)
        return null
    }
    if (
        startParagraph.startIndex === undefined ||
        endParagraph.endIndex === undefined
    ) {
        warnings.push(
            `Skipping ${reason} because the range indices are missing.`
        )
        return null
    }
    if (endParagraph.endIndex <= startParagraph.startIndex) {
        warnings.push(`Skipping ${reason} because the range is empty.`)
        return null
    }
    return {
        startIndex: startParagraph.startIndex,
        endIndex: endParagraph.endIndex,
        newText: "",
        reason,
    }
}

function buildBodyDeletions(
    originalBlocks: OwidEnrichedGdocBlock[] | undefined,
    updatedBlocks: OwidEnrichedGdocBlock[] | undefined,
    paragraphs: GdocParagraph[],
    warnings: string[],
    stableSourceKeys: Set<string>
): GdocTextReplacement[] {
    if (!originalBlocks || originalBlocks.length === 0) return []

    const deletions: GdocTextReplacement[] = []

    originalBlocks.forEach((block, index) => {
        const key = getSourceKey(block)
        if (!key || stableSourceKeys.has(key)) return
        const source = block._source
        if (!source) return

        const deletion = buildDeletionReplacement(
            paragraphs,
            source.paragraphStart,
            source.paragraphEnd,
            `body[${index}]:delete:${block.type}`,
            warnings
        )
        if (deletion) deletions.push(deletion)
    })

    return deletions
}

function buildBodyReplacements(
    blocks: OwidEnrichedGdocBlock[] | undefined,
    paragraphs: GdocParagraph[],
    originalBlocks: OwidEnrichedGdocBlock[] | undefined,
    bodyRange: GdocParagraphRange | undefined,
    hasBodyMarker: boolean,
    stableSourceKeys: Set<string>,
    warnings: string[],
    skipped: string[]
): GdocTextReplacement[] {
    if (!blocks || blocks.length === 0) return []

    const replacements: GdocTextReplacement[] = []
    const originalLookup = buildOriginalBlockLookup(originalBlocks)
    const nextAnchorByIndex = new Array<number>(blocks.length)
    let nextAnchorIndex: number | null = null

    for (let i = blocks.length - 1; i >= 0; i--) {
        nextAnchorByIndex[i] = nextAnchorIndex ?? -1
        const sourceKey = getSourceKey(blocks[i])
        if (sourceKey && stableSourceKeys.has(sourceKey)) {
            nextAnchorIndex = i
        }
    }

    let lastAnchorBlockIndex: number | null = null

    blocks.forEach((block, index) => {
        const source = block._source
        const sourceKey = getSourceKey(block)
        const isStableAnchor =
            sourceKey !== null && stableSourceKeys.has(sourceKey)

        if (
            !source ||
            source.paragraphStart === undefined ||
            source.paragraphEnd === undefined ||
            !isStableAnchor
        ) {
            const nextAnchorBlock =
                nextAnchorByIndex[index] >= 0
                    ? blocks[nextAnchorByIndex[index]]
                    : undefined
            const previousAnchorBlock =
                lastAnchorBlockIndex !== null
                    ? blocks[lastAnchorBlockIndex]
                    : undefined
            const insertionIndex = getInsertionIndex(
                paragraphs,
                bodyRange,
                hasBodyMarker,
                previousAnchorBlock?._source,
                nextAnchorBlock?._source
            )

            if (insertionIndex === null) {
                warnings.push(
                    `Skipping body[${index}] insertion because insertion index is missing.`
                )
                return
            }

            let insertionText = blockToArchieText(block)
            if (
                source &&
                source.paragraphStart !== undefined &&
                source.paragraphEnd !== undefined
            ) {
                const rangeParagraphs = paragraphs.slice(
                    source.paragraphStart,
                    source.paragraphEnd + 1
                )
                const currentRaw = parseRawBlockFromParagraphs(rangeParagraphs)
                if (currentRaw && sourceKey) {
                    const originalBlock = originalLookup.get(sourceKey)
                    if (originalBlock) {
                        const originalRaw =
                            enrichedBlockToRawBlock(originalBlock)
                        const updatedRaw = enrichedBlockToRawBlock(block)
                        const mergedRaw = mergeRawBlocks(
                            currentRaw,
                            originalRaw,
                            updatedRaw
                        )
                        insertionText = rawBlockToArchieText(mergedRaw)
                    }
                }
            }

            const normalizedInsertion = ensureTrailingNewline(insertionText)
            replacements.push({
                startIndex: insertionIndex,
                endIndex: insertionIndex,
                newText: normalizedInsertion,
                reason: `body[${index}]:insert:${block.type}`,
            })
            return
        }

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

        const nextFingerprint = computeBlockFingerprint(block)
        lastAnchorBlockIndex = index

        if (!source.fingerprint) {
            skipped.push(`body[${index}]: missing source fingerprint`)
            return
        }

        if (nextFingerprint === source.fingerprint) return
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
            if (paragraph.type !== "paragraph") {
                warnings.push(
                    `Skipping body[${index}] text because paragraph is not text.`
                )
                return
            }
            const fragments = mergeAdjacentFragments(
                spansToTextFragments(block.value)
            )
            const text = fragments.map((fragment) => fragment.text).join("")
            const normalizedText = normalizeReplacementText(text)
            const trimmedFragments = trimFragmentsToLength(
                fragments,
                normalizedText.length
            )
            const textMatches =
                normalizedText === normalizeParagraphText(paragraph.text)
            const spansMatch = isEqual(paragraph.spans, block.value)
            if (textMatches && spansMatch) return
            const replacement = buildTextReplacementForParagraph(
                paragraph,
                normalizedText,
                `body[${index}]:text`,
                warnings,
                { allowSameText: textMatches && !spansMatch }
            )
            if (replacement) {
                if (
                    trimmedFragments.some(
                        (fragment) => !isDefaultStyle(fragment.style)
                    )
                ) {
                    replacement.styleFragments = trimmedFragments
                }
                replacements.push(replacement)
            }
            return
        }

        if (block.type === "heading") {
            const supertitle = block.supertitle
                ? spansToSimpleString(block.supertitle)
                : undefined
            const title = spansToSimpleString(block.text)
            const combinedSpans = block.supertitle
                ? [
                      ...block.supertitle,
                      { spanType: "span-simple-text", text: "\u000b" } as Span,
                      ...block.text,
                  ]
                : block.text
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
            if (paragraph.type !== "paragraph") {
                warnings.push(
                    `Skipping body[${index}] heading because paragraph is not text.`
                )
                return
            }
            const text = supertitle ? `${supertitle}\u000b${title}` : title
            const fragments = mergeAdjacentFragments(
                spansToTextFragments(combinedSpans)
            )
            const normalizedText = normalizeReplacementText(text)
            const trimmedFragments = trimFragmentsToLength(
                fragments,
                normalizedText.length
            )
            const textMatches =
                normalizedText === normalizeParagraphText(paragraph.text)
            const spansMatch = isEqual(paragraph.spans, combinedSpans)
            if (textMatches && spansMatch) return
            const replacement = buildTextReplacementForParagraph(
                paragraph,
                normalizedText,
                `body[${index}]:heading`,
                warnings,
                { allowSameText: textMatches && !spansMatch }
            )
            if (replacement) {
                if (
                    trimmedFragments.some(
                        (fragment) => !isDefaultStyle(fragment.style)
                    )
                ) {
                    replacement.styleFragments = trimmedFragments
                }
                replacements.push(replacement)
            }
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
                if (paragraph.type !== "paragraph") {
                    warnings.push(
                        `Skipping body[${index}] list item because paragraph is not text.`
                    )
                    return
                }
                const fragments = mergeAdjacentFragments(
                    spansToTextFragments(item.value)
                )
                const text = fragments.map((fragment) => fragment.text).join("")
                const normalizedText = normalizeReplacementText(text)
                const trimmedFragments = trimFragmentsToLength(
                    fragments,
                    normalizedText.length
                )
                const textMatches =
                    normalizedText === normalizeParagraphText(paragraph.text)
                const spansMatch = isEqual(paragraph.spans, item.value)
                if (textMatches && spansMatch) return
                const replacement = buildTextReplacementForParagraph(
                    paragraph,
                    normalizedText,
                    `body[${index}]:list:${itemIndex}`,
                    warnings,
                    { allowSameText: textMatches && !spansMatch }
                )
                if (replacement) {
                    if (
                        trimmedFragments.some(
                            (fragment) => !isDefaultStyle(fragment.style)
                        )
                    ) {
                        replacement.styleFragments = trimmedFragments
                    }
                    replacements.push(replacement)
                }
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

    return mergeInsertions(replacements)
}

function replacementsOverlap(replacements: GdocTextReplacement[]): boolean {
    const sorted = [...replacements].sort((a, b) => a.startIndex - b.startIndex)

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

    const sorted = [...replacements].sort((a, b) => b.startIndex - a.startIndex)
    const requests: docs_v1.Schema$Request[] = []
    const styleFields =
        "bold,italic,underline,strikethrough,baselineOffset,link"
    const resetStyle: docs_v1.Schema$TextStyle = {
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        baselineOffset: "NONE",
        link: { url: null },
    }

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

        if (replacement.styleFragments) {
            if (replacement.newText.length > 0) {
                requests.push({
                    updateTextStyle: {
                        range: {
                            startIndex: replacement.startIndex,
                            endIndex:
                                replacement.startIndex +
                                replacement.newText.length,
                        },
                        textStyle: resetStyle,
                        fields: styleFields,
                    },
                })
            }
            let offset = 0
            for (const fragment of replacement.styleFragments) {
                const length = fragment.text.length
                if (length <= 0) continue
                if (!isDefaultStyle(fragment.style)) {
                    requests.push({
                        updateTextStyle: {
                            range: {
                                startIndex: replacement.startIndex + offset,
                                endIndex:
                                    replacement.startIndex + offset + length,
                            },
                            textStyle: fragment.style,
                            fields: styleFields,
                        },
                    })
                }
                offset += length
            }
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
    const { bodyRange, hasBodyMarker } = parseBodyParagraphBlocks(paragraphs)
    const stableSourceKeys = computeStableSourceKeys(
        originalContent?.body,
        content.body
    )

    const frontmatterParagraphs = bodyRange
        ? paragraphs.slice(0, Math.max(0, bodyRange.paragraphStart))
        : paragraphs

    const frontmatterLines = collectFrontmatterLines(frontmatterParagraphs)
    const bodyReplacements = buildBodyReplacements(
        content.body,
        paragraphs,
        originalContent?.body,
        bodyRange,
        hasBodyMarker,
        stableSourceKeys,
        warnings,
        skipped
    )
    const bodyDeletions = buildBodyDeletions(
        originalContent?.body,
        content.body,
        paragraphs,
        warnings,
        stableSourceKeys
    )
    const replacements = [
        ...buildFrontmatterReplacements(frontmatterLines, content, warnings),
        ...bodyReplacements,
        ...bodyDeletions,
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
