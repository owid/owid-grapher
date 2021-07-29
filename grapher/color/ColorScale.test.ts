#! /usr/bin/env jest

import { CoreTable } from "../../coreTable/CoreTable"
import { BinningStrategy } from "./BinningStrategy"
import { ColorScale } from "./ColorScale"
import { ColorScaleConfigInterface } from "./ColorScaleConfig"

const createColorScaleFromTable = (
    colorValuePairs: { value: number; color?: string }[],
    colorScaleConfig: ColorScaleConfigInterface
): ColorScale => {
    const table = new CoreTable({
        colorValues: colorValuePairs.map((pair) => pair.value),
    })
    const column = table.get("colorValues")

    return new ColorScale({ colorScaleConfig, colorScaleColumn: column })
}

describe(ColorScale, () => {
    it("can create one", () => {
        const scale = new ColorScale()
        expect(scale.isColorSchemeInverted).toEqual(false)
    })
    describe("numerical color scale", () => {
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
        it("returns correct color", () => {
            const colorValuePairs = [
                { value: 0.9, color: "#182f4d" },
                { value: 1.1, color: "#3b4c61" },
                { value: 2.1, color: "#5875a6" },
                { value: 3.1, color: "#5875a6" },
            ]
            const scale = createColorScaleFromTable(
                colorValuePairs,
                colorScaleConfig
            )
            colorValuePairs.forEach(({ value, color }) =>
                expect(scale.getColor(value)).toEqual(color)
            )
        })

        it("returns correct bin indices", () => {
            const colorValuePairs = [
                { value: -10 },
                { value: 1.1 },
                { value: 2.1 },
                { value: 15 },
            ]
            const scale = createColorScaleFromTable(
                colorValuePairs,
                colorScaleConfig
            )
            const bins = scale.legendBins
            expect(scale.getBinForValue(-100)).toBeUndefined() // doesn't belong in any bin
            expect(scale.getBinForValue(-10)).toEqual(bins[0])
            expect(scale.getBinForValue(0)).toEqual(bins[0])
            expect(scale.getBinForValue(0.9)).toEqual(bins[0])
            expect(scale.getBinForValue(1)).toEqual(bins[0])
            expect(scale.getBinForValue(1.1)).toEqual(bins[1])
            expect(scale.getBinForValue(2)).toEqual(bins[1])
            expect(scale.getBinForValue(3)).toEqual(bins[2])
            expect(scale.getBinForValue(15)).toEqual(bins[2])
        })

        describe("filtering outliers", () => {
            it("should filter out outliers", () => {
                const colorValuePairs = [
                    { value: 1 },
                    { value: 1.1 },
                    { value: 1.2 },
                    { value: 1.3 },
                    { value: 1.4 },
                    { value: 1.5 },
                    { value: 1.6 },
                    { value: 1.7 },
                    { value: 100 },
                ]
                const scale = createColorScaleFromTable(
                    colorValuePairs,
                    colorScaleConfig
                )

                expect(scale.sortedNumericValuesWithoutOutliers).toEqual([
                    1,
                    1.1,
                    1.2,
                    1.3,
                    1.4,
                    1.5,
                    1.6,
                    1.7,
                ])
            })

            it("should keep outliers if removing them would result in only one unique value", () => {
                const colorValuePairs = [
                    { value: 1 },
                    { value: 1 },
                    { value: 1 },
                    { value: 1 },
                    { value: 1 },
                    { value: 1 },
                    { value: 100 },
                ]
                const scale = createColorScaleFromTable(
                    colorValuePairs,
                    colorScaleConfig
                )

                expect(scale.sortedNumericValuesWithoutOutliers).toEqual([
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    100,
                ])
            })

            it("should not filter values if there's only one", () => {
                const colorValuePairs = [{ value: 1 }]
                const scale = createColorScaleFromTable(
                    colorValuePairs,
                    colorScaleConfig
                )

                expect(scale.sortedNumericValuesWithoutOutliers).toEqual([1])
            })
        })
    })
})
