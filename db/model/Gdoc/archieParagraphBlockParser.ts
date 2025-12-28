import { type GdocParagraph, type GdocParagraphRange } from "@ourworldindata/types"
import {
    getParagraphContentLines,
    parseScopeMarkerParagraph,
    type ArchieScopeMarker,
    whitespacePattern,
} from "./archieParagraphParser.js"

export type GdocParagraphBlockType =
    | "heading"
    | "horizontal-rule"
    | "list"
    | "marker"
    | "text"

export interface GdocParagraphBlock {
    type: GdocParagraphBlockType
    range: GdocParagraphRange
    marker?: ArchieScopeMarker
    listId?: string
}

export interface ParsedBodyBlocks {
    blocks: GdocParagraphBlock[]
    bodyRange?: GdocParagraphRange
    hasBodyMarker: boolean
    warnings: string[]
}

const whitespaceOnlyPattern = new RegExp(`^[${whitespacePattern}]*$`)

interface ActiveBlock {
    type: GdocParagraphBlockType
    startIndex: number
    depth: number
    bracket: "[" | "{"
    marker?: ArchieScopeMarker
}

function isBodyMarker(marker: ArchieScopeMarker | undefined): boolean {
    return Boolean(
        marker &&
            marker.bracket === "[" &&
            marker.slug === "body" &&
            marker.flags.includes("+")
    )
}

function buildRange(
    paragraphs: GdocParagraph[],
    startIndex: number,
    endIndex: number
): GdocParagraphRange {
    const startParagraph = paragraphs[startIndex]
    const endParagraph = paragraphs[endIndex]
    return {
        paragraphStart: startIndex,
        paragraphEnd: endIndex,
        startIndex: startParagraph?.startIndex,
        endIndex: endParagraph?.endIndex,
    }
}

function hasVisibleText(paragraph: GdocParagraph): boolean {
    if (paragraph.type !== "paragraph") return false
    const lines = getParagraphContentLines(paragraph.text)
    return lines.some((line) => !whitespaceOnlyPattern.test(line))
}

function isHeadingParagraph(paragraph: GdocParagraph): boolean {
    if (paragraph.type !== "paragraph") return false
    return Boolean(
        paragraph.paragraphStyle &&
            paragraph.paragraphStyle.includes("HEADING")
    )
}

function shouldStartMarkerBlock(marker: ArchieScopeMarker): boolean {
    if (marker.slug === "") return false
    if (isBodyMarker(marker)) return false
    return true
}

export function parseBodyParagraphBlocks(
    paragraphs: GdocParagraph[]
): ParsedBodyBlocks {
    const blocks: GdocParagraphBlock[] = []
    const warnings: string[] = []
    const hasBodyMarker = paragraphs.some((paragraph) =>
        isBodyMarker(parseScopeMarkerParagraph(paragraph))
    )

    let inBody = !hasBodyMarker
    let bodyStartIndex: number | undefined = inBody ? 0 : undefined
    let bodyEndIndex: number | undefined
    const arrayStack: ArchieScopeMarker[] = []

    let activeBlock: ActiveBlock | null = null

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i]
        const marker = parseScopeMarkerParagraph(paragraph)

        if (marker && marker.bracket === "[") {
            if (marker.slug === "") {
                const lastArray = arrayStack.pop()
                if (isBodyMarker(lastArray)) {
                    inBody = false
                    bodyEndIndex = i - 1
                }
            } else {
                arrayStack.push(marker)
                if (!inBody && isBodyMarker(marker)) {
                    inBody = true
                    bodyStartIndex = i + 1
                }
            }
        }

        if (!inBody) continue

        if (activeBlock) {
            if (marker && marker.bracket === activeBlock.bracket) {
                if (marker.slug === "") {
                    activeBlock.depth -= 1
                } else {
                    activeBlock.depth += 1
                }
            }
            if (activeBlock.depth === 0) {
                blocks.push({
                    type: activeBlock.type,
                    range: buildRange(paragraphs, activeBlock.startIndex, i),
                    marker: activeBlock.marker,
                })
                activeBlock = null
            }
            continue
        }

        if (marker && shouldStartMarkerBlock(marker)) {
            activeBlock = {
                type: "marker",
                startIndex: i,
                depth: 1,
                bracket: marker.bracket,
                marker,
            }
            continue
        }

        if (marker) {
            continue
        }

        if (paragraph.tableContext) {
            continue
        }

        if (paragraph.type === "horizontal-rule") {
            blocks.push({
                type: "horizontal-rule",
                range: buildRange(paragraphs, i, i),
            })
            continue
        }

        if (paragraph.type === "paragraph" && paragraph.list) {
            const listId = paragraph.list.listId
            let endIndex = i
            for (let j = i + 1; j < paragraphs.length; j++) {
                const nextParagraph = paragraphs[j]
                if (
                    nextParagraph.type !== "paragraph" ||
                    !nextParagraph.list ||
                    nextParagraph.list.listId !== listId ||
                    parseScopeMarkerParagraph(nextParagraph)
                ) {
                    break
                }
                endIndex = j
            }
            blocks.push({
                type: "list",
                range: buildRange(paragraphs, i, endIndex),
                listId,
            })
            i = endIndex
            continue
        }

        if (isHeadingParagraph(paragraph)) {
            blocks.push({
                type: "heading",
                range: buildRange(paragraphs, i, i),
            })
            continue
        }

        if (hasVisibleText(paragraph)) {
            blocks.push({
                type: "text",
                range: buildRange(paragraphs, i, i),
            })
        }
    }

    if (activeBlock) {
        blocks.push({
            type: activeBlock.type,
            range: buildRange(
                paragraphs,
                activeBlock.startIndex,
                paragraphs.length - 1
            ),
            marker: activeBlock.marker,
        })
        warnings.push("Marker block closed at end of document.")
    }

    if (inBody && bodyEndIndex === undefined && paragraphs.length > 0) {
        bodyEndIndex = paragraphs.length - 1
        if (hasBodyMarker) {
            warnings.push("Body marker opened but not closed.")
        }
    }

    const bodyRange =
        bodyStartIndex !== undefined &&
        bodyEndIndex !== undefined &&
        bodyEndIndex >= bodyStartIndex
            ? buildRange(paragraphs, bodyStartIndex, bodyEndIndex)
            : undefined

    return {
        blocks,
        bodyRange,
        hasBodyMarker,
        warnings,
    }
}
