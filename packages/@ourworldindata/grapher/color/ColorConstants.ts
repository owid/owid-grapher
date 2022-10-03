import { Color } from "../../coreTable/CoreTableConstants.js"

export interface ColorSchemeInterface {
    name: string
    colorSets: Color[][] // Different color sets depending on how many distinct colors you want
    singleColorScale?: boolean
    isDistinct?: boolean
    displayName?: string
}

// Note: TypeScript does not currently support extending or merging enums. Ideally we would have 2 enums here (one for custom and one for brewer) and then just merge them.
// https://github.com/microsoft/TypeScript/issues/17592
export enum ColorSchemeName {
    // Brewer schemes:
    YlGn = "YlGn",
    YlGnBu = "YlGnBu",
    GnBu = "GnBu",
    BuGn = "BuGn",
    PuBuGn = "PuBuGn",
    BuPu = "BuPu",
    RdPu = "RdPu",
    PuRd = "PuRd",
    OrRd = "OrRd",
    YlOrRd = "YlOrRd",
    YlOrBr = "YlOrBr",
    Purples = "Purples",
    Blues = "Blues",
    Greens = "Greens",
    Oranges = "Oranges",
    Reds = "Reds",
    Greys = "Greys",
    PuOr = "PuOr",
    BrBG = "BrBG",
    PRGn = "PRGn",
    PiYG = "PiYG",
    RdBu = "RdBu",
    RdGy = "RdGy",
    RdYlBu = "RdYlBu",
    Spectral = "Spectral",
    RdYlGn = "RdYlGn",
    Accent = "Accent",
    Dark2 = "Dark2",
    Paired = "Paired",
    Pastel1 = "Pastel1",
    Pastel2 = "Pastel2",
    Set1 = "Set1",
    Set2 = "Set2",
    Set3 = "Set3",
    PuBu = "PuBu",
    "hsv-RdBu" = "hsv-RdBu",
    "hsv-CyMg" = "hsv-CyMg",

    // Custom schemes:
    Magma = "Magma",
    Inferno = "Inferno",
    Plasma = "Plasma",
    Viridis = "Viridis",
    continents = "continents",
    stackedAreaDefault = "stackedAreaDefault",
    "owid-distinct" = "owid-distinct",
    SingleColorDenim = "SingleColorDenim",
    SingleColorTeal = "SingleColorTeal",
    SingleColorPurple = "SingleColorPurple",
    SingleColorDustyCoral = "SingleColorDustyCoral",
    SingleColorDarkCopper = "SingleColorDarkCopper",
    OwidCategoricalA = "OwidCategoricalA",
    OwidCategoricalB = "OwidCategoricalB",
    OwidCategoricalC = "OwidCategoricalC",
    OwidCategoricalD = "OwidCategoricalD",
    OwidCategoricalE = "OwidCategoricalE",
    OwidEnergy = "OwidEnergy",
    OwidDistinctLines = "OwidDistinctLines",
    BinaryMapPaletteA = "BinaryMapPaletteA",
    BinaryMapPaletteB = "BinaryMapPaletteB",
    BinaryMapPaletteC = "BinaryMapPaletteC",
    BinaryMapPaletteD = "BinaryMapPaletteD",
    BinaryMapPaletteE = "BinaryMapPaletteE",
}

export const OwidNoDataGray = "#6e7581"
export const OwidErrorColor = "ff0002"
