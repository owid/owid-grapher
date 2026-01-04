import { createHash } from "crypto"
import {
    type Span,
    type SpanRef,
    type SpanSimpleText,
    type SpanSuperscript,
} from "@ourworldindata/types"

const refPattern = /{ref}(.*?){\/ref}/gims
const refStartToken = "{ref}"
const refEndToken = "{/ref}"

type SpanWithChildren = Extract<Span, { children: Span[] }>

export function buildRefId(content: string): string {
    const isInlineRef = content.includes(" ")
    return isInlineRef
        ? createHash("sha1").update(content).digest("hex")
        : content
}

function createRefSpan(footnoteNumber: number): SpanRef {
    const superscript: SpanSuperscript = {
        spanType: "span-superscript",
        children: [
            {
                spanType: "span-simple-text",
                text: String(footnoteNumber),
            },
        ],
    }
    return {
        spanType: "span-ref",
        url: `#note-${footnoteNumber}`,
        children: [superscript],
    }
}

function createRefAnchor(footnoteNumber: number): string {
    return `<a class="ref" href="#note-${footnoteNumber}"><sup>${footnoteNumber}</sup></a>`
}

function cloneSpanWithChildren(
    span: SpanWithChildren,
    children: Span[]
): SpanWithChildren {
    return {
        ...span,
        children,
    }
}

function splitSpansOnRefs(
    spans: Span[],
    refIdToNumber: Map<string, number>
): Span[] {
    const output: Span[] = []

    for (const span of spans) {
        if (span.spanType === "span-simple-text") {
            const text = reduceRefText(span, refIdToNumber)
            output.push(...text)
            continue
        }

        if ("children" in span && Array.isArray(span.children)) {
            const spanWithChildren = span as SpanWithChildren
            const children = splitSpansOnRefs(
                spanWithChildren.children,
                refIdToNumber
            )
            output.push(cloneSpanWithChildren(spanWithChildren, children))
            continue
        }

        output.push(span)
    }

    return output
}

function reduceRefText(
    span: SpanSimpleText,
    refIdToNumber: Map<string, number>
): Span[] {
    const text = span.text
    const matches = Array.from(text.matchAll(refPattern))

    if (matches.length === 0) {
        return [span]
    }

    const output: Span[] = []
    let lastIndex = 0

    for (const match of matches) {
        const matchText = match[0] ?? ""
        const content = match[1] ?? ""
        const matchIndex = match.index ?? 0

        const beforeText = text.slice(lastIndex, matchIndex)
        if (beforeText) {
            output.push({ spanType: "span-simple-text", text: beforeText })
        }

        const refId = buildRefId(content)
        const footnoteNumber = refIdToNumber.get(refId)

        if (footnoteNumber) {
            output.push(createRefSpan(footnoteNumber))
        } else {
            output.push({ spanType: "span-simple-text", text: matchText })
        }

        lastIndex = matchIndex + matchText.length
    }

    const trailingText = text.slice(lastIndex)
    if (trailingText) {
        output.push({ spanType: "span-simple-text", text: trailingText })
    }

    return output
}

export function buildRefIdToNumberMap(
    refsByFirstAppearance: Set<string>
): Map<string, number> {
    const map = new Map<string, number>()
    Array.from(refsByFirstAppearance).forEach((id, index) => {
        map.set(id, index + 1)
    })
    return map
}

export function replaceRefsInSpans(
    spans: Span[],
    refIdToNumber: Map<string, number>
): Span[] {
    if (spans.length === 0) return spans
    return splitSpansOnRefs(spans, refIdToNumber)
}

export function replaceRefsInText(
    text: string,
    refIdToNumber: Map<string, number>
): string {
    return text.replace(refPattern, (matchText, content: string) => {
        const refId = buildRefId(content)
        const footnoteNumber = refIdToNumber.get(refId)
        if (!footnoteNumber) return matchText
        return createRefAnchor(footnoteNumber)
    })
}

export function replaceRefsAcrossTextSegments(
    segments: string[],
    refIdToNumber: Map<string, number>
): Map<number, string | null> {
    const replacements = new Map<number, string | null>()
    const hasRefEndFromIndex = new Array(segments.length + 1).fill(false)
    for (let i = segments.length - 1; i >= 0; i--) {
        hasRefEndFromIndex[i] =
            segments[i].includes(refEndToken) || hasRefEndFromIndex[i + 1]
    }

    let inRef = false
    let refBuffer = ""
    let placeholder = ""
    let placeholderIndex = -1
    let placeholderCounter = 0

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i] ?? ""
        if (!segment && !inRef) continue

        let cursor = 0
        let output = ""
        let touched = inRef

        while (cursor < segment.length) {
            if (!inRef) {
                const startIndex = segment.indexOf(refStartToken, cursor)
                if (startIndex === -1) {
                    output += segment.slice(cursor)
                    break
                }
                if (!hasRefEndFromIndex[i]) {
                    output += segment.slice(cursor)
                    break
                }

                output += segment.slice(cursor, startIndex)
                placeholder = `__REF_PLACEHOLDER_${placeholderCounter}__`
                placeholderCounter += 1
                placeholderIndex = i
                output += placeholder
                inRef = true
                refBuffer = ""
                touched = true
                cursor = startIndex + refStartToken.length
                continue
            }

            const endIndex = segment.indexOf(refEndToken, cursor)
            if (endIndex === -1) {
                refBuffer += segment.slice(cursor)
                cursor = segment.length
                touched = true
                break
            }

            refBuffer += segment.slice(cursor, endIndex)
            const refId = buildRefId(refBuffer)
            const footnoteNumber = refIdToNumber.get(refId)
            const replacement = footnoteNumber
                ? createRefAnchor(footnoteNumber)
                : `${refStartToken}${refBuffer}${refEndToken}`

            if (placeholderIndex === i) {
                output = output.replace(placeholder, replacement)
            } else if (placeholderIndex >= 0) {
                const startOutput = replacements.get(placeholderIndex)
                if (typeof startOutput === "string") {
                    replacements.set(
                        placeholderIndex,
                        startOutput.replace(placeholder, replacement)
                    )
                }
            }

            inRef = false
            refBuffer = ""
            placeholder = ""
            placeholderIndex = -1
            touched = true
            cursor = endIndex + refEndToken.length
        }

        if (touched) {
            replacements.set(i, output.length === 0 ? null : output)
        }
    }

    return replacements
}
