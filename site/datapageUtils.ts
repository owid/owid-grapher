import * as _ from "lodash-es"
import { OwidOrigin } from "@ourworldindata/types"
import { getYearSuffixFromOrigin } from "@ourworldindata/utils"

export function getProducersFromYears(origins: OwidOrigin[]) {
    return _.uniq(
        origins.map((o) => `${o.producer}${getYearSuffixFromOrigin(o)}`)
    )
}

export function getAttributionUnshortened(datapageData: {
    attributions?: string[]
    origins: OwidOrigin[]
}) {
    const producersWithYear = getProducersFromYears(datapageData.origins)
    const attributionFragments = datapageData.attributions ?? producersWithYear
    return attributionFragments.join("; ")
}

interface MarkdownBlock {
    type: "heading" | "listItem" | "paragraph"
    lines: string[]
}

const LIST_ITEM_START = /^\s*([-*+]|\d+[.)])\s/
const HEADING_START = /^#{1,6}\s/

// A rough line-based markdown block parser, just detailed enough to find safe
// places to split a descriptionKey into a preview and a remainder. Nested list
// items and lazy continuation lines stay attached to their parent block so a
// split never lands inside a list item.
function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = []
    let current: MarkdownBlock | undefined
    for (const line of markdown.split("\n")) {
        if (!line.trim()) {
            current = undefined
        } else if (HEADING_START.test(line)) {
            current = undefined
            blocks.push({ type: "heading", lines: [line] })
        } else if (LIST_ITEM_START.test(line)) {
            const isNested = /^\s/.test(line)
            if (isNested && current?.type === "listItem") {
                current.lines.push(line)
            } else {
                current = { type: "listItem", lines: [line] }
                blocks.push(current)
            }
        } else if (current) {
            current.lines.push(line)
        } else {
            current = { type: "paragraph", lines: [line] }
            blocks.push(current)
        }
    }
    return blocks
}

function joinMarkdownBlocks(blocks: MarkdownBlock[]): string {
    return blocks
        .map((block, i) => {
            const previous = blocks[i - 1]
            const separator = !previous
                ? ""
                : block.type === "listItem" && previous.type === "listItem"
                  ? "\n"
                  : "\n\n"
            return separator + block.lines.join("\n")
        })
        .join("")
}

// How many blocks of the descriptionKey to show in the preview:
// - if it has headings, the first heading's section (up to the next heading)
// - if it's a bulleted list, the first three bullets (plus any intro text)
// - if it's plain paragraphs, the first two
function findPreviewEnd(blocks: MarkdownBlock[]): number {
    const headingIndexes = blocks.flatMap((block, i) =>
        block.type === "heading" ? [i] : []
    )
    if (headingIndexes.length > 0) return headingIndexes[1] ?? blocks.length
    if (blocks.some((block) => block.type === "listItem")) {
        let listItemCount = 0
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].type === "listItem" && ++listItemCount === 3)
                return i + 1
        }
        return blocks.length
    }
    return Math.min(2, blocks.length)
}

/**
 * Split a descriptionKey markdown string into a preview (shown above the fold
 * of the metadata box) and a remainder (revealed when the box is expanded).
 *
 * The remainder is rendered as real content inside the box's <details>, not
 * hidden with CSS, so the box works without JavaScript and browsers can
 * auto-expand it when in-page search (Cmd-F) matches hidden text.
 */
export function splitDescriptionKey(markdown: string): {
    preview: string
    remainder: string
} {
    const blocks = parseMarkdownBlocks(markdown)
    const previewEnd = findPreviewEnd(blocks)
    return {
        preview: joinMarkdownBlocks(blocks.slice(0, previewEnd)),
        remainder: joinMarkdownBlocks(blocks.slice(previewEnd)),
    }
}
