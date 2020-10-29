#! /usr/bin/env yarn jest

import { CoreTable } from "coreTable/CoreTable"
import { BinningStrategy } from "./BinningStrategies"
import { ColorScale } from "./ColorScale"
import { ColorScaleConfigInterface } from "./ColorScaleConfig"

describe(ColorScale, () => {
    it("can create one", () => {
        const scale = new ColorScale()
        expect(scale.isColorSchemeInverted).toEqual(false)
    })
    describe("numerical color scale", () => {
        const colorValuePairs = [
            { value: 0.9, color: "#182f4d" },
            { value: 1.1, color: "#3b4c61" },
            { value: 2.1, color: "#5875a6" },
            { value: 3.1, color: "#5875a6" },
        ]
        const table = new CoreTable({
            colorValues: colorValuePairs.map((pair) => pair.value),
        })
        const column = table.get("colorValues")
        const colorScaleConfig: ColorScaleConfigInterface = {
            binningStrategy: BinningStrategy.manual,
            customNumericValues: [1, 2, 3],
            customNumericLabels: [],
            customNumericColorsActive: true,
            customNumericColors: ["#182f4d", "#3b4c61", "#5875a6"],
            customCategoryColors: {},
            customCategoryLabels: {},
            customHiddenCategories: {},
        }
        const scale = new ColorScale({
            colorScaleConfig,
            colorScaleColumn: column,
        })
        it("returns correct color", () => {
            colorValuePairs.forEach(({ value, color }) =>
                expect(scale.getColor(value)).toEqual(color)
            )
        })
    })
})
