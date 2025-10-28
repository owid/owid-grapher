import {
    EnrichedBlockSubscribeBar,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"

export const injectAutomaticSubscribeBar = (
    blocks: OwidEnrichedGdocBlock[]
): OwidEnrichedGdocBlock[] => {
    const lastHeadingIndex = blocks.findLastIndex(
        (block) => block.type === "heading" && block.level === 1
    )

    if (lastHeadingIndex === -1) return blocks

    const subscribeBarBlock: EnrichedBlockSubscribeBar = {
        type: "subscribe-bar",
        align: "center",
        parseErrors: [],
    }

    return [
        ...blocks.slice(0, lastHeadingIndex),
        subscribeBarBlock,
        ...blocks.slice(lastHeadingIndex),
    ]
}
