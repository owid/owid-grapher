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

const CODE_FENCE_START = /^\s*(```|~~~)/

// A rough line-based markdown block parser, just detailed enough to find safe
// places to split a descriptionKey into a preview and a remainder. Nested list
// items and lazy continuation lines stay attached to their parent block so a
// split never lands inside a list item.
function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = []
    let current: MarkdownBlock | undefined
    let inCodeFence = false
    for (const line of markdown.split("\n")) {
        // Everything inside a code fence stays attached to the block that
        // opened it, so that a `# comment` inside the fence isn't mistaken
        // for a heading (which could make the split land inside the fence).
        if (inCodeFence) {
            current?.lines.push(line)
            if (CODE_FENCE_START.test(line)) inCodeFence = false
            continue
        }
        if (CODE_FENCE_START.test(line)) {
            inCodeFence = true
            if (!current) {
                current = { type: "paragraph", lines: [] }
                blocks.push(current)
            }
            current.lines.push(line)
            continue
        }
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

// Adjacent list items are always rejoined tightly, so a "loose" list (bullets
// separated by blank lines) comes out tight — a deliberate simplification.
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

// Cap the preview by total length too: block-count rules alone don't keep the
// box compact when e.g. each of three bullets holds a whole paragraph
// ("Rationale: … / Definition: … / Method of estimation: …"-style texts).
// Roughly the amount of text that fit the previously used 220px-tall clamp.
const PREVIEW_CHARACTER_BUDGET = 1000

const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g

// Measure a block by its visible text — link targets take up no preview
// space, so `[text](url)` counts as just `text`.
function visibleLength(block: MarkdownBlock): number {
    return block.lines.join("\n").replace(MARKDOWN_LINK, "$1").length
}

// How many blocks of the descriptionKey to show in the preview:
// - if it has headings, the first heading's section (up to the next heading)
// - if it's a bulleted list, the first three bullets (plus any intro text)
// - if it's plain paragraphs, the first two
// …but never more than fits the character budget (and always at least one).
function findPreviewEnd(blocks: MarkdownBlock[]): number {
    let previewEnd: number
    const headingIndexes = blocks.flatMap((block, i) =>
        block.type === "heading" ? [i] : []
    )
    if (headingIndexes.length > 0) {
        previewEnd = headingIndexes[1] ?? blocks.length
    } else if (blocks.some((block) => block.type === "listItem")) {
        previewEnd = blocks.length
        let listItemCount = 0
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].type === "listItem" && ++listItemCount === 3) {
                previewEnd = i + 1
                break
            }
        }
    } else {
        previewEnd = Math.min(2, blocks.length)
    }

    let budgetLeft = PREVIEW_CHARACTER_BUDGET
    for (let i = 0; i < previewEnd; i++) {
        budgetLeft -= visibleLength(blocks[i])
        if (budgetLeft < 0 && i > 0) return i
    }
    return previewEnd
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
