import { Color } from "coreTable/CoreTableConstants"
import { rgb, interpolate } from "d3"
import { ChartSeries } from "grapher/chart/ChartInterface"
import { SeriesColorMap, SeriesName } from "grapher/core/GrapherConstants"
import { lastOfNonEmptyArray, clone, isPresent } from "grapher/utils/Util"
import { ColorSchemeInterface } from "./ColorConstants"
import { getLeastUsedColor, interpolateArray } from "./ColorUtils"

export class ColorScheme implements ColorSchemeInterface {
    name: string
    colorSets: Color[][]
    singleColorScale: boolean
    isDistinct: boolean

    constructor(
        name: string,
        colorSets: Color[][],
        singleColorScale?: boolean,
        isDistinct?: boolean
    ) {
        this.name = name
        this.colorSets = []
        this.singleColorScale = !!singleColorScale
        this.isDistinct = !!isDistinct
        colorSets.forEach((set) => (this.colorSets[set.length] = set))
    }

    improviseGradientFromShorter(
        shortColors: Color[],
        numColors: number
    ): Color[] {
        const newColors = clone(shortColors)

        while (newColors.length < numColors) {
            for (let index = newColors.length - 1; index > 0; index -= 1) {
                const startColor = rgb(newColors[index - 1])
                const endColor = rgb(newColors[index])
                const newColor = interpolate(startColor, endColor)(0.5)
                newColors.splice(index, 0, newColor)

                if (newColors.length >= numColors) break
            }
        }

        return newColors
    }

    improviseGradientFromLonger(
        knownColors: Color[],
        numColors: number
    ): Color[] {
        const newColors = []
        const scale = interpolateArray(knownColors)
        for (let index = 0; index < numColors; index++) {
            newColors.push(scale(index / numColors))
        }
        return newColors
    }

    getGradientColors(numColors: number): Color[] {
        const { colorSets } = this

        if (colorSets[numColors]) return clone(colorSets[numColors])

        const prevColors = clone(colorSets)
            .reverse()
            .find((set) => set && set.length < numColors)
        if (prevColors)
            return this.improviseGradientFromShorter(prevColors, numColors)
        else
            return this.improviseGradientFromLonger(
                colorSets.find((set) => !!set) as Color[],
                numColors
            )
    }

    getDistinctColors(numColors: number): Color[] {
        const { colorSets } = this
        if (colorSets.length === 0) return []
        if (colorSets[numColors]) return clone(colorSets[numColors])

        if (numColors > colorSets.length - 1) {
            // If more colors are wanted than we have defined, have to improvise
            const colorSet = lastOfNonEmptyArray(colorSets)
            return this.improviseGradientFromShorter(colorSet, numColors)
        }

        // We have enough colors but not a specific set for this number-- improvise from the closest longer set
        for (let i = numColors; i < colorSets.length; i++) {
            if (colorSets[i]) {
                return colorSets[i].slice(0, numColors)
            }
        }

        return []
    }

    getColors(numColors: number): Color[] {
        return this.isDistinct
            ? this.getDistinctColors(numColors)
            : this.getGradientColors(numColors)
    }

    getUniqValueColorMap(uniqValues: any[], inverseOrder?: boolean) {
        const colors = this.getColors(uniqValues.length) || []
        if (inverseOrder) colors.reverse()

        // We want to display same values using the same color, e.g. two values of 100 get the same shade of green
        // Therefore, we create a map from all possible (unique) values to the corresponding color
        const colorByValue = new Map<number, Color>()
        uniqValues.forEach((value, index) =>
            colorByValue.set(value, colors[index])
        )
        return colorByValue
    }

    assignColors(
        seriesArr: ChartSeries[],
        invertColorScheme = false,
        customColorMap: Map<SeriesName, Color> = new Map(),
        seriesColorMap: SeriesColorMap = new Map()
    ) {
        seriesArr.forEach((series) => {
            const customColor = customColorMap.get(series.seriesName)
            if (customColor) seriesColorMap.set(series.seriesName, customColor)
        })
        this.updateColorMap(seriesArr, seriesColorMap, invertColorScheme)
        seriesArr.forEach((series) => {
            series.color = seriesColorMap.get(series.seriesName)!
        })
    }

    private updateColorMap(
        seriesArr: ChartSeries[],
        seriesColorMap: SeriesColorMap,
        invertColorScheme = false
    ) {
        // For names that don't have a color, assign one.
        seriesArr
            .map((series) => series.seriesName)
            .filter((name) => !seriesColorMap.has(name))
            .forEach((name) => {
                const availableColors = lastOfNonEmptyArray(this.colorSets)
                if (invertColorScheme) availableColors.reverse()
                const usedColors = Array.from(seriesColorMap.values()).filter(
                    isPresent
                )
                seriesColorMap.set(
                    name,
                    getLeastUsedColor(availableColors, usedColors)
                )
            })
    }

    static fromObject(
        name: string,
        colorSets: { [key: string]: Color[] },
        singleColorScale?: boolean
    ) {
        const colorSetsArray: Color[][] = []
        Object.keys(colorSets).forEach(
            (numColors) => (colorSetsArray[+numColors] = colorSets[numColors])
        )
        return new ColorScheme(name, colorSetsArray, singleColorScale)
    }
}
