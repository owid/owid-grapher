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
