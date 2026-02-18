import { describe, expect, it } from "vitest"
import { SeriesLabelState } from "./SeriesLabelState"

const FONT_SIZE = 14

describe("SeriesLabelState", () => {
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

    it("splits name and region provider suffix into separate fragments on the same line", () => {
        const label = new SeriesLabelState({
            text: "Latin America and the Caribbean (UN)",
            maxWidth: 140,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "Latin America and", fontWeight: 400 }],
            [
                { role: "name", text: "the Caribbean", fontWeight: 400 },
                {
                    role: "regionProviderSuffix",
                    text: " (UN)",
                    fontWeight: 400,
                },
            ],
        ])
    })

    it("does not split non-provider suffixes from the name", () => {
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
                    role: "regionProviderSuffix",
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
                    role: "regionProviderSuffix",
                    text: " (WHO)",
                    fontWeight: 400,
                },
            ],
            [{ role: "value", text: "72%", fontWeight: 400 }],
        ])
    })

    it("shows an icon next to a region provider suffix when enabled", () => {
        const label = new SeriesLabelState({
            text: "Africa (WHO)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            { type: "text", role: "name", text: "Africa" },
            { type: "text", role: "regionProviderSuffix", text: "(WHO" },
            { type: "icon", tooltipKey: "who" },
            { type: "text", role: "regionProviderSuffix", text: ")" },
        ])
    })

    it("only shows on icon if the suffix is a known region provider", () => {
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

    it("shows an icon for income group labels when enabled", () => {
        const label = new SeriesLabelState({
            text: "High-income countries",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            { type: "text", role: "name", text: "High-income countries" },
            { type: "icon", tooltipKey: "incomeGroups" },
        ])
    })
})
