import * as colorbrewer from "colorbrewer"
import { Color } from "coreTable/CoreTableConstants"
import { ColorSchemeInterface, ColorSchemeName } from "./ColorConstants"

type ColorSchemeProps = { displayName: string; singleColorScale: boolean }

const ColorBrewerSchemeIndex: {
    [key in ColorSchemeName]?: ColorSchemeProps
} = {
    YlGn: { displayName: "Yellow-Green shades", singleColorScale: true },
    YlGnBu: {
        displayName: "Yellow-Green-Blue shades",
        singleColorScale: false,
    },
    GnBu: { displayName: "Green-Blue shades", singleColorScale: true },
    BuGn: { displayName: "Blue-Green shades", singleColorScale: true },
    PuBuGn: {
        displayName: "Purple-Blue-Green shades",
        singleColorScale: false,
    },
    BuPu: { displayName: "Blue-Purple shades", singleColorScale: true },
    RdPu: { displayName: "Red-Purple shades", singleColorScale: true },
    PuRd: { displayName: "Purple-Red shades", singleColorScale: true },
    OrRd: { displayName: "Orange-Red shades", singleColorScale: true },
    YlOrRd: {
        displayName: "Yellow-Orange-Red shades",
        singleColorScale: true,
    },
    YlOrBr: {
        displayName: "Yellow-Orange-Brown shades",
        singleColorScale: true,
    },
    Purples: { displayName: "Purple shades", singleColorScale: true },
    Blues: { displayName: "Blue shades", singleColorScale: true },
    Greens: { displayName: "Green shades", singleColorScale: true },
    Oranges: { displayName: "Orange shades", singleColorScale: true },
    Reds: { displayName: "Red shades", singleColorScale: true },
    Greys: { displayName: "Grey shades", singleColorScale: true },
    PuOr: { displayName: "Purple-Orange", singleColorScale: false },
    BrBG: { displayName: "Brown-Blue-Green", singleColorScale: false },
    PRGn: { displayName: "Purple-Red-Green", singleColorScale: false },
    PiYG: { displayName: "Magenta-Yellow-Green", singleColorScale: false },
    RdBu: { displayName: "Red-Blue", singleColorScale: false },
    RdGy: { displayName: "Red-Grey", singleColorScale: false },
    RdYlBu: { displayName: "Red-Yellow-Blue", singleColorScale: false },
    Spectral: { displayName: "Spectral colors", singleColorScale: false },
    RdYlGn: { displayName: "Red-Yellow-Green", singleColorScale: false },
    Accent: { displayName: "Accents", singleColorScale: false },
    Dark2: { displayName: "Dark colors", singleColorScale: false },
    Paired: { displayName: "Paired colors", singleColorScale: false },
    Pastel1: { displayName: "Pastel 1 colors", singleColorScale: false },
    Pastel2: { displayName: "Pastel 2 colors", singleColorScale: false },
    Set1: { displayName: "Set 1 colors", singleColorScale: false },
    Set2: { displayName: "Set 2 colors", singleColorScale: false },
    Set3: { displayName: "Set 3 colors", singleColorScale: false },
    PuBu: { displayName: "Purple-Blue shades", singleColorScale: true },
    "hsv-RdBu": { displayName: "HSV Red-Blue", singleColorScale: false },
    "hsv-CyMg": { displayName: "HSV Cyan-Magenta", singleColorScale: false },
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
        }
    })
