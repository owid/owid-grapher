import { describe, expect, it } from "vitest"
import {
    getIntroEndIndex,
    injectAutomaticSubscribeBanner,
} from "./gdocComponentUtils.js"
import type {
    EnrichedBlockHeading,
    EnrichedBlockList,
    EnrichedBlockLTPToc,
    EnrichedBlockResourcePanel,
    EnrichedBlockText,
    EnrichedBlockSubscribeBanner,
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

const listBlock = (): EnrichedBlockList => ({
    type: "list",
    items: [],
    parseErrors: [],
})

const ltpTocBlock = (): EnrichedBlockLTPToc => ({
    type: "ltp-toc",
    parseErrors: [],
})

const resourcePanelBlock = (): EnrichedBlockResourcePanel => ({
    type: "resource-panel",
    title: "",
    links: [],
    parseErrors: [],
})

describe(injectAutomaticSubscribeBanner, () => {
    it("returns the original blocks when there is no level 1 heading", () => {
        const blocks: OwidEnrichedGdocBlock[] = [textBlock()]

        const result = injectAutomaticSubscribeBanner(blocks)

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

        const result = injectAutomaticSubscribeBanner(blocks)

        expect(result).not.toBe(blocks)
        expect(result).toHaveLength(blocks.length + 1)
        const SubscribeBanner = result[
            result.length - 2
        ] as EnrichedBlockSubscribeBanner
        expect(SubscribeBanner.type).toBe("subscribe-banner")
        expect(SubscribeBanner.align).toBe("center")
        expect(SubscribeBanner.parseErrors).toEqual([])
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

        const result = injectAutomaticSubscribeBanner(blocks)

        expect(result).toHaveLength(blocks.length + 1)
        const finalHeadingIndex = result.indexOf(finalHeading)
        expect(finalHeadingIndex).toBeGreaterThan(0)
        const SubscribeBanner = result[finalHeadingIndex - 1]
        expect(SubscribeBanner.type).toBe("subscribe-banner")
        expect(
            result.filter((block) => block.type === "subscribe-banner")
        ).toHaveLength(1)
        expect(result[finalHeadingIndex + 1]).toBe(trailingText)
    })
})

describe(getIntroEndIndex, () => {
    it("points at the last block before the heading that follows the first text block", () => {
        expect(
            getIntroEndIndex([
                headingBlock(1),
                textBlock(),
                textBlock(),
                listBlock(),
                resourcePanelBlock(),
                textBlock(),
                headingBlock(2),
                textBlock(),
            ])
        ).toBe(5)
    })

    it("stops at a table of contents", () => {
        expect(
            getIntroEndIndex([
                textBlock(),
                textBlock(),
                ltpTocBlock(),
                headingBlock(1),
                textBlock(),
            ])
        ).toBe(1)
    })

    it("points at the only paragraph when the intro is a single one", () => {
        expect(
            getIntroEndIndex([textBlock(), headingBlock(2), textBlock()])
        ).toBe(0)
    })

    it("runs to the end when nothing closes the intro", () => {
        expect(getIntroEndIndex([textBlock(), textBlock()])).toBe(1)
    })

    it("falls back to the first block when there is no text", () => {
        expect(getIntroEndIndex([headingBlock(1)])).toBe(0)
        expect(getIntroEndIndex([])).toBe(0)
    })
})
