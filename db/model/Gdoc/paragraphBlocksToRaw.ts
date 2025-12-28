import {
    type GdocParagraph,
    type GdocParagraphRange,
    type OwidRawGdocBlock,
    type RawBlockHeading,
    type RawBlockHorizontalRule,
    type RawBlockList,
    type RawBlockNumberedList,
    type RawBlockText,
    type Span,
} from "@ourworldindata/types"
import { type GdocParagraphBlock } from "./archieParagraphBlockParser.js"
import { loadArchieFromLines } from "./archieLineParser.js"
import { whitespacePattern } from "./archieParagraphParser.js"
import { paragraphsToArchieText } from "./paragraphsToArchie.js"
import {
    replaceRefsAcrossTextSegments,
    replaceRefsInSpans,
    replaceRefsInText,
} from "./refSyntax.js"
import { spansToHtmlString, spansToSimpleString } from "./gdocUtils.js"

const ORDERED_GLYPH_TYPES = new Set([
    "DECIMAL",
    "UPPER_ROMAN",
    "LOWER_ROMAN",
    "UPPER_ALPHA",
    "LOWER_ALPHA",
])

function splitArchieLines(text: string): string[] {
    const normalized = text.replace(/\r/g, "")
    return normalized.split("\n")
}

function normalizeArchieLinks(text: string): string {
    const noWSOnlyLinks = text.replace(/(<a[^>]*>)(\s+)(<\/a>)/gims, "$2")
    return noWSOnlyLinks.replace(/(<a[^>]*>)(\s+)(.*?)(<\/a>)/gims, "$2$1$3$4")
}

const trailingWhitespacePattern = new RegExp(`[${whitespacePattern}]+$`, "g")
const leadingWhitespacePattern = new RegExp(`^[${whitespacePattern}]+`)
const whitespaceOnlyPattern = new RegExp(`^[${whitespacePattern}]*$`)
const lineBreakCollapsePattern = new RegExp(
    `[${whitespacePattern}]*\\n+[${whitespacePattern}]*`,
    "g"
)

function trimHtmlTrailingWhitespace(text: string): string {
    let trimmed = text.replace(trailingWhitespacePattern, "")
    trimmed = trimmed.replace(/(<br\s*\/?>\s*)+$/gims, "")
    return trimmed.replace(trailingWhitespacePattern, "")
}

function trimHtmlLeadingWhitespace(text: string): string {
    return text.replace(leadingWhitespacePattern, "")
}

function trimHtmlParagraphWhitespace(text: string): string {
    const collapsed = text.replace(lineBreakCollapsePattern, "\n")
    return trimHtmlTrailingWhitespace(trimHtmlLeadingWhitespace(collapsed))
}

function trimTrailingWhitespace(
    spans: Span[],
    options: { trimSpaces: boolean } = { trimSpaces: true }
): Span[] {
    const result = [...spans]
    const trailingPattern = options.trimSpaces
        ? trailingWhitespacePattern
        : /[\r\n]+$/g
    while (result.length > 0) {
        const last = result[result.length - 1]
        if (last.spanType === "span-simple-text") {
            const trimmed = last.text.replace(trailingPattern, "")
            if (trimmed.length > 0) {
                result[result.length - 1] = {
                    spanType: "span-simple-text",
                    text: trimmed,
                }
                break
            }
            result.pop()
            continue
        }
        if ("children" in last && Array.isArray(last.children)) {
            const spanWithChildren = last as SpanWithChildren
            const trimmedChildren = trimTrailingWhitespace(
                spanWithChildren.children,
                { trimSpaces: false }
            )
            if (trimmedChildren.length === 0) {
                result.pop()
                continue
            }
            result[result.length - 1] = cloneSpanWithChildren(
                spanWithChildren,
                trimmedChildren
            )
            break
        }
        if (last.spanType === "span-newline") {
            result.pop()
            continue
        }
        break
    }
    return result
}

function normalizeSpanTextWhitespace(spans: Span[]): Span[] {
    const result: Span[] = []

    for (const span of spans) {
        if (span.spanType === "span-simple-text") {
            if (!span.text) continue
            const normalized = span.text
                .replace(/\r/g, "")
                .replace(lineBreakCollapsePattern, "\n")
            if (normalized.length > 0) {
                result.push({
                    spanType: "span-simple-text",
                    text: normalized,
                })
            }
            continue
        }

        if ("children" in span && Array.isArray(span.children)) {
            const normalizedChildren = normalizeSpanTextWhitespace(
                span.children
            )
            if (normalizedChildren.length === 0) continue
            result.push(
                cloneSpanWithChildren(
                    span as SpanWithChildren,
                    normalizedChildren
                )
            )
            continue
        }

        result.push(span)
    }

    return result
}

function mergeAdjacentSimpleTextSpans(spans: Span[]): Span[] {
    const result: Span[] = []
    let buffer = ""

    const flushBuffer = (): void => {
        if (!buffer) return
        result.push({ spanType: "span-simple-text", text: buffer })
        buffer = ""
    }

    for (const span of spans) {
        if (span.spanType === "span-simple-text") {
            buffer += span.text
            continue
        }

        flushBuffer()

        if ("children" in span && Array.isArray(span.children)) {
            const normalizedChildren = mergeAdjacentSimpleTextSpans(
                span.children
            )
            if (normalizedChildren.length === 0) continue
            result.push(
                cloneSpanWithChildren(
                    span as SpanWithChildren,
                    normalizedChildren
                )
            )
            continue
        }

        result.push(span)
    }

    flushBuffer()
    return result
}

type SpanWithChildren = Extract<Span, { children: Span[] }>

function cloneSpanWithChildren(
    span: SpanWithChildren,
    children: Span[]
): SpanWithChildren {
    return {
        ...span,
        children,
    }
}

type LinkSpan = Extract<
    Span,
    {
        spanType:
            | "span-link"
            | "span-ref"
            | "span-guided-chart-link"
            | "span-dod"
    }
>

function isLinkSpan(span: Span): span is LinkSpan {
    return (
        span.spanType === "span-link" ||
        span.spanType === "span-ref" ||
        span.spanType === "span-guided-chart-link" ||
        span.spanType === "span-dod"
    )
}

function trimLeadingWhitespace(spans: Span[]): Span[] {
    const result = [...spans]
    while (result.length > 0) {
        const first = result[0]
        if (first.spanType === "span-simple-text") {
            const trimmed = first.text.replace(leadingWhitespacePattern, "")
            if (trimmed.length > 0) {
                result[0] = {
                    spanType: "span-simple-text",
                    text: trimmed,
                }
                break
            }
            result.shift()
            continue
        }
        if (first.spanType === "span-newline") {
            result.shift()
            continue
        }
        if ("children" in first && Array.isArray(first.children)) {
            const spanWithChildren = first as SpanWithChildren
            const trimmedChildren = trimLeadingWhitespace(
                spanWithChildren.children
            )
            if (trimmedChildren.length === 0) {
                result.shift()
                continue
            }
            result[0] = cloneSpanWithChildren(spanWithChildren, trimmedChildren)
            break
        }
        break
    }
    return result
}

function consumeLeadingWhitespace(spans: Span[]): {
    leading: string
    remaining: Span[]
} {
    let leading = ""
    const remaining: Span[] = []
    let consuming = true

    for (const span of spans) {
        if (!consuming) {
            remaining.push(span)
            continue
        }

        if (span.spanType === "span-simple-text") {
            const match = span.text.match(leadingWhitespacePattern)
            if (match) {
                leading += match[0]
                const rest = span.text.slice(match[0].length)
                if (rest.length > 0) {
                    remaining.push({
                        spanType: "span-simple-text",
                        text: rest,
                    })
                    consuming = false
                }
                continue
            }
            remaining.push(span)
            consuming = false
            continue
        }

        if (span.spanType === "span-newline") {
            leading += "\n"
            continue
        }

        if ("children" in span && Array.isArray(span.children)) {
            const spanWithChildren = span as SpanWithChildren
            const normalized = consumeLeadingWhitespace(
                spanWithChildren.children
            )
            leading += normalized.leading
            if (normalized.remaining.length > 0) {
                remaining.push(
                    cloneSpanWithChildren(
                        spanWithChildren,
                        normalized.remaining
                    )
                )
                consuming = false
            }
            continue
        }

        remaining.push(span)
        consuming = false
    }

    return { leading, remaining }
}

function normalizeLinkWhitespace(spans: Span[]): Span[] {
    const result: Span[] = []

    for (const span of spans) {
        if (isLinkSpan(span)) {
            const normalizedChildren = normalizeLinkWhitespace(span.children)
            const linkText = spansToSimpleString(normalizedChildren)
            if (whitespaceOnlyPattern.test(linkText)) {
                if (linkText.length > 0) {
                    result.push({
                        spanType: "span-simple-text",
                        text: linkText,
                    })
                }
                continue
            }

            const { leading, remaining } =
                consumeLeadingWhitespace(normalizedChildren)

            if (leading.length > 0) {
                result.push({
                    spanType: "span-simple-text",
                    text: leading,
                })
            }

            if (remaining.length > 0) {
                result.push({
                    ...span,
                    children: remaining,
                })
            }
            continue
        }

        if ("children" in span && Array.isArray(span.children)) {
            const normalizedChildren = normalizeLinkWhitespace(span.children)
            if (normalizedChildren.length === 0) continue
            result.push(
                cloneSpanWithChildren(
                    span as SpanWithChildren,
                    normalizedChildren
                )
            )
            continue
        }

        result.push(span)
    }

    return result
}

function spansContainRefs(spans: Span[]): boolean {
    return spansToSimpleString(spans).includes("{ref}")
}

function isWhitespaceOnlyText(text: string): boolean {
    return whitespaceOnlyPattern.test(text)
}

function isEmptyRawTextValue(value: string | Span[]): boolean {
    if (typeof value === "string") {
        const stripped = value.replace(/<[^>]+>/g, "")
        return isWhitespaceOnlyText(stripped)
    }
    const simple = spansToSimpleString(value)
    return isWhitespaceOnlyText(simple)
}

function spansToHtmlWithRefs(
    spans: Span[],
    refIdToNumber: Map<string, number>
): string {
    const html = spansToHtmlString(spans)
    const withRefs = replaceRefsInText(html, refIdToNumber)
    return normalizeParagraphOverride(withRefs)
}

function normalizeParagraphOverride(text: string): string {
    return trimHtmlParagraphWhitespace(normalizeArchieLinks(text))
}

function normalizeParagraphSpans(
    spans: Span[],
    refIdToNumber: Map<string, number>
): Span[] | string {
    if (spansContainRefs(spans)) {
        return spansToHtmlWithRefs(spans, refIdToNumber)
    }
    const withRefs = replaceRefsInSpans(spans, refIdToNumber)
    const normalizedLinks = normalizeLinkWhitespace(withRefs)
    const mergedText = mergeAdjacentSimpleTextSpans(normalizedLinks)
    const normalizedText = normalizeSpanTextWhitespace(mergedText)
    const trimmedLeading = trimLeadingWhitespace(normalizedText)
    return trimTrailingWhitespace(trimmedLeading)
}

function getHeadingLevel(paragraph: GdocParagraph): string | undefined {
    const style = paragraph.paragraphStyle
    if (!style) return undefined
    if (!style.includes("HEADING")) return undefined
    return style.replace("HEADING_", "")
}

function isOrderedListParagraph(paragraph: GdocParagraph): boolean {
    const glyphType = paragraph.list?.glyphType
    if (!glyphType) return false
    return ORDERED_GLYPH_TYPES.has(glyphType)
}

function collectRangeParagraphs(
    paragraphs: GdocParagraph[],
    range: GdocParagraphRange
): GdocParagraph[] {
    return paragraphs.slice(range.paragraphStart, range.paragraphEnd + 1)
}

function toTextBlock(
    paragraph: GdocParagraph,
    refIdToNumber: Map<string, number>,
    refOverrides: Map<number, string | null>
): RawBlockText | null {
    if (paragraph.type === "paragraph") {
        const override = refOverrides.get(paragraph.index)
        if (override === null) return null
        if (typeof override === "string") {
            return {
                type: "text",
                value: normalizeParagraphOverride(override),
            }
        }
    }
    const spans = paragraph.type === "paragraph" ? paragraph.spans : []
    const value = normalizeParagraphSpans(spans, refIdToNumber)
    if (isEmptyRawTextValue(value)) {
        return null
    }
    return {
        type: "text",
        value,
    }
}

function toHeadingBlock(
    paragraph: GdocParagraph,
    refIdToNumber: Map<string, number>,
    refOverrides: Map<number, string | null>
): RawBlockHeading | null {
    const level = getHeadingLevel(paragraph)
    if (paragraph.type === "paragraph") {
        const override = refOverrides.get(paragraph.index)
        if (override === null) return null
        if (typeof override === "string") {
            return {
                type: "heading",
                value: {
                    text: normalizeParagraphOverride(override),
                    level,
                },
            }
        }
    }
    const spans = paragraph.type === "paragraph" ? paragraph.spans : []
    const text = normalizeParagraphSpans(spans, refIdToNumber)
    if (isEmptyRawTextValue(text)) {
        return null
    }
    return {
        type: "heading",
        value: {
            text,
            level,
        },
    }
}

function toListBlock(
    paragraphs: GdocParagraph[],
    refIdToNumber: Map<string, number>,
    refOverrides: Map<number, string | null>
): RawBlockList | RawBlockNumberedList | null {
    const listParagraphs = paragraphs.filter(
        (paragraph): paragraph is GdocParagraph & { type: "paragraph" } =>
            paragraph.type === "paragraph"
    )
    const needsString = listParagraphs.some((paragraph) => {
        const override = refOverrides.get(paragraph.index)
        if (typeof override === "string") return true
        if (override === null) return false
        return spansContainRefs(paragraph.spans)
    })
    const stringItems: string[] = []
    const spanItems: Span[][] = []

    listParagraphs.forEach((paragraph) => {
        const override = refOverrides.get(paragraph.index)
        if (override === null) return

        if (needsString) {
            if (typeof override === "string") {
                const normalized = normalizeParagraphOverride(override)
                if (!isEmptyRawTextValue(normalized)) {
                    stringItems.push(normalized)
                }
            } else {
                const normalized = spansToHtmlWithRefs(
                    paragraph.spans,
                    refIdToNumber
                )
                if (!isEmptyRawTextValue(normalized)) {
                    stringItems.push(normalized)
                }
            }
            return
        }

        const normalized = normalizeParagraphSpans(
            paragraph.spans,
            refIdToNumber
        ) as Span[]
        if (!isEmptyRawTextValue(normalized)) {
            spanItems.push(normalized)
        }
    })

    const items: string[] | Span[][] = needsString ? stringItems : spanItems

    if (items.length === 0) return null

    const isOrdered = paragraphs.some((paragraph) =>
        isOrderedListParagraph(paragraph)
    )

    if (isOrdered) {
        return {
            type: "numbered-list",
            value: items,
        }
    }

    return {
        type: "list",
        value: items,
    }
}

function parseMarkerBlock(
    paragraphs: GdocParagraph[],
    refIdToNumber: Map<string, number>
): OwidRawGdocBlock[] {
    const archieText = paragraphsToArchieText(paragraphs)
    const withRefs = replaceRefsInText(archieText, refIdToNumber)
    const normalizedText = normalizeArchieLinks(withRefs)
    const wrappedText = `[+body]\n${normalizedText}\n[]`
    const parsed = loadArchieFromLines(splitArchieLines(wrappedText))
    const rawBody = parsed.body

    if (!Array.isArray(rawBody)) return []
    return rawBody.filter((block): block is OwidRawGdocBlock =>
        Boolean(block && typeof block === "object" && "type" in block)
    )
}

export function paragraphBlocksToRawBody(
    paragraphs: GdocParagraph[],
    blocks: GdocParagraphBlock[],
    refIdToNumber: Map<string, number>
): OwidRawGdocBlock[] {
    const rawBlocks: OwidRawGdocBlock[] = []
    const refOverridesByIndex = replaceRefsAcrossTextSegments(
        paragraphs.map((paragraph) =>
            paragraph.type === "paragraph"
                ? spansToHtmlString(paragraph.spans)
                : ""
        ),
        refIdToNumber
    )
    const refOverrides = new Map<number, string | null>()
    paragraphs.forEach((paragraph, index) => {
        if (refOverridesByIndex.has(index)) {
            refOverrides.set(
                paragraph.index,
                refOverridesByIndex.get(index) ?? null
            )
        }
    })

    for (const block of blocks) {
        const rangeParagraphs = collectRangeParagraphs(paragraphs, block.range)

        switch (block.type) {
            case "text": {
                const paragraph = rangeParagraphs[0]
                if (!paragraph) break
                const textBlock = toTextBlock(
                    paragraph,
                    refIdToNumber,
                    refOverrides
                )
                if (textBlock) rawBlocks.push(textBlock)
                break
            }
            case "heading": {
                const paragraph = rangeParagraphs[0]
                if (!paragraph) break
                const headingBlock = toHeadingBlock(
                    paragraph,
                    refIdToNumber,
                    refOverrides
                )
                if (headingBlock) rawBlocks.push(headingBlock)
                break
            }
            case "list": {
                if (rangeParagraphs.length === 0) break
                const listBlock = toListBlock(
                    rangeParagraphs,
                    refIdToNumber,
                    refOverrides
                )
                if (listBlock) rawBlocks.push(listBlock)
                break
            }
            case "horizontal-rule": {
                const rawBlock: RawBlockHorizontalRule = {
                    type: "horizontal-rule",
                }
                rawBlocks.push(rawBlock)
                break
            }
            case "marker": {
                if (rangeParagraphs.length === 0) break
                rawBlocks.push(
                    ...parseMarkerBlock(rangeParagraphs, refIdToNumber)
                )
                break
            }
        }
    }

    return rawBlocks
}
