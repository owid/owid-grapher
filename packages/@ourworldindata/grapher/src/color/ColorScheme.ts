import * as _ from "lodash-es"
import { rgb } from "d3-color"
import { interpolate } from "d3-interpolate"
import { lastOfNonEmptyArray, Color } from "@ourworldindata/utils"
import { ColorSchemeInterface } from "@ourworldindata/types"
import { interpolateArray } from "./ColorUtils"

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
        const newColors = _.clone(shortColors)

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

        if (colorSets[numColors]) return _.clone(colorSets[numColors])

        const prevColors = colorSets
            .toReversed()
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
        if (colorSets[numColors]) return _.clone(colorSets[numColors])

        if (numColors > colorSets.length - 1) {
            // If more colors are wanted than we have defined, have to improvise
            const colorSet = lastOfNonEmptyArray(colorSets)
            // Special case for colorSchemes with a single color where the usual interpolation would not work
            if (colorSet.length === 1) return Array(numColors).fill(colorSet[0])
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

    getUniqValueColorMap(
        uniqValues: any[],
        inverseOrder?: boolean
    ): Map<number, string> {
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

    static fromObject(
        name: string,
        colorSets: { [key: string]: Color[] },
        singleColorScale?: boolean
    ): ColorScheme {
        const colorSetsArray: Color[][] = []
        Object.keys(colorSets).forEach(
            (numColors): string[] =>
                (colorSetsArray[+numColors] = colorSets[numColors])
        )
        return new ColorScheme(name, colorSetsArray, singleColorScale)
    }
}
