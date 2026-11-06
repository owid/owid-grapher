import {
    EnrichedBlockSubscribeBanner,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"

export const injectAutomaticSubscribeBanner = (
    blocks: OwidEnrichedGdocBlock[]
): OwidEnrichedGdocBlock[] => {
    const lastHeadingIndex = blocks.findLastIndex(
        (block) => block.type === "heading" && block.level === 1
    )

    if (lastHeadingIndex === -1) return blocks

    const SubscribeBannerBlock: EnrichedBlockSubscribeBanner = {
        type: "subscribe-banner",
        align: "center",
        parseErrors: [],
    }

    return [
        ...blocks.slice(0, lastHeadingIndex),
        SubscribeBannerBlock,
        ...blocks.slice(lastHeadingIndex),
    ]
}

const endsIntro = (block: OwidEnrichedGdocBlock): boolean =>
    block.type === "heading" || block.type === "ltp-toc"

/**
 * The index of the last block of the intro: everything from the first text
 * block up to the next heading or table of contents.
 */
export const getIntroEndIndex = (blocks: OwidEnrichedGdocBlock[]): number => {
    const firstTextIndex = blocks.findIndex((block) => block.type === "text")
    if (firstTextIndex === -1) return 0
    const nextSectionIndex = blocks.findIndex(
        (block, i) => i > firstTextIndex && endsIntro(block)
    )
    return nextSectionIndex === -1 ? blocks.length - 1 : nextSectionIndex - 1
}
