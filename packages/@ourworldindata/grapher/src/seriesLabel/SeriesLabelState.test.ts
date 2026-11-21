import { describe, expect, it } from "vitest"
import { SeriesLabelState, SeriesLabelStateOptions } from "./SeriesLabelState"

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
            text: "Asia and Oceania excluding China and India",
            maxWidth: 120,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "Asia and Oceania", fontWeight: 400 }],
            [{ role: "name", text: "excluding China", fontWeight: 400 }],
            [{ role: "name", text: "and India", fontWeight: 400 }],
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
                    role: "suffix",
                    text: " (UN)",
                    fontWeight: 400,
                },
            ],
        ])
    })

    it("splits suffixes that name no publisher from the name", () => {
        const label = new SeriesLabelState({
            text: "Asia and Oceania (excl. China and India)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [
                { role: "name", text: "Asia and Oceania", fontWeight: 400 },
                {
                    role: "suffix",
                    text: " (excl. China and India)",
                    fontWeight: 400,
                },
            ],
        ])
    })

    it("wraps a suffix that is wider than the label onto lines of its own", () => {
        const label = new SeriesLabelState({
            text: "Asia and Oceania (excl. China and India)",
            maxWidth: 120,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [{ role: "name", text: "Asia and Oceania", fontWeight: 400 }],
            [{ role: "suffix", text: "(excl. China and", fontWeight: 400 }],
            [{ role: "suffix", text: "India)", fontWeight: 400 }],
        ])
        expect(label.width).toBeLessThanOrEqual(120)
    })

    it("splits a negated region publisher suffix from the name", () => {
        const label = new SeriesLabelState({
            text: "High-income countries (non-OECD)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
        })

        expect(label.spanLines).toEqual([
            [
                {
                    role: "name",
                    text: "High-income countries",
                    fontWeight: 400,
                },
                {
                    role: "suffix",
                    text: " (non-OECD)",
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
                    role: "suffix",
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
                    role: "suffix",
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
            { type: "text", role: "suffix", text: "(WHO)" },
        ])
        expect(label.tooltipTargets).toMatchObject([
            {
                role: "suffix",
                content: { regionTooltip: { tooltipKey: "who" } },
            },
        ])
    })

    it("only attaches a tooltip if the suffix names a known region publisher", () => {
        const label = new SeriesLabelState({
            text: "Africa (FAKE)",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toMatchObject([
            { type: "text", role: "name", text: "Africa" },
            { type: "text", role: "suffix", text: "(FAKE)" },
        ])
        expect(label.tooltipTargets).toEqual([])
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

        expect(label.tooltipTargets).toMatchObject([
            {
                role: "name",
                content: { regionTooltip: { tooltipKey: "continents" } },
            },
        ])
    })

    it("attaches the tooltip to one target spanning every line of a wrapped name", () => {
        const label = new SeriesLabelState({
            text: "North America",
            maxWidth: 80,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.positionedFragments).toHaveLength(2)
        expect(label.tooltipTargets).toHaveLength(1)
        expect(label.tooltipTargets[0]).toMatchObject({
            role: "name",
            content: { regionTooltip: { tooltipKey: "continents" } },
        })
        expect(label.tooltipTargets[0].fragments).toEqual(
            label.positionedFragments
        )
    })

    it("attaches the income groups tooltip to income group names", () => {
        const label = new SeriesLabelState({
            text: "High-income countries",
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            showRegionTooltip: true,
        })

        expect(label.tooltipTargets).toMatchObject([
            {
                role: "name",
                content: { regionTooltip: { tooltipKey: "incomeGroups" } },
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

        const [target] = label.tooltipTargets

        // The region name should be resolved correctly even if the label uses a shorter name
        expect(target.role).toBe("suffix")
        expect(target.content.regionTooltip?.regionName).toBe(
            "Middle East, North Africa, Afghanistan and Pakistan (WB)"
        )
    })

    describe("tooltipTargets", () => {
        const annotations = [{ text: "A note", timeScope: "point" as const }]

        it("yields no targets without annotations or a region tooltip", () => {
            const label = new SeriesLabelState({
                text: "United States",
                maxWidth: Infinity,
                fontSize: FONT_SIZE,
            })

            expect(label.tooltipTargets).toEqual([])
        })

        it("yields one target spanning every line of a wrapped annotated name", () => {
            const label = new SeriesLabelState({
                text: "Democratic Republic of Congo",
                maxWidth: 140,
                fontSize: FONT_SIZE,
                annotations,
            })

            expect(label.tooltipTargets).toHaveLength(1)
            const [target] = label.tooltipTargets
            expect(target.role).toBe("name")
            expect(target.content.annotations).toEqual(annotations)
            expect(target.fragments).toHaveLength(2)
            expect(target.textBounds.top).toBe(-FONT_SIZE)
            expect(target.textBounds.height).toBe(
                label.singleLineHeight + FONT_SIZE
            )
        })

        it("yields only the suffix target for a region label with a publisher suffix", () => {
            const label = new SeriesLabelState({
                text: "Africa (WHO)",
                maxWidth: Infinity,
                fontSize: FONT_SIZE,
                showRegionTooltip: true,
            })

            expect(label.tooltipTargets).toHaveLength(1)
            expect(label.tooltipTargets[0].role).toBe("suffix")
        })

        it("yields the name target before the suffix target", () => {
            const label = new SeriesLabelState({
                text: "Africa (WHO)",
                maxWidth: Infinity,
                fontSize: FONT_SIZE,
                showRegionTooltip: true,
                annotations,
            })

            expect(label.tooltipTargets).toMatchObject([
                {
                    role: "name",
                    content: { annotations },
                },
                {
                    role: "suffix",
                    content: { regionTooltip: { tooltipKey: "who" } },
                },
            ])
            expect(label.tooltipTargets[0].content.regionTooltip).toBe(
                undefined
            )
        })

        it("starts the name target at the widest line's left edge for textAnchor=end", () => {
            const label = new SeriesLabelState({
                text: "Democratic Republic of Congo",
                maxWidth: 140,
                fontSize: FONT_SIZE,
                textAnchor: "end",
                annotations,
            })

            const [target] = label.tooltipTargets
            const widestLineLeft = Math.min(
                ...label.positionedFragments.map((f) => f.x)
            )
            expect(target.textBounds.left).toBe(widestLineLeft)
            expect(target.textBounds.left).toBe(-label.width)
        })
    })

    describe("width with an info icon", () => {
        const withAndWithoutInfoIcon = (
            options: Omit<SeriesLabelStateOptions, "canShowInfoIcon">
        ): [SeriesLabelState, SeriesLabelState] => [
            new SeriesLabelState({ ...options, canShowInfoIcon: true }),
            new SeriesLabelState({ ...options, canShowInfoIcon: false }),
        ]

        it("extends to the icon's right edge when the last line is the widest", () => {
            const [label, textOnly] = withAndWithoutInfoIcon({
                text: "United States",
                maxWidth: Infinity,
                fontSize: FONT_SIZE,
            })

            expect(label.width).toBe(
                textOnly.width + 4 + 2 * label.infoIconRadius
            )
        })

        it("stays at the widest line when the icon fits beside a shorter last line", () => {
            const [label, textOnly] = withAndWithoutInfoIcon({
                text: "Latin America and the Caribbean",
                maxWidth: 140,
                fontSize: FONT_SIZE,
            })

            const lastFragment = label.positionedFragments.at(-1)!
            const lastLineWidth = lastFragment.x + lastFragment.width
            expect(lastLineWidth + 4 + 2 * label.infoIconRadius).toBeLessThan(
                textOnly.width
            )

            expect(label.width).toBe(textOnly.width)
        })
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
