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
    type SpanRef,
    type Ref,
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
const frontmatterCommandPattern = new RegExp(
    "^\\s*:[ \\t\\r]*(endskip|ignore|skip|end).*?$",
    "i"
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

const UNSUPPORTED_SPAN_TYPES = new Set<string>()
const refNotePattern = /#note-(\d+)/

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

interface FrontmatterValueLocation {
    key: string
    leadingWhitespace: string
    lines: FrontmatterLineLocation[]
    endCommandLine?: FrontmatterLineLocation
}

interface TextStyleFragment {
    text: string
    style: docs_v1.Schema$TextStyle
}

interface SpanFragmentOptions {
    refTokens?: Map<number, string>
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

interface ListItemUpdate {
    normalizedText: string
    trimmedFragments: TextStyleFragment[]
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

function isSha1Id(id: string): boolean {
    return /^[a-f0-9]{40}$/i.test(id)
}

function extractInlineRefText(ref: Ref): string | null {
    const firstBlock = ref.content[0]
    if (!firstBlock || firstBlock.type !== "text") return null
    const text = spansToSimpleString(firstBlock.value)
    if (!text.trim()) return null
    if (/[\r\n]/.test(text)) return null
    if (/[{}]/.test(text)) return null
    return text
}

function buildRefTokenLookup(
    content: OwidGdocPostContent
): Map<number, string> {
    const lookup = new Map<number, string>()
    const definitions = content.refs?.definitions ?? {}
    Object.values(definitions).forEach((ref) => {
        if (ref.index < 0) return
        let token = ref.id
        if (isSha1Id(ref.id)) {
            const inlineText = extractInlineRefText(ref)
            if (inlineText) token = inlineText
        }
        lookup.set(ref.index + 1, token)
    })
    return lookup
}

function extractRefNumber(span: SpanRef): number | null {
    const match = span.url?.match(refNotePattern)
    if (match) {
        const parsed = Number.parseInt(match[1], 10)
        return Number.isFinite(parsed) ? parsed : null
    }
    const fallbackText = spansToSimpleString(span.children)
    const fallbackMatch = fallbackText.match(/\d+/)
    if (!fallbackMatch) return null
    const parsed = Number.parseInt(fallbackMatch[0], 10)
    return Number.isFinite(parsed) ? parsed : null
}

function resolveRefToken(
    span: SpanRef,
    refTokens: Map<number, string> | undefined
): string | null {
    if (!refTokens) return null
    const refNumber = extractRefNumber(span)
    if (refNumber === null) return null
    return refTokens.get(refNumber) ?? null
}

function spansToTextFragments(
    spans: Span[],
    styleStack: docs_v1.Schema$TextStyle[] = [],
    options: SpanFragmentOptions = {}
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
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-ref": {
                const refToken = resolveRefToken(span, options.refTokens)
                if (refToken) {
                    fragments.push({
                        text: `{ref}${refToken}{/ref}`,
                        style: mergeStyleStack(styleStack),
                    })
                }
                break
            }
            case "span-dod": {
                const nextStack = [
                    ...styleStack,
                    {
                        link: {
                            url: `#dod:${span.id}`,
                        },
                    },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-guided-chart-link": {
                const nextStack = [
                    ...styleStack,
                    {
                        link: {
                            url: `#guide:${span.url}`,
                        },
                    },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-italic": {
                const nextStack = [...styleStack, { italic: true }]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-bold": {
                const nextStack = [...styleStack, { bold: true }]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-underline": {
                const nextStack = [...styleStack, { underline: true }]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-subscript": {
                const nextStack = [
                    ...styleStack,
                    { baselineOffset: "SUBSCRIPT" },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-superscript": {
                const nextStack = [
                    ...styleStack,
                    { baselineOffset: "SUPERSCRIPT" },
                ]
                fragments.push(
                    ...spansToTextFragments(span.children, nextStack, options)
                )
                break
            }
            case "span-quote":
            case "span-fallback": {
                fragments.push(
                    ...spansToTextFragments(span.children, styleStack, options)
                )
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

function hasNonDefaultStyles(fragments: TextStyleFragment[]): boolean {
    return fragments.some((fragment) => !isDefaultStyle(fragment.style))
}

function buildFragmentsFromSpans(
    spans: Span[],
    options: SpanFragmentOptions = {}
): {
    normalizedText: string
    trimmedFragments: TextStyleFragment[]
} {
    const fragments = mergeAdjacentFragments(
        spansToTextFragments(spans, [], options)
    )
    const text = fragments.map((fragment) => fragment.text).join("")
    const normalizedText = normalizeReplacementText(text)
    const trimmedFragments = trimFragmentsToLength(
        fragments,
        normalizedText.length
    )
    return { normalizedText, trimmedFragments }
}

function buildFragmentsFromParagraph(
    paragraph: GdocParagraph
): TextStyleFragment[] {
    if (paragraph.type !== "paragraph") return []
    const fragments = mergeAdjacentFragments(
        spansToTextFragments(paragraph.spans ?? [])
    )
    const normalizedText = normalizeParagraphText(paragraph.text)
    return trimFragmentsToLength(fragments, normalizedText.length)
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

function collectFrontmatterValues(
    paragraphs: GdocParagraph[]
): Map<string, FrontmatterValueLocation> {
    const valuesByKey = new Map<string, FrontmatterValueLocation>()
    const scopeStack: ArchieScopeMarker[] = []
    let inBody = false
    let isSkipping = false
    let active: FrontmatterValueLocation | null = null

    const closeActive = (): void => {
        if (!active) return
        if (!valuesByKey.has(active.key)) {
            valuesByKey.set(active.key, active)
        }
        active = null
    }

    for (const paragraph of paragraphs) {
        if (inBody) break
        const lineRanges = buildParagraphLineRanges(paragraph)

        for (const lineRange of lineRanges) {
            const line = lineRange.rawLine
            const marker = parseScopeMarkerLine(line)

            if (marker) {
                if (isBodyMarker(marker)) {
                    closeActive()
                    inBody = true
                    break
                }

                closeActive()
                if (marker.slug === "") {
                    scopeStack.pop()
                } else {
                    scopeStack.push(marker)
                }
                continue
            }

            const commandMatch = frontmatterCommandPattern.exec(line)
            if (commandMatch) {
                const command = commandMatch[1]?.toLowerCase()
                if (command === "end" && active) {
                    active.endCommandLine = lineRange
                    closeActive()
                } else if (command === "skip") {
                    closeActive()
                    isSkipping = true
                } else if (command === "endskip") {
                    closeActive()
                    isSkipping = false
                } else if (command === "ignore") {
                    closeActive()
                    scopeStack.length = 0
                }
                continue
            }

            if (isSkipping) continue
            if (scopeStack.length > 0) continue

            const parsed = parseFrontmatterLine(line)
            if (parsed && SIMPLE_FRONTMATTER_KEYS.has(parsed.key)) {
                closeActive()
                if (valuesByKey.has(parsed.key)) {
                    continue
                }
                const keyLine: FrontmatterLineLocation = {
                    ...lineRange,
                    key: parsed.key,
                    value: parsed.value,
                    leadingWhitespace: parsed.leadingWhitespace,
                }
                active = {
                    key: parsed.key,
                    leadingWhitespace: parsed.leadingWhitespace,
                    lines: [keyLine],
                }
                continue
            }

            if (active) {
                active.lines.push({
                    ...lineRange,
                    key: active.key,
                })
            }
        }
    }

    closeActive()
    return valuesByKey
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

function buildFrontmatterLinesForValue(
    key: string,
    value: string,
    valueLocation: FrontmatterValueLocation
): string[] {
    const parts = value.split("\n")
    const leadingWhitespace = valueLocation.leadingWhitespace
    const firstLine = `${leadingWhitespace}${key}: ${parts[0] ?? ""}`
    const remainder = parts.slice(1)
    const output = [firstLine, ...remainder]
    if (valueLocation.endCommandLine) {
        output.push(`${leadingWhitespace}:end`)
    }
    return output
}

function spanContainsUnsupportedMarkup(
    span: Span,
    options: SpanFragmentOptions = {}
): boolean {
    if (span.spanType === "span-ref") {
        return resolveRefToken(span, options.refTokens) === null
    }
    if (UNSUPPORTED_SPAN_TYPES.has(span.spanType)) return true
    if ("children" in span && Array.isArray(span.children)) {
        return span.children.some((child) =>
            spanContainsUnsupportedMarkup(child, options)
        )
    }
    return false
}

function spansContainUnsupportedMarkup(
    spans: Span[],
    options: SpanFragmentOptions = {}
): boolean {
    return spans.some((span) => spanContainsUnsupportedMarkup(span, options))
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
    valuesByKey: Map<string, FrontmatterValueLocation>,
    content: OwidGdocPostContent,
    warnings: string[]
): GdocTextReplacement[] {
    const replacements: GdocTextReplacement[] = []

    for (const [key, valueLocation] of valuesByKey.entries()) {
        const newValue = getFrontmatterValue(content, key)
        if (newValue === null) continue

        const lines = valueLocation.lines
        const startLine = lines[0]
        const endLine = valueLocation.endCommandLine ?? lines[lines.length - 1]
        if (
            !startLine ||
            !endLine ||
            startLine.startIndex === undefined ||
            endLine.endIndex === undefined
        ) {
            warnings.push(
                `Skipping frontmatter "${key}" because the line range is missing.`
            )
            continue
        }

        const existingLines = [
            ...lines.map((line) => line.rawLine),
            ...(valueLocation.endCommandLine
                ? [valueLocation.endCommandLine.rawLine]
                : []),
        ]
        const newLines = buildFrontmatterLinesForValue(
            key,
            newValue,
            valueLocation
        )

        if (existingLines.join("\n") === newLines.join("\n")) continue

        replacements.push({
            startIndex: startLine.startIndex,
            endIndex: endLine.endIndex,
            newText: newLines.join("\n"),
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

function computeLcsMatches<T>(
    originalItems: T[],
    updatedItems: T[]
): Array<{ originalIndex: number; updatedIndex: number }> {
    const dp: number[][] = Array.from(
        { length: originalItems.length + 1 },
        () => new Array<number>(updatedItems.length + 1).fill(0)
    )

    for (let i = originalItems.length - 1; i >= 0; i--) {
        for (let j = updatedItems.length - 1; j >= 0; j--) {
            if (originalItems[i] === updatedItems[j]) {
                dp[i][j] = dp[i + 1][j + 1] + 1
            } else {
                dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
            }
        }
    }

    const matches: Array<{ originalIndex: number; updatedIndex: number }> = []
    let i = 0
    let j = 0
    while (i < originalItems.length && j < updatedItems.length) {
        if (originalItems[i] === updatedItems[j]) {
            matches.push({ originalIndex: i, updatedIndex: j })
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

    return matches
}

function buildListInsertionContent(
    items: ListItemUpdate[],
    options: { prefixNewline: boolean; suffixNewline: boolean }
): { text: string; fragments: TextStyleFragment[] } {
    let text = ""
    const fragments: TextStyleFragment[] = []

    const pushFragment = (fragment: TextStyleFragment): void => {
        if (!fragment.text) return
        text += fragment.text
        fragments.push(fragment)
    }

    if (options.prefixNewline) {
        pushFragment({ text: "\n", style: { ...defaultTextStyle } })
    }

    items.forEach((item, index) => {
        if (index > 0) {
            pushFragment({ text: "\n", style: { ...defaultTextStyle } })
        }
        item.trimmedFragments.forEach((fragment) =>
            pushFragment({ ...fragment })
        )
    })

    if (options.suffixNewline) {
        pushFragment({ text: "\n", style: { ...defaultTextStyle } })
    }

    return { text, fragments: mergeAdjacentFragments(fragments) }
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
            const previousText = existing.newText
            existing.newText += replacement.newText
            existing.reason = `${existing.reason},${replacement.reason}`

            if (existing.styleFragments || replacement.styleFragments) {
                const mergedFragments: TextStyleFragment[] = []

                if (existing.styleFragments) {
                    mergedFragments.push(...existing.styleFragments)
                } else if (previousText) {
                    mergedFragments.push({
                        text: previousText,
                        style: { ...defaultTextStyle },
                    })
                }

                if (replacement.styleFragments) {
                    mergedFragments.push(...replacement.styleFragments)
                } else if (replacement.newText) {
                    mergedFragments.push({
                        text: replacement.newText,
                        style: { ...defaultTextStyle },
                    })
                }

                existing.styleFragments =
                    mergeAdjacentFragments(mergedFragments)
            }
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
    refTokens: Map<number, string>,
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
            if (spansContainUnsupportedMarkup(block.value, { refTokens })) {
                warnings.push(
                    `Skipping body[${index}] text because it contains unsupported spans.`
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
            const { normalizedText, trimmedFragments } =
                buildFragmentsFromSpans(block.value, { refTokens })
            const textMatches =
                normalizedText === normalizeParagraphText(paragraph.text)
            const existingFragments = buildFragmentsFromParagraph(paragraph)
            const fragmentsMatch = isEqual(existingFragments, trimmedFragments)
            if (textMatches && fragmentsMatch) return
            const replacement = buildTextReplacementForParagraph(
                paragraph,
                normalizedText,
                `body[${index}]:text`,
                warnings,
                { allowSameText: textMatches && !fragmentsMatch }
            )
            if (replacement) {
                if (
                    trimmedFragments.length > 0 &&
                    (hasNonDefaultStyles(trimmedFragments) || !fragmentsMatch)
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
                spansContainUnsupportedMarkup(block.text, { refTokens }) ||
                (block.supertitle &&
                    spansContainUnsupportedMarkup(block.supertitle, {
                        refTokens,
                    }))
            ) {
                warnings.push(
                    `Skipping body[${index}] heading because it contains unsupported spans.`
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
            const normalizedText = normalizeReplacementText(text)
            const { trimmedFragments } = buildFragmentsFromSpans(
                combinedSpans,
                {
                    refTokens,
                }
            )
            const textMatches =
                normalizedText === normalizeParagraphText(paragraph.text)
            const existingFragments = buildFragmentsFromParagraph(paragraph)
            const fragmentsMatch = isEqual(existingFragments, trimmedFragments)
            if (textMatches && fragmentsMatch) return
            const replacement = buildTextReplacementForParagraph(
                paragraph,
                normalizedText,
                `body[${index}]:heading`,
                warnings,
                { allowSameText: textMatches && !fragmentsMatch }
            )
            if (replacement) {
                if (
                    trimmedFragments.length > 0 &&
                    (hasNonDefaultStyles(trimmedFragments) || !fragmentsMatch)
                ) {
                    replacement.styleFragments = trimmedFragments
                }
                replacements.push(replacement)
            }
            return
        }

        if (block.type === "list" || block.type === "numbered-list") {
            const items = block.items

            if (
                items.some((item) =>
                    spansContainUnsupportedMarkup(item.value, { refTokens })
                )
            ) {
                warnings.push(
                    `Skipping body[${index}] list because it contains unsupported spans.`
                )
                return
            }

            const updatedItems: ListItemUpdate[] = items.map((item) => {
                const { normalizedText, trimmedFragments } =
                    buildFragmentsFromSpans(item.value, { refTokens })
                return { normalizedText, trimmedFragments }
            })

            const currentItems = rangeParagraphs.map((paragraph) => ({
                paragraph,
                normalizedText:
                    paragraph.type === "paragraph"
                        ? normalizeParagraphText(paragraph.text)
                        : "",
                trimmedFragments: buildFragmentsFromParagraph(paragraph),
            }))

            const currentTexts = currentItems.map((item) => item.normalizedText)
            const updatedTexts = updatedItems.map((item) => item.normalizedText)

            const matches = computeLcsMatches(currentTexts, updatedTexts)
            const matchesWithSentinel = [
                ...matches,
                {
                    originalIndex: currentItems.length,
                    updatedIndex: updatedItems.length,
                },
            ]

            const pushItemReplacement = (
                paragraph: GdocParagraph | undefined,
                item: ListItemUpdate | undefined,
                itemIndex: number
            ): void => {
                if (!paragraph || !item) return
                if (paragraph.type !== "paragraph") {
                    warnings.push(
                        `Skipping body[${index}] list item because paragraph is not text.`
                    )
                    return
                }
                const textMatches =
                    item.normalizedText ===
                    normalizeParagraphText(paragraph.text)
                const fragmentsMatch = isEqual(
                    item.trimmedFragments,
                    buildFragmentsFromParagraph(paragraph)
                )
                if (textMatches && fragmentsMatch) return

                const replacement = buildTextReplacementForParagraph(
                    paragraph,
                    item.normalizedText,
                    `body[${index}]:list:${itemIndex}`,
                    warnings,
                    { allowSameText: textMatches && !fragmentsMatch }
                )
                if (replacement) {
                    if (
                        item.trimmedFragments.length > 0 &&
                        (hasNonDefaultStyles(item.trimmedFragments) ||
                            !fragmentsMatch)
                    ) {
                        replacement.styleFragments = item.trimmedFragments
                    }
                    replacements.push(replacement)
                }
            }

            const pushListDeletion = (
                deleteItems: typeof currentItems,
                reasonSuffix: string
            ): void => {
                if (deleteItems.length === 0) return
                const startIndex = deleteItems[0]?.paragraph.index
                const endIndex =
                    deleteItems[deleteItems.length - 1]?.paragraph.index
                if (startIndex === undefined || endIndex === undefined) {
                    warnings.push(
                        `Skipping body[${index}] list deletion because indices are missing.`
                    )
                    return
                }
                const deletion = buildTextReplacementForRange(
                    paragraphs,
                    startIndex,
                    endIndex,
                    "",
                    `body[${index}]:list:delete:${reasonSuffix}`,
                    warnings
                )
                if (deletion) replacements.push(deletion)
            }

            const pushListInsertion = (
                insertItems: ListItemUpdate[],
                anchorParagraph: GdocParagraph | undefined,
                reasonSuffix: string
            ): void => {
                if (insertItems.length === 0) return
                const insertionIndex = anchorParagraph?.startIndex
                if (insertionIndex === undefined) {
                    warnings.push(
                        `Skipping body[${index}] list insertion because anchor index is missing.`
                    )
                    return
                }
                const { text, fragments } = buildListInsertionContent(
                    insertItems,
                    { prefixNewline: false, suffixNewline: true }
                )
                if (!text) return
                const replacement: GdocTextReplacement = {
                    startIndex: insertionIndex,
                    endIndex: insertionIndex,
                    newText: text,
                    reason: `body[${index}]:list:insert:${reasonSuffix}`,
                }
                if (fragments.length > 0) {
                    replacement.styleFragments = fragments
                }
                replacements.push(replacement)
            }

            const pushListInsertionAtEnd = (
                insertItems: ListItemUpdate[],
                lastParagraph: GdocParagraph | undefined,
                reasonSuffix: string
            ): void => {
                if (insertItems.length === 0) return
                if (
                    !lastParagraph ||
                    lastParagraph.startIndex === undefined ||
                    lastParagraph.endIndex === undefined
                ) {
                    warnings.push(
                        `Skipping body[${index}] list insertion because end index is missing.`
                    )
                    return
                }
                const insertionIndex = Math.max(
                    lastParagraph.startIndex,
                    lastParagraph.endIndex - 1
                )
                const { text, fragments } = buildListInsertionContent(
                    insertItems,
                    { prefixNewline: true, suffixNewline: false }
                )
                if (!text) return
                const replacement: GdocTextReplacement = {
                    startIndex: insertionIndex,
                    endIndex: insertionIndex,
                    newText: text,
                    reason: `body[${index}]:list:insert:${reasonSuffix}`,
                }
                if (fragments.length > 0) {
                    replacement.styleFragments = fragments
                }
                replacements.push(replacement)
            }

            let previousOriginalIndex = 0
            let previousUpdatedIndex = 0

            for (const match of matchesWithSentinel) {
                const originalSegment = currentItems.slice(
                    previousOriginalIndex,
                    match.originalIndex
                )
                const updatedSegment = updatedItems.slice(
                    previousUpdatedIndex,
                    match.updatedIndex
                )
                const overlapCount = Math.min(
                    originalSegment.length,
                    updatedSegment.length
                )

                for (let offset = 0; offset < overlapCount; offset += 1) {
                    const originalItem = originalSegment[offset]
                    const updatedItem = updatedSegment[offset]
                    const updatedIndex = previousUpdatedIndex + offset
                    pushItemReplacement(
                        originalItem?.paragraph,
                        updatedItem,
                        updatedIndex
                    )
                }

                if (originalSegment.length > overlapCount) {
                    const deletions = originalSegment.slice(overlapCount)
                    pushListDeletion(
                        deletions,
                        `${previousOriginalIndex + overlapCount}`
                    )
                }

                if (updatedSegment.length > overlapCount) {
                    const insertions = updatedSegment.slice(overlapCount)
                    const anchorParagraph =
                        currentItems[match.originalIndex]?.paragraph
                    if (anchorParagraph) {
                        pushListInsertion(
                            insertions,
                            anchorParagraph,
                            `${previousUpdatedIndex + overlapCount}`
                        )
                    } else {
                        const lastParagraph =
                            currentItems[currentItems.length - 1]?.paragraph
                        pushListInsertionAtEnd(
                            insertions,
                            lastParagraph,
                            `${previousUpdatedIndex + overlapCount}`
                        )
                    }
                }

                if (
                    match.originalIndex < currentItems.length &&
                    match.updatedIndex < updatedItems.length
                ) {
                    const originalItem = currentItems[match.originalIndex]
                    const updatedItem = updatedItems[match.updatedIndex]
                    pushItemReplacement(
                        originalItem?.paragraph,
                        updatedItem,
                        match.updatedIndex
                    )
                }

                previousOriginalIndex = match.originalIndex + 1
                previousUpdatedIndex = match.updatedIndex + 1
            }

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
    const sorted = [...replacements].sort((a, b) => {
        if (a.startIndex !== b.startIndex) {
            return a.startIndex - b.startIndex
        }
        return a.endIndex - b.endIndex
    })

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

    const sorted = [...replacements].sort((a, b) => {
        if (a.startIndex !== b.startIndex) {
            return b.startIndex - a.startIndex
        }
        return b.endIndex - a.endIndex
    })
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

function hasSuggestedTextStyleChanges(
    changes:
        | Record<string, docs_v1.Schema$SuggestedTextStyle>
        | null
        | undefined
): boolean {
    if (!changes) return false
    return Object.keys(changes).length > 0
}

function collectSuggestedRangesFromElements(
    elements: docs_v1.Schema$StructuralElement[] | undefined
): Array<{ startIndex: number; endIndex: number }> {
    if (!elements) return []
    const ranges: Array<{ startIndex: number; endIndex: number }> = []

    for (const element of elements) {
        if (element.paragraph) {
            const paragraphElements = element.paragraph.elements ?? []
            for (const paragraphElement of paragraphElements) {
                const textRun = paragraphElement.textRun
                if (!textRun) continue
                const hasSuggestions =
                    (textRun.suggestedInsertionIds?.length ?? 0) > 0 ||
                    (textRun.suggestedDeletionIds?.length ?? 0) > 0 ||
                    hasSuggestedTextStyleChanges(
                        textRun.suggestedTextStyleChanges
                    )
                if (!hasSuggestions) continue
                if (
                    paragraphElement.startIndex === undefined ||
                    paragraphElement.startIndex === null ||
                    paragraphElement.endIndex === undefined ||
                    paragraphElement.endIndex === null
                ) {
                    continue
                }
                ranges.push({
                    startIndex: paragraphElement.startIndex,
                    endIndex: paragraphElement.endIndex,
                })
            }
            continue
        }

        if (element.table) {
            for (const row of element.table.tableRows ?? []) {
                for (const cell of row.tableCells ?? []) {
                    ranges.push(
                        ...collectSuggestedRangesFromElements(cell.content)
                    )
                }
            }
            continue
        }

        if (element.tableOfContents) {
            ranges.push(
                ...collectSuggestedRangesFromElements(
                    element.tableOfContents.content
                )
            )
        }
    }

    return ranges
}

function collectSuggestedRanges(
    document: docs_v1.Schema$Document
): Array<{ startIndex: number; endIndex: number }> {
    const ranges = collectSuggestedRangesFromElements(document.body?.content)
    if (ranges.length === 0) return ranges
    const sorted = ranges
        .filter((range) => range.endIndex > range.startIndex)
        .sort((a, b) => a.startIndex - b.startIndex)
    const merged: Array<{ startIndex: number; endIndex: number }> = []
    for (const range of sorted) {
        const last = merged[merged.length - 1]
        if (last && range.startIndex <= last.endIndex) {
            last.endIndex = Math.max(last.endIndex, range.endIndex)
            continue
        }
        merged.push({ ...range })
    }
    return merged
}

function replacementsOverlapSuggestions(
    replacement: GdocTextReplacement,
    ranges: Array<{ startIndex: number; endIndex: number }>
): boolean {
    return ranges.some((range) => {
        if (replacement.startIndex === replacement.endIndex) {
            return (
                replacement.startIndex >= range.startIndex &&
                replacement.startIndex < range.endIndex
            )
        }
        return (
            replacement.startIndex < range.endIndex &&
            replacement.endIndex > range.startIndex
        )
    })
}

function filterReplacementsForSuggestions(
    replacements: GdocTextReplacement[],
    ranges: Array<{ startIndex: number; endIndex: number }>,
    warnings: string[]
): GdocTextReplacement[] {
    if (ranges.length === 0) return replacements
    const filtered: GdocTextReplacement[] = []
    for (const replacement of replacements) {
        if (replacementsOverlapSuggestions(replacement, ranges)) {
            warnings.push(
                `Skipping ${replacement.reason} because it overlaps suggested changes.`
            )
            continue
        }
        filtered.push(replacement)
    }
    return filtered
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
    const refTokens = buildRefTokenLookup(content)

    const frontmatterParagraphs = bodyRange
        ? paragraphs.slice(0, Math.max(0, bodyRange.paragraphStart))
        : paragraphs

    const frontmatterValues = collectFrontmatterValues(frontmatterParagraphs)
    const bodyReplacements = buildBodyReplacements(
        content.body,
        paragraphs,
        originalContent?.body,
        bodyRange,
        hasBodyMarker,
        stableSourceKeys,
        refTokens,
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
        ...buildFrontmatterReplacements(frontmatterValues, content, warnings),
        ...bodyReplacements,
        ...bodyDeletions,
    ]

    const suggestedRanges = collectSuggestedRanges(document)
    const filteredReplacements = filterReplacementsForSuggestions(
        replacements,
        suggestedRanges,
        warnings
    )
    const requests = buildRequestsFromReplacements(
        filteredReplacements,
        warnings
    )

    return {
        replacements: filteredReplacements,
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
