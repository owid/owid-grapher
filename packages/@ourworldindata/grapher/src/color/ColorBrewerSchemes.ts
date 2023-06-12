import colorbrewer from "colorbrewer"
import { Color } from "@ourworldindata/core-table"
import { ColorSchemeInterface, ColorSchemeName } from "./ColorConstants"

type ColorSchemeProps = {
    displayName: string
    singleColorScale: boolean
    isDiverging: boolean
}

const ColorBrewerSchemeIndex: {
    [key in ColorSchemeName]?: ColorSchemeProps
} = {
    YlGn: {
        displayName: "Yellow-Green shades",
        singleColorScale: true,
        isDiverging: false,
    },
    YlGnBu: {
        displayName: "Yellow-Green-Blue shades",
        singleColorScale: false,
        isDiverging: false,
    },
    GnBu: {
        displayName: "Green-Blue shades",
        singleColorScale: true,
        isDiverging: false,
    },
    BuGn: {
        displayName: "Blue-Green shades",
        singleColorScale: true,
        isDiverging: false,
    },
    PuBuGn: {
        displayName: "Purple-Blue-Green shades",
        singleColorScale: false,
        isDiverging: false,
    },
    BuPu: {
        displayName: "Blue-Purple shades",
        singleColorScale: true,
        isDiverging: false,
    },
    RdPu: {
        displayName: "Red-Purple shades",
        singleColorScale: true,
        isDiverging: false,
    },
    PuRd: {
        displayName: "Purple-Red shades",
        singleColorScale: true,
        isDiverging: false,
    },
    OrRd: {
        displayName: "Orange-Red shades",
        singleColorScale: true,
        isDiverging: false,
    },
    YlOrRd: {
        displayName: "Yellow-Orange-Red shades",
        singleColorScale: true,
        isDiverging: false,
    },
    YlOrBr: {
        displayName: "Yellow-Orange-Brown shades",
        singleColorScale: true,
        isDiverging: false,
    },
    Purples: {
        displayName: "Purple shades",
        singleColorScale: true,
        isDiverging: false,
    },
    Blues: {
        displayName: "Blue shades",
        singleColorScale: true,
        isDiverging: false,
    },
    Greens: {
        displayName: "Green shades",
        singleColorScale: true,
        isDiverging: false,
    },
    Oranges: {
        displayName: "Orange shades",
        singleColorScale: true,
        isDiverging: false,
    },
    Reds: {
        displayName: "Red shades",
        singleColorScale: true,
        isDiverging: false,
    },
    Greys: {
        displayName: "Grey shades",
        singleColorScale: true,
        isDiverging: false,
    },
    PuOr: {
        displayName: "Purple-Orange",
        singleColorScale: false,
        isDiverging: false,
    },
    BrBG: {
        displayName: "Brown-Blue-Green",
        singleColorScale: false,
        isDiverging: true,
    },
    PRGn: {
        displayName: "Purple-Red-Green",
        singleColorScale: false,
        isDiverging: true,
    },
    PiYG: {
        displayName: "Magenta-Yellow-Green",
        singleColorScale: false,
        isDiverging: true,
    },
    RdBu: {
        displayName: "Red-Blue",
        singleColorScale: false,
        isDiverging: true,
    },
    RdGy: {
        displayName: "Red-Grey",
        singleColorScale: false,
        isDiverging: true,
    },
    RdYlBu: {
        displayName: "Red-Yellow-Blue",
        singleColorScale: false,
        isDiverging: true,
    },
    Spectral: {
        displayName: "Spectral colors",
        singleColorScale: false,
        isDiverging: true,
    },
    RdYlGn: {
        displayName: "Red-Yellow-Green",
        singleColorScale: false,
        isDiverging: true,
    },
    Accent: {
        displayName: "Accents",
        singleColorScale: false,
        isDiverging: false,
    },
    Dark2: {
        displayName: "Dark colors",
        singleColorScale: false,
        isDiverging: false,
    },
    Paired: {
        displayName: "Paired colors",
        singleColorScale: false,
        isDiverging: false,
    },
    Pastel1: {
        displayName: "Pastel 1 colors",
        singleColorScale: false,
        isDiverging: false,
    },
    Pastel2: {
        displayName: "Pastel 2 colors",
        singleColorScale: false,
        isDiverging: false,
    },
    Set1: {
        displayName: "Set 1 colors",
        singleColorScale: false,
        isDiverging: false,
    },
    Set2: {
        displayName: "Set 2 colors",
        singleColorScale: false,
        isDiverging: false,
    },
    Set3: {
        displayName: "Set 3 colors",
        singleColorScale: false,
        isDiverging: false,
    },
    PuBu: {
        displayName: "Purple-Blue shades",
        singleColorScale: true,
        isDiverging: false,
    },
    "hsv-RdBu": {
        displayName: "HSV Red-Blue",
        singleColorScale: false,
        isDiverging: false,
    },
    "hsv-CyMg": {
        displayName: "HSV Cyan-Magenta",
        singleColorScale: false,
        isDiverging: false,
    },
} as const

const brewerKeys = Object.keys(colorbrewer) as ColorSchemeName[]

export const ColorBrewerSchemes: ColorSchemeInterface[] = brewerKeys
    .filter((brewerName) => ColorBrewerSchemeIndex[brewerName])
    .map((brewerName) => {
        const props = ColorBrewerSchemeIndex[brewerName]!
        const colorSets = (colorbrewer as any)[brewerName] as any
        const colorSetsArray: Color[][] = []
        Object.keys(colorSets).forEach(
            (numColors) => (colorSetsArray[+numColors] = colorSets[numColors])
        )
        return {
            name: brewerName,
            displayName: props.displayName,
            colorSets: colorSetsArray,
            singleColorScale: props.singleColorScale,
            isDiverging: props.isDiverging,
        }
    })
