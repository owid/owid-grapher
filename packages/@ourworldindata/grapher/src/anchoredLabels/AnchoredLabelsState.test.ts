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
    options: {
        compare?: Compare
        yRange?: [number, number]
        maxNudge?: number
    } = {}
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
        const state = makeState([edge, overlapping, clear], { maxNudge: 0 })

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
        const options = { anchorCollisionRadius: 3, maxNudge: 0 }

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

    describe("nudging in-chart labels", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 0 })
        const blocker = makeSeries("Blocker", Emphasis.Highlighted, {
            x: 0,
            y: 100,
        })
        const anchorY = 100 + labelHeight / 2
        const mover = makeSeries("Mover", undefined, { x: 0, y: anchorY })

        it("moves an in-chart label that collides at its anchor to a free spot within maxNudge", () => {
            const maxNudge = labelHeight
            const placed = makeState([edge, blocker, mover], {
                maxNudge,
            }).series.find((s) => s.seriesName === "Mover")!

            expect(placed).toBeDefined()
            const distance = Math.abs(placed.textPosition.y - anchorY)
            expect(distance).toBeGreaterThan(0)
            expect(distance).toBeLessThanOrEqual(maxNudge)
            expect(placed.bounds.y).toBeCloseTo(
                makeState([mover]).series[0].bounds.y +
                    (placed.textPosition.y - anchorY)
            )
        })

        it("nudges by up to the font size by default", () => {
            expect(visibleNames([edge, blocker, mover])).toContain("Mover")
        })

        it("tries above before below when both are free", () => {
            const centered = makeSeries("Mover", undefined, { x: 0, y: 100 })
            const placed = makeState([edge, blocker, centered], {
                maxNudge: 2 * labelHeight,
            }).series.find((s) => s.seriesName === "Mover")!
            expect(placed.textPosition.y).toBeLessThan(100)
        })

        it("keeps later labels clear of a label at its nudged position", () => {
            const nextAnchorY = anchorY + labelHeight + VERTICAL_GAP
            const next = makeSeries("Next", undefined, { x: 0, y: nextAnchorY })
            const state = makeState([edge, blocker, mover, next], {
                maxNudge: 2 * labelHeight,
            })
            const [placedMover, placedNext] = ["Mover", "Next"].map((name) =>
                state.series.find((s) => s.seriesName === name)!
            )
            expect(
                Math.abs(placedNext.textPosition.y - placedMover.textPosition.y)
            ).toBeGreaterThanOrEqual(labelHeight + VERTICAL_GAP - 0.01)
        })

        it("hides the colliding label when maxNudge is 0", () => {
            expect(
                visibleNames([edge, blocker, mover], { maxNudge: 0 })
            ).toEqual(["Edge", "Blocker"])
        })

        it("keeps the higher-ranked label at its anchor when two compete for one free spot", () => {
            const first = makeSeries("First", undefined, { x: 0, y: 100 })
            const second = makeSeries("Second", undefined, { x: 0, y: 100 })
            const state = makeState([edge, first, second], {
                yRange: [
                    100 + labelHeight / 2 + 0.5,
                    100 - labelHeight / 2 - 0.5,
                ],
                maxNudge: labelHeight,
            })

            const placedFirst = state.series.find(
                (s) => s.seriesName === "First"
            )!
            expect(placedFirst.textPosition.y).toBe(100)
            expect(state.series.some((s) => s.seriesName === "Second")).toBe(
                false
            )
        })
    })
})
