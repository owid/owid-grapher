import { createHash } from "crypto"
import { type OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { enrichedBlockToMarkdown } from "./enrichedToMarkdown.js"
import {
    type GdocParagraphBlock,
    type GdocParagraphBlockType,
} from "./archieParagraphBlockParser.js"

function getEnrichedBlockCategory(
    block: OwidEnrichedGdocBlock
): GdocParagraphBlockType {
    if (block.type === "heading") return "heading"
    if (block.type === "horizontal-rule") return "horizontal-rule"
    if (block.type === "list" || block.type === "numbered-list") return "list"
    if (block.type === "text") return "text"
    return "marker"
}

function normalizeParagraphBlockType(
    block: GdocParagraphBlock
): GdocParagraphBlockType {
    if (block.type === "marker") {
        const slug = block.marker?.slug
        if (slug === "heading") return "heading"
        if (slug === "list" || slug === "numbered-list") return "list"
    }
    return block.type
}

export function computeBlockFingerprint(block: OwidEnrichedGdocBlock): string {
    const markdown = (enrichedBlockToMarkdown(block, true) ?? "").trim()
    return createHash("sha1").update(markdown).digest("hex")
}

export function attachSourceMetadata(
    blocks: OwidEnrichedGdocBlock[] | undefined,
    paragraphBlocks: GdocParagraphBlock[]
): void {
    if (!blocks || blocks.length === 0 || paragraphBlocks.length === 0) return

    const normalizedParagraphBlocks = paragraphBlocks.map((block) => ({
        block,
        type: normalizeParagraphBlockType(block),
    }))

    const strictMatch =
        blocks.length === normalizedParagraphBlocks.length &&
        blocks.every((block, index) => {
            const candidate = normalizedParagraphBlocks[index]
            if (!candidate) return false
            return getEnrichedBlockCategory(block) === candidate.type
        })

    if (strictMatch) {
        blocks.forEach((block, index) => {
            const { block: paragraphBlock } = normalizedParagraphBlocks[index]
            block._source = {
                ...paragraphBlock.range,
                fingerprint: computeBlockFingerprint(block),
            }
        })
        return
    }

    let rangeIndex = 0
    for (const block of blocks) {
        const expectedType = getEnrichedBlockCategory(block)
        let matched: GdocParagraphBlock | undefined

        while (rangeIndex < normalizedParagraphBlocks.length) {
            const candidate = normalizedParagraphBlocks[rangeIndex]
            rangeIndex += 1
            if (candidate.type !== expectedType) continue
            matched = candidate.block
            break
        }

        if (!matched) continue

        block._source = {
            ...matched.range,
            fingerprint: computeBlockFingerprint(block),
        }
    }
}
