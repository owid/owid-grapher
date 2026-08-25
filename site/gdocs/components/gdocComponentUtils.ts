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

/**
 * Index of the block that a right-rail aside should be rendered *after* so that
 * CSS grid auto-placement lines the aside up with the page's intro instead of
 * pushing the intro down a row.
 *
 * Grid items are placed in document order and the auto-placement cursor only
 * ever moves forwards, so an aside at `col-start-11` placed before the first
 * narrow (`col-start-5`) block claims a row of its own. Placing it right after
 * the first paragraph instead leaves the cursor at column 11 of that
 * paragraph's row, which is where we want the aside. Any leading heading is
 * skipped for the same reason.
 */
export const getIntroAsideInsertionIndex = (
    blocks: OwidEnrichedGdocBlock[]
): number => {
    const firstTextIndex = blocks.findIndex((block) => block.type === "text")
    return firstTextIndex === -1 ? 0 : firstTextIndex
}
