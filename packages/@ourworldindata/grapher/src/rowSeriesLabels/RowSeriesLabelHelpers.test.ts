import { describe, expect, it } from "vitest"
import { enrichSeriesWithLabels } from "./RowSeriesLabelHelpers"

const fontSettings = { fontSize: 12, fontWeight: 700, lineHeight: 1 }

const TOO_LONG_TO_FIT =
    "The very long name of a fictional region that stretches across many " +
    "countries and territories in the world and keeps going on and on so " +
    "that it has to be truncated by the label layout"

const TALL_AT_NARROW_WIDTH =
    "Estimate based on partial survey data collected in selected regions"

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

    it("shows the full annotation of a truncated row", () => {
        const annotation = "Estimate based on partial survey data"
        const [truncated] = enrichSeriesWithLabels({
            series: [
                {
                    entityName: TOO_LONG_TO_FIT + " " + TOO_LONG_TO_FIT,
                    annotation,
                },
                { entityName: "France" },
            ],
            availableHeightPerSeries: 40,
            minLabelWidth: 120,
            maxLabelWidth: 264,
            fontSettings,
        })

        expect(getLineTexts(truncated.label)).toHaveLength(1)
        expect(truncated.label.text.endsWith("…")).toBe(true)
        expect(truncated.annotationTextWrap?.text).toEqual(annotation)
        expect(truncated.annotationTextWrap!.width).toBeLessThanOrEqual(150)
    })

    describe("annotations", () => {
        const roomyRows = {
            ...twoLineRows,
            availableHeightPerSeries: 40,
        }

        it("keeps every annotation in full when all rows have room", () => {
            const annotated = enrichSeriesWithLabels({
                ...roomyRows,
                series: [
                    { entityName: "France", annotation: "Estimate" },
                    { entityName: "Chad", annotation: "Survey data" },
                ],
            })

            expect(
                annotated.map((row) => row.annotationTextWrap?.text)
            ).toEqual(["Estimate", "Survey data"])
        })

        it("drops every annotation when one row has no room for its own", () => {
            const annotated = enrichSeriesWithLabels({
                ...twoLineRows,
                series: [
                    { entityName: "France", annotation: "Estimate" },
                    { entityName: "Chad", annotation: "Survey data" },
                    {
                        entityName: "Lower-middle-income countries",
                        annotation: "Estimate",
                    },
                ],
            })

            expect(annotated.map((row) => row.annotationTextWrap)).toEqual([
                undefined,
                undefined,
                undefined,
            ])
            expect(annotated.map((row) => row.annotation)).toEqual([
                "Estimate",
                "Survey data",
                "Estimate",
            ])
        })

        it("treats an annotation too long for the full label width as not fitting", () => {
            const annotated = enrichSeriesWithLabels({
                ...roomyRows,
                series: [
                    { entityName: "France", annotation: TOO_LONG_TO_FIT },
                    { entityName: "Chad", annotation: "Survey data" },
                ],
            })

            expect(annotated.map((row) => row.annotationTextWrap)).toEqual([
                undefined,
                undefined,
            ])
        })

        it("wraps annotations at the narrow width under short labels", () => {
            const [annotated] = enrichSeriesWithLabels({
                ...roomyRows,
                series: [
                    { entityName: "France", annotation: "Survey data" },
                    { entityName: "Chad" },
                ],
            })
            const [narrowed] = enrichSeriesWithLabels({
                ...roomyRows,
                maxLabelWidth: 100,
                series: [{ entityName: "France", annotation: "Survey data" }],
            })

            expect(annotated.annotationTextWrap?.maxWidth).toBe(150)
            expect(narrowed.annotationTextWrap?.maxWidth).toBe(100)
        })

        it("drops an annotation too tall at the narrow width instead of widening it", () => {
            const series = [
                { entityName: "France", annotation: TALL_AT_NARROW_WIDTH },
                { entityName: "Chad" },
            ]

            const annotated = enrichSeriesWithLabels({ ...roomyRows, series })
            const [roomier] = enrichSeriesWithLabels({
                ...roomyRows,
                availableHeightPerSeries: 60,
                series,
            })

            expect(annotated.map((row) => row.annotationTextWrap)).toEqual([
                undefined,
                undefined,
            ])
            expect(roomier.annotationTextWrap?.maxWidth).toBe(150)
        })

        it("wraps annotations at the width of a label wider than the narrow width", () => {
            const [wideLabelRow] = enrichSeriesWithLabels({
                ...roomyRows,
                minLabelWidth: 200,
                maxLabelWidth: 300,
                series: [
                    {
                        entityName: "Democratic Republic of the Congo",
                        annotation: TALL_AT_NARROW_WIDTH,
                    },
                    { entityName: "Chad" },
                ],
            })

            expect(wideLabelRow.label.width).toBeGreaterThan(150)
            expect(wideLabelRow.annotationTextWrap?.maxWidth).toBe(
                wideLabelRow.label.width
            )
        })
    })

    describe("dropped annotations in the tooltip", () => {
        const rowsWithDroppedAnnotations = {
            ...twoLineRows,
            series: [
                { entityName: "France", annotation: "Estimate" },
                { entityName: "Chad" },
                {
                    entityName: "Lower-middle-income countries",
                    annotation: "Survey data",
                },
            ],
        }

        const getTooltipAnnotations = (
            label: ReturnType<typeof enrichSeriesWithLabels>[number]["label"]
        ): unknown[] =>
            label.tooltipTargets.flatMap(
                (target) => target.content.annotations ?? []
            )

        it("moves a dropped annotation into its row's label tooltip", () => {
            const annotated = enrichSeriesWithLabels({
                ...rowsWithDroppedAnnotations,
                showDroppedAnnotationsInTooltip: true,
            })

            expect(annotated.map((row) => row.annotationTextWrap)).toEqual([
                undefined,
                undefined,
                undefined,
            ])
            expect(
                annotated.map((row) => getTooltipAnnotations(row.label))
            ).toEqual([
                [{ text: "Estimate", timeScope: "all" }],
                [],
                [{ text: "Survey data", timeScope: "all" }],
            ])
        })

        it("leaves labels without annotations when the option is off", () => {
            const annotated = enrichSeriesWithLabels(rowsWithDroppedAnnotations)

            expect(
                annotated.map((row) => getTooltipAnnotations(row.label))
            ).toEqual([[], [], []])
        })

        it("leaves labels without annotations when every annotation fits", () => {
            const annotated = enrichSeriesWithLabels({
                ...twoLineRows,
                availableHeightPerSeries: 40,
                series: [
                    { entityName: "France", annotation: "Estimate" },
                    { entityName: "Chad" },
                    { entityName: "Mali", annotation: "Survey data" },
                ],
                showDroppedAnnotationsInTooltip: true,
            })

            expect(
                annotated.map((row) => row.annotationTextWrap?.text)
            ).toEqual(["Estimate", undefined, "Survey data"])
            expect(
                annotated.map((row) => getTooltipAnnotations(row.label))
            ).toEqual([[], [], []])
        })
    })
})
