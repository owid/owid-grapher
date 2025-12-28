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

function trimHtmlTrailingWhitespace(text: string): string {
    let trimmed = text.replace(trailingWhitespacePattern, "")
    trimmed = trimmed.replace(/(<br\s*\/?>\s*)+$/gims, "")
    return trimmed.replace(trailingWhitespacePattern, "")
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

function spansContainRefs(spans: Span[]): boolean {
    return spansToSimpleString(spans).includes("{ref}")
}

function spansToHtmlWithRefs(
    spans: Span[],
    refIdToNumber: Map<string, number>
): string {
    const html = spansToHtmlString(spans)
    const withRefs = replaceRefsInText(html, refIdToNumber)
    return trimHtmlTrailingWhitespace(normalizeArchieLinks(withRefs))
}

function normalizeParagraphOverride(text: string): string {
    return trimHtmlTrailingWhitespace(normalizeArchieLinks(text))
}

function normalizeParagraphSpans(
    spans: Span[],
    refIdToNumber: Map<string, number>
): Span[] | string {
    if (spansContainRefs(spans)) {
        return spansToHtmlWithRefs(spans, refIdToNumber)
    }
    const withRefs = replaceRefsInSpans(spans, refIdToNumber)
    return trimTrailingWhitespace(withRefs)
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
    return {
        type: "text",
        value: normalizeParagraphSpans(spans, refIdToNumber),
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
    return {
        type: "heading",
        value: {
            text: normalizeParagraphSpans(spans, refIdToNumber),
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
                stringItems.push(normalizeParagraphOverride(override))
            } else {
                stringItems.push(
                    spansToHtmlWithRefs(paragraph.spans, refIdToNumber)
                )
            }
            return
        }

        spanItems.push(
            trimTrailingWhitespace(
                replaceRefsInSpans(paragraph.spans, refIdToNumber)
            )
        )
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
