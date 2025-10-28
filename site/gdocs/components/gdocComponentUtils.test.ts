import { describe, expect, it } from "vitest"
import { injectAutomaticSubscribeBar } from "./gdocComponentUtils.js"
import type {
    EnrichedBlockHeading,
    EnrichedBlockText,
    EnrichedBlockSubscribeBar,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/utils"

const headingBlock = (level: number): EnrichedBlockHeading => ({
    type: "heading",
    text: [],
    level,
    parseErrors: [],
})

const textBlock = (): EnrichedBlockText => ({
    type: "text",
    value: [],
    parseErrors: [],
})

describe("injectAutomaticSubscribeBar", () => {
    it("returns the original blocks when there is no level 1 heading", () => {
        const blocks: OwidEnrichedGdocBlock[] = [textBlock()]

        const result = injectAutomaticSubscribeBar(blocks)

        expect(result).toBe(blocks)
    })

    it("inserts a subscribe bar before the final level 1 heading", () => {
        const lastHeading = headingBlock(1)
        const blocks: OwidEnrichedGdocBlock[] = [
            textBlock(),
            headingBlock(2),
            textBlock(),
            lastHeading,
        ]

        const result = injectAutomaticSubscribeBar(blocks)

        expect(result).not.toBe(blocks)
        expect(result).toHaveLength(blocks.length + 1)
        const subscribeBar = result[
            result.length - 2
        ] as EnrichedBlockSubscribeBar
        expect(subscribeBar.type).toBe("subscribe-bar")
        expect(subscribeBar.align).toBe("center")
        expect(subscribeBar.parseErrors).toEqual([])
        expect(result[result.length - 1]).toBe(lastHeading)
    })

    it("targets the final level 1 heading when multiple exist", () => {
        const firstHeading = headingBlock(1)
        const finalHeading = headingBlock(1)
        const trailingText = textBlock()
        const blocks: OwidEnrichedGdocBlock[] = [
            textBlock(),
            firstHeading,
            textBlock(),
            finalHeading,
            trailingText,
        ]

        const result = injectAutomaticSubscribeBar(blocks)

        expect(result).toHaveLength(blocks.length + 1)
        const finalHeadingIndex = result.indexOf(finalHeading)
        expect(finalHeadingIndex).toBeGreaterThan(0)
        const subscribeBar = result[finalHeadingIndex - 1]
        expect(subscribeBar.type).toBe("subscribe-bar")
        expect(
            result.filter((block) => block.type === "subscribe-bar")
        ).toHaveLength(1)
        expect(result[finalHeadingIndex + 1]).toBe(trailingText)
    })
})
