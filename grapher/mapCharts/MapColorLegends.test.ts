#! /usr/bin/env yarn jest

import { CategoricalBin, NumericBin } from "grapher/color/ColorScaleBin"
import { CategoricalColorLegend, NumericColorLegend } from "./MapColorLegends"

describe(NumericColorLegend, () => {
    test("can create one", () => {
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

        const legend = new NumericColorLegend({
            options: { numericLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})

describe(CategoricalColorLegend, () => {
    test("can create one", () => {
        const bin = new CategoricalBin({
            index: 1,
            value: "North America",
            label: "100",
            color: "red",
        })

        const legend = new CategoricalColorLegend({
            options: { categoricalLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})
