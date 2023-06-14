#! /usr/bin/env jest

import { ColorSchemeName } from "./ColorConstants"
import { ColorScheme } from "./ColorScheme"
import { ColorSchemes } from "./ColorSchemes"

describe("continous color scheme", () => {
    const Blues = ColorSchemes[ColorSchemeName.Blues]
    const colorSet6 = Blues.colorSets[6]

    const colorSets = []
    colorSets[6] = colorSet6

    const colorScheme = new ColorScheme(
        Blues.name + "-6",
        colorSets,
        Blues.singleColorScale,
        Blues.isDistinct,
        Blues.isDiverging
    )

    it("can generate more colors", () => {
        expect(colorScheme.getColors(8)).toEqual([
            colorSet6[0],
            colorSet6[1],
            colorSet6[2],
            colorSet6[3],
            "rgb(78, 152, 202)",
            colorSet6[4],
            "rgb(29, 106, 173)",
            colorSet6[5],
        ])
    })

    it("can generate less colors", () => {
        expect(colorScheme.getColors(4)).toEqual([
            "rgb(239, 243, 255)", // light blue
            "rgb(198, 219, 239)",
            "rgb(158, 202, 225)",
            "rgb(107, 174, 214)", // darker blue
        ])
    })
})

describe("diverging color scheme", () => {
    const RbBu = ColorSchemes[ColorSchemeName.RdBu]
    const colorSet6 = RbBu.colorSets[6]

    const colorSets = []
    colorSets[6] = colorSet6

    const colorScheme = new ColorScheme(
        RbBu.name + "-6",
        colorSets,
        RbBu.singleColorScale,
        RbBu.isDistinct,
        RbBu.isDiverging
    )

    it("can generate more colors while maintaining a balance between the two colors of diverging schemes", () => {
        expect(colorScheme.getGradientColors(8, { balanced: true })).toEqual([
            colorSet6[0],
            "rgb(209, 81, 71)",
            colorSet6[1],
            colorSet6[2],
            colorSet6[3],
            colorSet6[4],
            "rgb(68, 136, 190)",
            colorSet6[5],
        ])
    })
})
