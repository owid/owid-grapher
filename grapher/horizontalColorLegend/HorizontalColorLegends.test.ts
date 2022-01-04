#! /usr/bin/env jest

import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import {
    HorizontalCategoricalColorLegend,
    HorizontalNumericColorLegend,
    PositionedBin,
} from "./HorizontalColorLegends"

describe(HorizontalNumericColorLegend, () => {
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

        const legend = new HorizontalNumericColorLegend({
            manager: { numericLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })

    it("adds margins between categorical but not numeric bins", () => {
        const bin = new NumericBin({
            isFirst: false,
            isOpenLeft: false,
            isOpenRight: false,
            min: 0,
            max: 100,
            displayMin: "Zero",
            displayMax: "One hundred",
            color: "blue",
        })

        const legend = new HorizontalNumericColorLegend({
            manager: {
                numericLegendData: [
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
                ],
            },
        })

        const margin = legend["itemMargin"]
        const bins = legend["positionedBins"]

        function marginBetween(
            binA: PositionedBin,
            binB: PositionedBin
        ): number {
            return binB.x - (binA.x + binA.width)
        }

        expect(bins).toHaveLength(5)
        expect(marginBetween(bins[0], bins[1])).toEqual(margin)
        expect(marginBetween(bins[1], bins[2])).toEqual(margin)
        expect(marginBetween(bins[2], bins[3])).toEqual(0)
        expect(marginBetween(bins[3], bins[4])).toEqual(margin)
    })
})

describe(HorizontalCategoricalColorLegend, () => {
    it("can create one", () => {
        const bin = new CategoricalBin({
            index: 1,
            value: "North America",
            label: "100",
            color: "red",
        })

        const legend = new HorizontalCategoricalColorLegend({
            manager: { categoricalLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})
