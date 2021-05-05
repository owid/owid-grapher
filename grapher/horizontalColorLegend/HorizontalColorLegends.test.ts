#! /usr/bin/env jest

import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import {
    HorizontalCategoricalColorLegend,
    HorizontalNumericColorLegend,
} from "./HorizontalColorLegends"

describe(HorizontalNumericColorLegend, () => {
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

        const legend = new HorizontalNumericColorLegend({
            manager: { numericLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})

describe(HorizontalCategoricalColorLegend, () => {
    test("can create one", () => {
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
