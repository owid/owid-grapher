#! /usr/bin/env jest

import { CategoricalBin, NumericBin } from "grapher/color/ColorScaleBin"
import {
    MapCategoricalColorLegend,
    MapNumericColorLegend,
} from "./MapColorLegends"

describe(MapNumericColorLegend, () => {
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

        const legend = new MapNumericColorLegend({
            manager: { numericLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})

describe(MapCategoricalColorLegend, () => {
    test("can create one", () => {
        const bin = new CategoricalBin({
            index: 1,
            value: "North America",
            label: "100",
            color: "red",
        })

        const legend = new MapCategoricalColorLegend({
            manager: { categoricalLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})
