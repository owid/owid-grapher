import { expect, it, describe } from "vitest"

import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import { HorizontalCategoricalColorLegendState } from "./HorizontalCategoricalColorLegendState"
import { PositionedBin } from "./HorizontalColorLegendTypes"

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

        const state = new HorizontalNumericColorLegendState([bin], {})
        expect(state.height).toBeGreaterThan(0)
    })

    it("adds margins between categorical but not numeric bins", () => {
        const bins = [
            new CategoricalBin({
                index: 0,
                value: "a",
                label: "a",
                color: "#fff",
            }),
            new CategoricalBin({
                index: 0,
                value: "b",
                label: "b",
                color: "#fff",
            }),
            new NumericBin({
                isFirst: true,
                isOpenLeft: false,
                isOpenRight: false,
                min: 0,
                max: 1,
                displayMin: "0",
                displayMax: "1",
                color: "#fff",
            }),
            new NumericBin({
                isFirst: false,
                isOpenLeft: false,
                isOpenRight: false,
                min: 1,
                max: 2,
                displayMin: "1",
                displayMax: "2",
                color: "#fff",
            }),
            new CategoricalBin({
                index: 0,
                value: "c",
                label: "c",
                color: "#fff",
            }),
        ]

        const state = new HorizontalNumericColorLegendState(bins, {})

        const margin = state["itemMargin"]
        const positionedBins = state.positionedBins

        function marginBetween(
            binA: PositionedBin,
            binB: PositionedBin
        ): number {
            return binB.x - (binA.x + binA.width)
        }

        expect(positionedBins).toHaveLength(5)
        expect(marginBetween(positionedBins[0], positionedBins[1])).toEqual(
            margin
        )
        expect(marginBetween(positionedBins[1], positionedBins[2])).toEqual(
            margin
        )
        expect(marginBetween(positionedBins[2], positionedBins[3])).toEqual(0)
        expect(marginBetween(positionedBins[3], positionedBins[4])).toEqual(
            margin
        )
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

        const state = new HorizontalCategoricalColorLegendState([bin], {})
        expect(state.height).toBeGreaterThan(0)
    })
})
