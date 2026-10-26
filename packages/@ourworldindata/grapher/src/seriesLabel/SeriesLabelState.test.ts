import { describe, expect, it } from "vitest"
import { SeriesLabelState } from "./SeriesLabelState"

const FONT_SIZE = 14

describe(SeriesLabelState, () => {
    it("handles plain labels correctly", () => {
        const label = new SeriesLabelState({
            text: "United States",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "United States", fontWeight: 400 }],
        ])
    })

    it("splits longer labels into multiple lines", () => {
        const label = new SeriesLabelState({
            text: "Asia and Oceania (excl. China and India)",
            maxWidth: 120,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "Asia and Oceania", fontWeight: 400 }],
            [{ role: "name", text: "(excl. China and", fontWeight: 400 }],
            [{ role: "name", text: "India)", fontWeight: 400 }],
        ])
    })

    it("splits name and value into separate fragments on the same line", () => {
        const label = new SeriesLabelState({
            text: "USA",
            formattedValue: "45%",
            maxWidth: 300,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [
                { role: "name", text: "USA", fontWeight: 400 },
                { role: "value", text: " 45%", fontWeight: 400 },
            ],
        ])
    })

    it("places value on new line if requested", () => {
        const label = new SeriesLabelState({
            text: "USA",
            formattedValue: "45%",
            maxWidth: 300,
            fontSize: FONT_SIZE,
            placeFormattedValueInNewLine: true,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "USA", fontWeight: 400 }],
            [{ role: "value", text: "45%", fontWeight: 400 }],
        ])
    })

    it("splits name and region publisher suffix into separate fragments on the same line", () => {
        const label = new SeriesLabelState({
            text: "Latin America and the Caribbean (UN)",
            maxWidth: 140,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "Latin America and the", fontWeight: 400 }],
            [
                { role: "name", text: "Caribbean", fontWeight: 400 },
                {
                    role: "regionPublisherSuffix",
                    text: " (UN)",
                    fontWeight: 400,
                },
            ],
        ])
    })

    it("does not split suffixes that name no publisher from the name", () => {
        const label = new SeriesLabelState({
            text: "Asia and Oceania (excl. China and India)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [
                {
                    role: "name",
                    text: "Asia and Oceania (excl. China and India)",
                    fontWeight: 400,
                },
            ],
        ])
    })

    it("places value on new line when suffix is present", () => {
        const label = new SeriesLabelState({
            text: "Africa (WHO)",
            formattedValue: "72%",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [
                { role: "name", text: "Africa", fontWeight: 400 },
                {
                    role: "regionPublisherSuffix",
                    text: " (WHO)",
                    fontWeight: 400,
                },
            ],
            [{ role: "value", text: "72%", fontWeight: 400 }],
        ])
    })

    it("does not use bold font weight for value and suffix fragments", () => {
        const label = new SeriesLabelState({
            text: "Africa (WHO)",
            formattedValue: "72%",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            fontWeight: 700,
        })

        expect(label.spanLines).toEqual([
            [
                { role: "name", text: "Africa", fontWeight: 700 },
                {
                    role: "regionPublisherSuffix",
                    text: " (WHO)",
                    fontWeight: 400,
                },
            ],
            [{ role: "value", text: "72%", fontWeight: 400 }],
        ])
    })

    it("attaches the region tooltip to the publisher suffix when enabled", () => {
        const label = new SeriesLabelState({
            text: "Africa (WHO)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            { type: "text", role: "name", text: "Africa" },
            {
                type: "text",
                role: "regionPublisherSuffix",
                text: "(WHO)",
                regionTooltip: { tooltipKey: "who" },
            },
        ])
        expect(label.positionedFragments[0].regionTooltip).toBeUndefined()
    })

    it("only attaches a tooltip if the suffix names a known region publisher", () => {
        const label = new SeriesLabelState({
            text: "Africa (FAKE)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            {
                type: "text",
                role: "name",
                text: "Africa (FAKE)",
            },
        ])
        expect(label.positionedFragments.some((f) => f.regionTooltip)).toBe(
            false
        )
    })

    it("right-aligns fragments for textAnchor=end", () => {
        const label = new SeriesLabelState({
            text: "Latin America and the Caribbean (UN)",
            textAnchor: "end",
            fontSize: FONT_SIZE,
            maxWidth: 300,
        })

        // All fragments should have non-positive x (right edge at 0)
        for (const fragment of label.positionedFragments) {
            expect(fragment.x).toBeLessThanOrEqual(0)
        }
    })

    it("attaches the continents tooltip to continent names", () => {
        const label = new SeriesLabelState({
            text: "Africa",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            {
                type: "text",
                role: "name",
                text: "Africa",
                regionTooltip: { tooltipKey: "continents" },
            },
        ])
    })

    it("attaches the tooltip to every line of a wrapped name", () => {
        const label = new SeriesLabelState({
            text: "North America",
            maxWidth: 80,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toHaveLength(2)
        for (const fragment of label.positionedFragments) {
            expect(fragment.regionTooltip).toMatchObject({
                tooltipKey: "continents",
            })
        }
    })

    it("attaches the income groups tooltip to income group names", () => {
        const label = new SeriesLabelState({
            text: "High-income countries",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            {
                type: "text",
                role: "name",
                text: "High-income countries",
                regionTooltip: { tooltipKey: "incomeGroups" },
            },
        ])
    })

    it("does not reserve extra width for a region tooltip", () => {
        const options = {
            text: "Africa (WHO)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
        }
        const withTooltip = new SeriesLabelState({
            ...options,
            showRegionTooltip: true,
        })
        const withoutTooltip = new SeriesLabelState({
            ...options,
            showRegionTooltip: false,
        })

        expect(withTooltip.width).toBe(withoutTooltip.width)
    })

    it("resolves region from a short entity name", () => {
        const label = new SeriesLabelState({
            text: "MENA, Afghanistan and Pakistan (WB)", // Short name
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        const suffixFragment = label.positionedFragments.find(
            (f) => f.role === "regionPublisherSuffix"
        )

        // The region name should be resolved correctly even if the label uses a shorter name
        expect(suffixFragment?.regionTooltip?.regionName).toBe(
            "Middle East, North Africa, Afghanistan and Pakistan (WB)"
        )
    })

    describe("infoIconCenterOffset", () => {
        it("trails a single-line label, centered on it", () => {
            const label = new SeriesLabelState({
                text: "United States",
                maxWidth: Infinity,
                fontSize: FONT_SIZE,
            })

            expect(label.infoIconCenterOffset).toEqual({
                x: label.width + 4 + label.infoIconRadius,
                y: label.singleLineHeight / 2,
            })
        })

        it("trails the last line rather than the widest one", () => {
            const label = new SeriesLabelState({
                text: "Latin America and the Caribbean (UN)",
                maxWidth: 140,
                fontSize: FONT_SIZE,
            })

            expect(label.spanLines).toHaveLength(2)
            const lastFragment = label.positionedFragments.at(-1)!
            const lastLineWidth = lastFragment.x + lastFragment.width
            expect(lastLineWidth).toBeLessThan(label.width)

            expect(label.infoIconCenterOffset).toEqual({
                x: lastLineWidth + 4 + label.infoIconRadius,
                y: label.singleLineHeight * 1.5,
            })
        })
    })
})
