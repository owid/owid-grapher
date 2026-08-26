import {
    Color,
    ColorSchemeName,
    GrapherChartOrMapType,
    GRAPHER_CHART_TYPES,
    GRAPHER_MAP_TYPE,
    lastOfNonEmptyArray,
    lazy,
} from "@ourworldindata/utils"
import {
    ColorSchemes,
    ContinentColors,
    DarkerHexByBaseHex,
    EnergyColors,
    MapContinentColors,
    OwidDistinctColors,
    OwidDistinctLinesColors,
    OwidMapColors,
} from "@ourworldindata/grapher"

export type ColorPaletteKey = "chart" | "chartLines" | "map"

/** Whether an OWID colour is designed for chart marks or for map fills. */
export type ColorSurface = "chart" | "map"

export interface PaletteEntry {
    /** Humanized, e.g. "North America" */
    label: string
    /** Raw vocabulary name, kept so a search for "NorthAmerica" still matches */
    name: string
    hex: Color
}

/** One tab's worth of named colours */
export interface PaletteGroup {
    /** Card order, deduplicated by label */
    entries: PaletteEntry[]
    /** Uppercased hex -> every label that maps to it */
    labelsByHex: Record<string, string[]>
}

export interface AdminColorPalette {
    key: ColorPaletteKey
    surface: ColorSurface
    /** Shown in the picker's banner, e.g. "Map colours" */
    label: string
    /** Grid order */
    swatches: Color[]
    /** Uppercased hex -> humanized colour name */
    nameByHex: Record<string, string>
    /** The 🌍 Regions tab */
    regions: PaletteGroup
    /** The ⚡ Energy tab; empty means the tab is hidden */
    energy: PaletteGroup
}

const palettesByKey: Record<ColorPaletteKey, AdminColorPalette> = {
    map: {
        key: "map",
        surface: "map",
        label: "Map colours",
        swatches: Object.values(OwidMapColors),
        nameByHex: humanizedNameByHex(OwidMapColors),
        regions: toPaletteGroup(MapContinentColors),
        energy: toPaletteGroup({}),
    },
    chart: {
        key: "chart",
        surface: "chart",
        label: "Chart colours",
        swatches: lastOfNonEmptyArray(
            ColorSchemes.get(ColorSchemeName["owid-distinct"]).colorSets
        ),
        nameByHex: humanizedNameByHex(OwidDistinctColors),
        regions: toPaletteGroup(ContinentColors),
        energy: toPaletteGroup(EnergyColors),
    },
    chartLines: {
        key: "chartLines",
        surface: "chart",
        label: "Chart colours (line charts)",
        swatches: lastOfNonEmptyArray(
            ColorSchemes.get(ColorSchemeName.OwidDistinctLines).colorSets
        ),
        nameByHex: humanizedNameByHex(OwidDistinctLinesColors),
        regions: toPaletteGroup(withDarkerHexes(ContinentColors)),
        energy: toPaletteGroup(withDarkerHexes(EnergyColors)),
    },
}

/** Turn camelCase identifiers ("SubSaharanAfrica") into readable labels */
export function humanizeName(name: string): string {
    if (name.includes(" ")) return name
    return name.replace(/([a-z])([A-Z])/g, "$1 $2")
}

/** Build a case-insensitive hex -> humanized name lookup */
function humanizedNameByHex(
    map: Record<string, Color>
): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [name, hex] of Object.entries(map))
        result[hex.toUpperCase()] = humanizeName(name)
    return result
}

/**
 * Index a name -> hex vocabulary for one tab: cards deduplicated by label
 * (e.g. "NorthAmerica" and "North America" collapse into one), plus the reverse
 * lookup the tooltips need, since many names share a hex.
 */
function toPaletteGroup(map: Record<string, Color>): PaletteGroup {
    const entries: PaletteEntry[] = []
    const labelsByHex: Record<string, string[]> = {}
    const seen = new Set<string>()
    for (const [name, hex] of Object.entries(map)) {
        const label = humanizeName(name)
        const labels = (labelsByHex[hex.toUpperCase()] ??= [])
        if (!labels.includes(label)) labels.push(label)
        if (seen.has(label)) continue
        seen.add(label)
        entries.push({ label, name, hex })
    }
    return { entries, labelsByHex }
}

/** Swap in the darker line-chart variant of a colour where one exists. */
function withDarkerHexes(map: Record<string, Color>): Record<string, Color> {
    return Object.fromEntries(
        Object.entries(map).map(([name, hex]) => [
            name,
            DarkerHexByBaseHex[hex] ?? hex,
        ])
    )
}

export function getAdminColorPalette(key: ColorPaletteKey): AdminColorPalette {
    return palettesByKey[key]
}

export function getColorPaletteKey(
    chartType: GrapherChartOrMapType
): ColorPaletteKey {
    if (chartType === GRAPHER_MAP_TYPE) return "map"
    if (chartType === GRAPHER_CHART_TYPES.LineChart) return "chartLines"
    return "chart"
}

export function getColorSurface(hex: Color): ColorSurface | undefined {
    return surfaceByHex()[hex.toUpperCase()]
}

const surfaceByHex = lazy((): Record<string, ColorSurface> => {
    const index: Record<string, ColorSurface> = {}
    for (const hex of [
        ...Object.values(OwidDistinctColors),
        ...Object.values(OwidDistinctLinesColors),
    ])
        index[hex.toUpperCase()] = "chart"
    for (const hex of Object.values(OwidMapColors))
        index[hex.toUpperCase()] = "map"
    return index
})
