import { expect, it, describe } from "vitest"

import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import { HorizontalCategoricalColorLegendState } from "./HorizontalCategoricalColorLegendState"
import { PositionedBin } from "./HorizontalColorLegendTypes"

function makeCategoricalBin(value: string): CategoricalBin {
    return new CategoricalBin({
        index: 0,
        value,
        label: value,
        color: "#fff",
    })
}

function makeNumericBin(min: number, max: number): NumericBin {
    return new NumericBin({
        isFirst: min === 0,
        isOpenLeft: false,
        isOpenRight: false,
        min,
        max,
        displayMin: `${min}`,
        displayMax: `${max}`,
        color: "#fff",
    })
}

function marginBetween(binA: PositionedBin, binB: PositionedBin): number {
    return binB.x - (binA.x + binA.width)
}

describe(HorizontalNumericColorLegendState, () => {
    it("can create one", () => {
        const bin = new NumericBin({
            isFirst: false,
            isOpenLeft: false,
            isOpenRight: true,
            min: 0,
            max: 100,
            displayMin: "Zero",
            displayMax: "One hundred",
            color: "blue",
        })

        const state = new HorizontalNumericColorLegendState([bin], {
            maxWidth: 200,
        })
        expect(state.height).toBeGreaterThan(0)
    })

    it("adds margins between categorical but not numeric bins", () => {
        const state = new HorizontalNumericColorLegendState(
            [
                makeCategoricalBin("a"),
                makeCategoricalBin("b"),
                makeNumericBin(0, 1),
                makeNumericBin(1, 2),
                makeCategoricalBin("c"),
            ],
            { maxWidth: 200 }
        )

        const bins = state.positionedBins
        expect(bins).toHaveLength(5)

        const margin = marginBetween(bins[0], bins[1])
        expect(margin).toBeGreaterThan(0)
        expect(marginBetween(bins[1], bins[2])).toEqual(margin)
        expect(marginBetween(bins[2], bins[3])).toEqual(0)
        expect(marginBetween(bins[3], bins[4])).toEqual(margin)
    })
})

describe(HorizontalCategoricalColorLegendState, () => {
    it("can create one", () => {
        const bin = new CategoricalBin({
            index: 1,
            value: "North America",
            label: "100",
            color: "red",
        })

        const state = new HorizontalCategoricalColorLegendState([bin], {
            width: 200,
        })
        expect(state.height).toBeGreaterThan(0)
    })
})
