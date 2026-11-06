import { describe, expect, it } from "vitest"
import { enrichSeriesWithLabels } from "./RowSeriesLabelHelpers"

const fontSettings = { fontSize: 12, fontWeight: 700, lineHeight: 1 }

const TOO_LONG_TO_FIT =
    "The very long name of a fictional region that stretches across many " +
    "countries and territories in the world and keeps going on and on so " +
    "that it has to be truncated by the label layout"

function getLineTexts(label: { spanLines: { text: string }[][] }): string[] {
    return label.spanLines.map((line) => line.map((span) => span.text).join(""))
}

describe(enrichSeriesWithLabels, () => {
    const twoLineRows = {
        availableHeightPerSeries: 30,
        minLabelWidth: 50,
        maxLabelWidth: 200,
        fontSettings,
    }

    it("re-wraps labels within the column set by the widest label", () => {
        const [widest, rewrapped] = enrichSeriesWithLabels({
            ...twoLineRows,
            series: [
                { entityName: "Lower-middle-income countries" },
                { entityName: "Latin America" },
            ],
        })

        expect(getLineTexts(widest.label)).toEqual([
            "Lower-middle-income",
            "countries",
        ])
        expect(getLineTexts(rewrapped.label)).toEqual(["Latin America"])
        expect(rewrapped.label.width).toBeLessThanOrEqual(widest.label.width)
    })

    it("cuts truncated labels to the narrow labels' width however far other rows widen", () => {
        const series = [
            { entityName: TOO_LONG_TO_FIT },
            { entityName: "Middle East and North Africa" },
            { entityName: "Europe" },
        ]

        const [truncated, wrapped] = enrichSeriesWithLabels({
            ...twoLineRows,
            series,
        })
        const [truncatedNextToWidened, widened] = enrichSeriesWithLabels({
            ...twoLineRows,
            series,
            getLabelRightEdges: (leftLabelsWidth) => [
                leftLabelsWidth,
                leftLabelsWidth + 500,
                leftLabelsWidth,
            ],
        })

        expect(getLineTexts(wrapped.label)).toEqual([
            "Middle East and",
            "North Africa",
        ])
        expect(getLineTexts(widened.label)).toEqual([
            "Middle East and North Africa",
        ])
        expect(getLineTexts(truncated.label)).toEqual(["The very long …"])
        expect(getLineTexts(truncatedNextToWidened.label)).toEqual([
            "The very long …",
        ])
    })

    it("draws the annotation of a truncated row without widening the truncation width", () => {
        const minLabelWidth = 120
        const [truncated] = enrichSeriesWithLabels({
            series: [
                {
                    entityName: TOO_LONG_TO_FIT + " " + TOO_LONG_TO_FIT,
                    annotation: "Estimate based on partial survey data",
                },
                { entityName: "France" },
            ],
            availableHeightPerSeries: 40,
            minLabelWidth,
            maxLabelWidth: 264,
            fontSettings,
        })

        expect(getLineTexts(truncated.label)).toHaveLength(1)
        expect(truncated.label.text.endsWith("…")).toBe(true)
        expect(truncated.annotationTextWrap?.lines).toHaveLength(2)
        expect(truncated.annotationTextWrap!.width).toBeLessThanOrEqual(
            minLabelWidth
        )
    })
})
