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
    new AnchoredLabelsState(series, {
        fontSize: FONT_SIZE,
        xRange: [0, Math.max(0, ...series.map((s) => s.position.x))],
        ...options,
    })

const visibleNames = (
    series: InitialAnchoredLabelSeries[],
    options: {
        compare?: Compare
        yRanges?: { edge: [number, number]; inChart?: [number, number] }
    } = {}
): string[] => makeState(series, options).series.map((s) => s.seriesName)

const labelHeight = makeState([makeSeries("A")]).series[0].bounds.height

const oneLabelRange: [number, number] = [50 + labelHeight, 50 - labelHeight]

describe(AnchoredLabelsState, () => {
    const preferB: Compare = (a, b) =>
        a.seriesName === "B" ? -1 : b.seriesName === "B" ? 1 : 0

    it("keeps the label the comparator ranks first, in either input order", () => {
        const options = { compare: preferB, yRanges: { edge: oneLabelRange } }
        expect(
            visibleNames([makeSeries("A"), makeSeries("B")], options)
        ).toEqual(["B"])
        expect(
            visibleNames([makeSeries("B"), makeSeries("A")], options)
        ).toEqual(["B"])
    })

    it("keeps the first label in input order when the comparator has no preference", () => {
        const options = { yRanges: { edge: oneLabelRange } }
        expect(
            visibleNames([makeSeries("A"), makeSeries("B")], options)
        ).toEqual(["A"])
    })

    it("prefers the label furthest from those already kept when the comparator has no preference", () => {
        const twoLabelRangeTop = 100 - labelHeight
        const twoLabelRange: [number, number] = [
            twoLabelRangeTop + 2 * labelHeight + VERTICAL_GAP,
            twoLabelRangeTop,
        ]
        const series = [
            makeSeries("A", undefined, { x: 0, y: 100 }),
            makeSeries("Near A", undefined, { x: 0, y: 101 }),
            makeSeries("Far", undefined, {
                x: 0,
                y: 100 + labelHeight + VERTICAL_GAP,
            }),
        ]
        const options = { yRanges: { edge: twoLabelRange } }

        expect(visibleNames(series, options)).toEqual(["A", "Far"])

        const rankFarLast: Compare = (a, b) =>
            Number(a.seriesName === "Far") - Number(b.seriesName === "Far")
        expect(
            visibleNames(series, { ...options, compare: rankFarLast })
        ).toEqual(["A", "Near A"])
    })

    it("prefers a highlighted label over a default one whatever the comparator says", () => {
        const options = { compare: preferB, yRanges: { edge: oneLabelRange } }
        const series = [makeSeries("A", Emphasis.Highlighted), makeSeries("B")]
        expect(visibleNames(series, options)).toEqual(["A"])
        expect(visibleNames([...series].reverse(), options)).toEqual(["A"])
    })

    it("shifts text position and bounds together when separating two labels at one anchor", () => {
        const [a, b] = makeState([makeSeries("A"), makeSeries("B")]).series
        const shift = (labelHeight + VERTICAL_GAP) / 2

        expect(a.textPosition.y).toBeCloseTo(50 - shift)
        expect(b.textPosition.y).toBeCloseTo(50 + shift)
        expect(a.bounds.y).toBeCloseTo(50 - shift - labelHeight / 2)
        expect(b.bounds.y).toBeCloseTo(50 + shift - labelHeight / 2)
    })

    it("hides the lowest-ranked label that would be pushed more than a font size", () => {
        // Separated, the outer two of three labels at one anchor move 14px
        const series = [makeSeries("A"), makeSeries("B"), makeSeries("C")]
        const preferC: Compare = (a, b) =>
            Number(b.seriesName === "C") - Number(a.seriesName === "C")
        expect(visibleNames(series, { compare: preferC })).toEqual(["A", "C"])
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

    it("treats a label as in-chart when its anchor stops short of the end of xRange", () => {
        const series = [
            makeSeries("A", undefined, { x: 100, y: 50 }),
            makeSeries("B", undefined, { x: 100, y: 50 }),
        ]
        // Separated at the edge, the pair moves 7px each; shifted in the chart, B can't move the 14px it needs
        const names = (right: number): string[] =>
            makeState(series, { xRange: [0, right] }).series.map(
                (s) => s.seriesName
            )
        expect(names(100)).toEqual(["A", "B"])
        expect(names(200)).toEqual(["A"])
    })

    it("hides an edge label that overlaps an in-chart label ranked above it", () => {
        const edge = makeSeries("Edge", Emphasis.Muted, { x: 100, y: 50 })
        const inChart = makeSeries("InChart", Emphasis.Highlighted, {
            x: 98,
            y: 50,
        })
        expect(visibleNames([edge, inChart])).toEqual(["InChart"])
    })

    it("uses the edge range for in-chart labels when no in-chart range is given", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 50 })
        const outside = makeSeries("Outside", undefined, { x: 0, y: 500 })
        expect(
            visibleNames([edge, outside], { yRanges: { edge: [200, 0] } })
        ).toEqual(["Edge"])
    })

    it("applies the in-chart range only to in-chart labels", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 150 })
        const inChart = makeSeries("InChart", undefined, { x: 0, y: 150 })
        const options = {
            yRanges: {
                edge: [200, 0] as [number, number],
                inChart: [100, 0] as [number, number],
            },
        }
        expect(makeState([edge, inChart], options).series).toEqual([
            expect.objectContaining({ seriesName: "Edge" }),
        ])
    })

    it("moves an in-chart label off another series' dot unless it is more emphasized", () => {
        const far = makeSeries("Far", undefined, { x: 200, y: 300 })
        const dotOwner = makeSeries("DotOwner", undefined, { x: 60, y: 50 })
        const placedY = (covering: InitialAnchoredLabelSeries): number =>
            makeState([covering, dotOwner, far], {
                anchorCollisionRadius: 3,
            }).series.find((s) => s.seriesName === "Covering")!.textPosition.y

        expect(
            placedY(makeSeries("Covering", undefined, { x: 50, y: 50 }))
        ).toBeLessThan(50)
        expect(
            placedY(
                makeSeries("Covering", Emphasis.Highlighted, { x: 50, y: 50 })
            )
        ).toBe(50)
    })

    it("shifts an in-chart label's text position and bounds together to the nearest free spot", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 0 })
        const blocker = makeSeries("Blocker", Emphasis.Highlighted, {
            x: 0,
            y: 100,
        })
        // Half a label below the blocker, the padded labels overlap by 8px
        const anchorY = 100 + labelHeight / 2
        const mover = makeSeries("Mover", undefined, { x: 0, y: anchorY })

        const placed = makeState([edge, blocker, mover]).series.find(
            (s) => s.seriesName === "Mover"
        )!
        const unshifted = makeState([mover]).series[0]

        expect(placed.textPosition.y - anchorY).toBe(8.5)
        expect(placed.bounds.y - unshifted.bounds.y).toBeCloseTo(8.5)
    })

    it("computes the width from the visible labels only", () => {
        const short = makeSeries("A")
        const long = makeSeries(
            "B",
            undefined,
            { x: 0, y: 50 },
            "A much longer label"
        )
        const state = makeState([short, long], {
            yRanges: { edge: oneLabelRange },
        })

        expect(state.series.map((s) => s.seriesName)).toEqual(["A"])
        expect(state.width).toBe(makeState([short]).width)
        expect(state.width).toBeLessThan(makeState([long]).width)
    })

    it("splits a parenthetical suffix off the name in regular weight", () => {
        const label = makeSeries("Africa (WHO)")
        const [placed] = makeState([label], { fontWeight: 700 }).series

        expect(placed.seriesLabel.spanLines.flat()).toEqual([
            { role: "name", text: "Africa", fontWeight: 700 },
            { role: "suffix", text: " (WHO)", fontWeight: 400 },
        ])
    })
})
