import {
    AiSearchBlock,
    AiSearchCompactBlock,
    AiSearchCompactContentBlock,
    AiSearchContentBlock,
} from "@ourworldindata/types"

/**
 * An AI search block with its hits reduced to slug and title, small enough
 * to read and diff between runs
 */
export function compactAiSearchBlock(
    block: AiSearchBlock
): AiSearchCompactBlock {
    switch (block.type) {
        case "group":
            return { ...block, blocks: block.blocks.map(compactContent) }
        case "forks":
        case "related":
            return block
        default:
            return compactContent(block)
    }
}

function compactContent(
    block: AiSearchContentBlock
): AiSearchCompactContentBlock {
    const { hit, ...rest } = block
    return { ...rest, slug: hit.slug, title: hit.title }
}
