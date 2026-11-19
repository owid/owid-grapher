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

    it("keeps two labels at the same anchor, a gap apart", () => {
        const [a, b] = makeState([makeSeries("A"), makeSeries("B")]).series

        expect(
            Math.abs(a.textPosition.y - b.textPosition.y)
        ).toBeGreaterThanOrEqual(labelHeight + VERTICAL_GAP - 0.01)
        expect(Math.abs(a.bounds.y - b.bounds.y)).toBeGreaterThanOrEqual(
            labelHeight + VERTICAL_GAP - 0.01
        )
    })

    it("hides the lowest-ranked label that would be pushed more than a font size", () => {
        // Packed together, the outer two of three labels at one anchor move 14px
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

    it("places labels anchored short of the plot edge in the chart, even when none reaches it", () => {
        const series = [
            makeSeries("A", undefined, { x: 100, y: 50 }),
            makeSeries("B", undefined, { x: 100, y: 50 }),
        ]
        // Packed in the edge column, the pair moves 7px each; nudged in the chart, B can't move the 14px it needs
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

    it("hides an in-chart label that overlaps an in-chart label ranked above it", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 0 })
        const first = makeSeries("First", undefined, { x: 0, y: 100 })
        const second = makeSeries("Second", undefined, { x: 0, y: 100 })
        expect(visibleNames([edge, first, second])).toEqual(["Edge", "First"])
    })

    it("hides an in-chart label outside the range", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 50 })
        const outside = makeSeries("Outside", undefined, { x: 0, y: 500 })
        expect(
            visibleNames([edge, outside], { yRanges: { edge: [200, 0] } })
        ).toEqual(["Edge"])
    })

    it("keeps in-chart labels inside the in-chart range and edge labels inside the edge range", () => {
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

    describe("nudging in-chart labels", () => {
        const edge = makeSeries("Edge", undefined, { x: 100, y: 0 })
        const blocker = makeSeries("Blocker", Emphasis.Highlighted, {
            x: 0,
            y: 100,
        })
        const anchorY = 100 + labelHeight / 2
        const mover = makeSeries("Mover", undefined, { x: 0, y: anchorY })

        it("moves an in-chart label that collides at its anchor to a free spot within the font size", () => {
            const placed = makeState([edge, blocker, mover]).series.find(
                (s) => s.seriesName === "Mover"
            )!

            expect(placed).toBeDefined()
            const distance = Math.abs(placed.textPosition.y - anchorY)
            expect(distance).toBeGreaterThan(0)
            expect(distance).toBeLessThanOrEqual(FONT_SIZE)
            expect(placed.bounds.y).toBeCloseTo(
                makeState([mover]).series[0].bounds.y +
                    (placed.textPosition.y - anchorY)
            )
        })

        it("tries above before below when both are free", () => {
            const centered = makeSeries("Mover", undefined, { x: 0, y: 100 })
            const dotOwner = makeSeries("DotOwner", undefined, {
                x: 10,
                y: 100,
            })
            const placed = makeState([edge, centered, dotOwner], {
                anchorCollisionRadius: 3,
            }).series.find((s) => s.seriesName === "Mover")!
            expect(placed.textPosition.y).toBeLessThan(100)
        })

        it("keeps later labels clear of a label at its nudged position", () => {
            const nextAnchorY = anchorY + labelHeight + VERTICAL_GAP
            const next = makeSeries("Next", undefined, { x: 0, y: nextAnchorY })
            const rankMoverFirst: Compare = (a, b) =>
                Number(b.seriesName === "Mover") -
                Number(a.seriesName === "Mover")
            const state = makeState([edge, blocker, mover, next], {
                compare: rankMoverFirst,
            })
            const [placedMover, placedNext] = ["Mover", "Next"].map((name) =>
                state.series.find((s) => s.seriesName === name)!
            )
            expect(
                Math.abs(placedNext.textPosition.y - placedMover.textPosition.y)
            ).toBeGreaterThanOrEqual(labelHeight + VERTICAL_GAP - 0.01)
        })

        it("hides an in-chart label with no free spot within the font size", () => {
            // On the blocker's anchor, the label has to move 14px either way
            const centered = makeSeries("Mover", undefined, { x: 0, y: 100 })
            expect(visibleNames([edge, blocker, centered])).toEqual([
                "Edge",
                "Blocker",
            ])
        })

        it("keeps the higher-ranked label at its anchor when two compete for one free spot", () => {
            const first = makeSeries("First", undefined, { x: 0, y: 100 })
            const second = makeSeries("Second", undefined, { x: 0, y: 100 })
            const state = makeState([edge, first, second], {
                yRanges: {
                    edge: [
                        100 + labelHeight / 2 + 0.5,
                        100 - labelHeight / 2 - 0.5,
                    ],
                },
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
