import { describe, expect, it } from "vitest"
import { Emphasis } from "../interaction/Emphasis.js"
import { InitialAnchoredLabelSeries } from "./AnchoredLabelsTypes.js"
import { AnchoredLabelsState } from "./AnchoredLabelsState.js"

const FONT_SIZE = 12
const VERTICAL_GAP = 2

const makeSeries = (
    seriesName: string,
    emphasis?: Emphasis,
    position = { x: 0, y: 50 },
    label = seriesName
): InitialAnchoredLabelSeries => ({
    seriesName,
    value: 1,
    label,
    position,
    color: "red",
    emphasis,
})

type Compare = (
    a: InitialAnchoredLabelSeries,
    b: InitialAnchoredLabelSeries
) => number

const makeState = (
    series: InitialAnchoredLabelSeries[],
    options: Partial<ConstructorParameters<typeof AnchoredLabelsState>[1]> = {}
): AnchoredLabelsState =>
    new AnchoredLabelsState(series, { fontSize: FONT_SIZE, ...options })

const visibleNames = (
    series: InitialAnchoredLabelSeries[],
    options: { compare?: Compare; yRange?: [number, number] } = {}
): string[] => makeState(series, options).series.map((s) => s.seriesName)

const labelHeight = makeState([makeSeries("A")]).series[0].bounds.height

const oneLabelRange: [number, number] = [50 + labelHeight, 50 - labelHeight]

describe(AnchoredLabelsState, () => {
    const preferB: Compare = (a, b) =>
        a.seriesName === "B" ? -1 : b.seriesName === "B" ? 1 : 0

    it("keeps the label the comparator ranks first, in either input order", () => {
        const options = { compare: preferB, yRange: oneLabelRange }
        expect(
            visibleNames([makeSeries("A"), makeSeries("B")], options)
        ).toEqual(["B"])
        expect(
            visibleNames([makeSeries("B"), makeSeries("A")], options)
        ).toEqual(["B"])
    })

    it("keeps the first label in input order when the comparator has no preference", () => {
        const options = { yRange: oneLabelRange }
        expect(
            visibleNames([makeSeries("A"), makeSeries("B")], options)
        ).toEqual(["A"])
    })

    it("prefers a highlighted label over a default one whatever the comparator says", () => {
        const options = { compare: preferB, yRange: oneLabelRange }
        const series = [makeSeries("A", Emphasis.Highlighted), makeSeries("B")]
        expect(visibleNames(series, options)).toEqual(["A"])
        expect(visibleNames([...series].reverse(), options)).toEqual(["A"])
    })

    it("keeps two labels at the same anchor, a gap apart", () => {
        const [a, b] = makeState([makeSeries("A"), makeSeries("B")]).series

        expect(
            Math.abs(a.textPosition.y - b.textPosition.y)
        ).toBeGreaterThanOrEqual(labelHeight + VERTICAL_GAP - 0.01)
        expect(Math.abs(a.bounds.y - b.bounds.y)).toBeGreaterThanOrEqual(
            labelHeight + VERTICAL_GAP - 0.01
        )
    })

    it("hides the lower-ranked label that would be pushed past maxShift", () => {
        const series = [makeSeries("A"), makeSeries("B")]
        expect(visibleNames(series, { compare: preferB })).toEqual(["A", "B"])
        expect(
            makeState(series, { compare: preferB, maxShift: 1 }).series.map(
                (s) => s.seriesName
            )
        ).toEqual(["B"])
    })

    it("hides an in-chart label that overlaps a placed edge label and keeps one that doesn't", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 50 })
        const overlapping = makeSeries("Overlapping", undefined, {
            x: 98,
            y: 50,
        })
        const clear = makeSeries("Clear", undefined, { x: 98, y: 200 })
        const state = makeState([edge, overlapping, clear])

        expect(state.series.map((s) => s.seriesName)).toEqual(["Edge", "Clear"])

        const placedClear = state.series.find((s) => s.seriesName === "Clear")!
        expect(placedClear.textPosition.y).toBe(200)
        expect(placedClear.bounds.y).toBe(makeState([clear]).series[0].bounds.y)
    })

    it("caps the shift at the font size by default", () => {
        const series = [makeSeries("A"), makeSeries("B"), makeSeries("C")]
        expect(makeState(series).series).toHaveLength(2)
        expect(makeState(series, { maxShift: Infinity }).series).toHaveLength(3)
    })

    it("hides an in-chart label that overlaps an in-chart label ranked above it", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 0 })
        const first = makeSeries("First", undefined, { x: 0, y: 100 })
        const second = makeSeries("Second", undefined, { x: 0, y: 100 })
        expect(visibleNames([edge, first, second])).toEqual(["Edge", "First"])
    })

    it("hides an in-chart label outside the range", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 50 })
        const outside = makeSeries("Outside", undefined, { x: 0, y: 500 })
        expect(visibleNames([edge, outside], { yRange: [200, 0] })).toEqual([
            "Edge",
        ])
    })

    it("hides an in-chart label covering another series' dot unless it is more emphasized", () => {
        const far = makeSeries("Far", undefined, { x: 200, y: 300 })
        const dotOwner = makeSeries("DotOwner", undefined, { x: 60, y: 50 })
        const options = { anchorCollisionRadius: 3 }

        const covering = makeSeries("Covering", undefined, { x: 50, y: 50 })
        expect(
            makeState([covering, dotOwner, far], options).series.map(
                (s) => s.seriesName
            )
        ).not.toContain("Covering")

        const highlighted = makeSeries("Covering", Emphasis.Highlighted, {
            x: 50,
            y: 50,
        })
        expect(
            makeState([highlighted, dotOwner, far], options).series.map(
                (s) => s.seriesName
            )
        ).toContain("Covering")
    })

    it("computes the width from the visible labels only", () => {
        const short = makeSeries("A")
        const long = makeSeries(
            "B",
            undefined,
            { x: 0, y: 50 },
            "A much longer label"
        )
        const state = makeState([short, long], { maxShift: 1 })

        expect(state.series.map((s) => s.seriesName)).toEqual(["A"])
        expect(state.width).toBe(makeState([short]).width)
        expect(state.width).toBeLessThan(makeState([long]).width)
    })
})
