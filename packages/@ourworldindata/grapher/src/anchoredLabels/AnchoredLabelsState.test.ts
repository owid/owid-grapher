import { describe, expect, it } from "vitest"
import { Emphasis } from "../interaction/Emphasis.js"
import { InitialAnchoredLabelSeries } from "./AnchoredLabelsTypes.js"
import { AnchoredLabelsState } from "./AnchoredLabelsState.js"

const makeSeries = (
    seriesName: string,
    emphasis?: Emphasis
): InitialAnchoredLabelSeries => ({
    seriesName,
    value: 1,
    label: seriesName,
    position: { x: 0, y: 50 },
    color: "red",
    emphasis,
})

const visibleNames = (
    series: InitialAnchoredLabelSeries[],
    compare?: (
        a: InitialAnchoredLabelSeries,
        b: InitialAnchoredLabelSeries
    ) => number
): string[] =>
    new AnchoredLabelsState(series, { fontSize: 12, compare }).series.map(
        (s) => s.seriesName
    )

describe(AnchoredLabelsState, () => {
    const preferB = (
        a: InitialAnchoredLabelSeries,
        b: InitialAnchoredLabelSeries
    ): number => (a.seriesName === "B" ? -1 : b.seriesName === "B" ? 1 : 0)

    it("keeps the label the comparator ranks first, in either input order", () => {
        expect(
            visibleNames([makeSeries("A"), makeSeries("B")], preferB)
        ).toEqual(["B"])
        expect(
            visibleNames([makeSeries("B"), makeSeries("A")], preferB)
        ).toEqual(["B"])
    })

    it("keeps the first label in input order when the comparator has no preference", () => {
        expect(visibleNames([makeSeries("A"), makeSeries("B")])).toEqual(["A"])
    })

    it("prefers a highlighted label over a default one whatever the comparator says", () => {
        const series = [makeSeries("A", Emphasis.Highlighted), makeSeries("B")]
        expect(visibleNames(series, preferB)).toEqual(["A"])
        expect(visibleNames([...series].reverse(), preferB)).toEqual(["A"])
    })
})
