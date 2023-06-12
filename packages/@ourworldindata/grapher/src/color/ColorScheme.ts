import { Color } from "@ourworldindata/core-table"
import { lastOfNonEmptyArray, clone, first, last } from "@ourworldindata/utils"
import { ColorSchemeInterface } from "./ColorConstants"
import { interpolateArray, insertInterpolatedColor } from "./ColorUtils"

export class ColorScheme implements ColorSchemeInterface {
    name: string
    colorSets: Color[][]
    singleColorScale: boolean
    isDistinct: boolean
    isDiverging: boolean

    constructor(
        name: string,
        colorSets: Color[][],
        singleColorScale?: boolean,
        isDistinct?: boolean,
        isDiverging?: boolean
    ) {
        this.name = name
        this.colorSets = []
        this.singleColorScale = !!singleColorScale
        this.isDistinct = !!isDistinct
        this.isDiverging = !!isDiverging
        colorSets.forEach((set) => (this.colorSets[set.length] = set))
    }

    improviseGradientFromShorter(
        shortColors: Color[],
        numColors: number
    ): Color[] {
        const newColors = clone(shortColors)

        while (newColors.length < numColors) {
            for (let index = newColors.length - 1; index > 0; index -= 1) {
                insertInterpolatedColor(newColors, index)
                if (newColors.length >= numColors) break
            }
        }

        return newColors
    }

    improviseSymmetricalGradientFromShorter(
        shortColors: Color[],
        numColors: number
    ): Color[] {
        const newColors = clone(shortColors)

        while (newColors.length < numColors) {
            for (let index = 0; index < newColors.length; index += 2) {
                // insert new color at the end
                insertInterpolatedColor(newColors, newColors.length - 1 - index)
                if (newColors.length >= numColors) break

                // insert new color at the start
                insertInterpolatedColor(newColors, index + 1)
                if (newColors.length >= numColors) break
            }
        }

        return newColors
    }

    improviseGradientFromLonger(
        knownColors: Color[],
        numColors: number
    ): Color[] {
        // for the special case that exactly two colors are requested, we simply return the first and the last
        if (numColors === 2) return [first(knownColors)!, last(knownColors)!]

        const newColors = []
        const scale = interpolateArray(knownColors)
        for (let index = 0; index < numColors; index++) {
            newColors.push(scale(index / numColors))
        }
        return newColors
    }

    getGradientColors(
        numColors: number,
        { excludeMiddleColorForDivergingSchemes = false } = {}
    ): Color[] {
        const { colorSets, isDiverging } = this

        if (colorSets[numColors]) return clone(colorSets[numColors])

        let colorSetsCopy = clone(colorSets)
        // for diverging color schemes, the color sets with an odd number of colors
        // include a middle color (e.g. white in the case of the Red-Blue scheme) while
        // the color sets with an even number of colors do not. to ensure that the middle
        // color is not included, we improvise from a set with an even number of colors
        if (isDiverging && excludeMiddleColorForDivergingSchemes) {
            colorSetsCopy = colorSetsCopy.filter(
                (set) => set && set.length % 2 === 0
            )
        }

        const prevColors = colorSetsCopy
            .reverse()
            .find((set) => set && set.length < numColors)
        if (prevColors) {
            const improviseGradientFromShorter =
                isDiverging && excludeMiddleColorForDivergingSchemes
                    ? this.improviseSymmetricalGradientFromShorter
                    : this.improviseGradientFromShorter
            return improviseGradientFromShorter(prevColors, numColors)
        } else
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

    getColors(
        numColors: number,
        options: { excludeMiddleColorForDivergingSchemes?: boolean } = {
            excludeMiddleColorForDivergingSchemes: false,
        }
    ): Color[] {
        return this.isDistinct
            ? this.getDistinctColors(numColors)
            : this.getGradientColors(numColors, options)
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
