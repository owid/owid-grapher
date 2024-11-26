import { CustomColorSchemes } from "./CustomSchemes"
import { ColorScheme } from "./ColorScheme"
import { match } from "ts-pattern"
import { partition } from "@ourworldindata/utils"
import {
    GRAPHER_CHART_TYPES,
    ColorSchemeInterface,
    ColorSchemeName,
    GRAPHER_MAP_TYPE,
    GrapherChartOrMapType,
} from "@ourworldindata/types"
import { getColorBrewerScheme } from "./ColorBrewerSchemes.js"

function getPreferredSchemesByType(
    type: GrapherChartOrMapType
): ColorSchemeName[] {
    // This function could also be a Map<GrapherChartOrMapType, ColorName[]> but
    // by doing it as a function usign ts-pattern.match we get compile
    // time safety that all enum cases in GrapherChartOrMapType are always handled here
    return match(type)
        .with(GRAPHER_CHART_TYPES.DiscreteBar, () => [
            ColorSchemeName.SingleColorDenim,
            ColorSchemeName.SingleColorDustyCoral,
            ColorSchemeName.SingleColorPurple,
            ColorSchemeName.SingleColorTeal,
            ColorSchemeName.SingleColorDarkCopper,
        ])
        .with(GRAPHER_CHART_TYPES.LineChart, () => [
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(GRAPHER_CHART_TYPES.Marimekko, () => [
            ColorSchemeName.continents,
            ColorSchemeName.SingleColorDenim,
            ColorSchemeName.SingleColorDustyCoral,
            ColorSchemeName.SingleColorPurple,
            ColorSchemeName.SingleColorTeal,
            ColorSchemeName.SingleColorDarkCopper,
            ColorSchemeName.OwidCategoricalA,
            ColorSchemeName.OwidCategoricalB,
            ColorSchemeName.OwidCategoricalC,
            ColorSchemeName.OwidCategoricalD,
            ColorSchemeName.OwidCategoricalE,
        ])
        .with(GRAPHER_CHART_TYPES.ScatterPlot, () => [
            ColorSchemeName.continents,
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(GRAPHER_CHART_TYPES.SlopeChart, () => [
            ColorSchemeName.continents,
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(GRAPHER_CHART_TYPES.StackedArea, () => [
            ColorSchemeName["owid-distinct"],
            ColorSchemeName.OwidCategoricalA,
            ColorSchemeName.OwidCategoricalB,
            ColorSchemeName.OwidCategoricalC,
            ColorSchemeName.OwidCategoricalD,
            ColorSchemeName.OwidCategoricalE,
            ColorSchemeName.SingleColorGradientDenim,
            ColorSchemeName.SingleColorGradientTeal,
            ColorSchemeName.SingleColorGradientPurple,
            ColorSchemeName.SingleColorGradientDustyCoral,
            ColorSchemeName.SingleColorGradientDarkCopper,
        ])
        .with(GRAPHER_CHART_TYPES.StackedBar, () => [
            ColorSchemeName["owid-distinct"],
            ColorSchemeName.OwidCategoricalA,
            ColorSchemeName.OwidCategoricalB,
            ColorSchemeName.OwidCategoricalC,
            ColorSchemeName.OwidCategoricalD,
            ColorSchemeName.OwidCategoricalE,
            ColorSchemeName.SingleColorGradientDenim,
            ColorSchemeName.SingleColorGradientTeal,
            ColorSchemeName.SingleColorGradientPurple,
            ColorSchemeName.SingleColorGradientDustyCoral,
            ColorSchemeName.SingleColorGradientDarkCopper,
        ])
        .with(GRAPHER_CHART_TYPES.StackedDiscreteBar, () => [
            ColorSchemeName["owid-distinct"],
            ColorSchemeName.OwidCategoricalA,
            ColorSchemeName.OwidCategoricalB,
            ColorSchemeName.OwidCategoricalC,
            ColorSchemeName.OwidCategoricalD,
            ColorSchemeName.OwidCategoricalE,
            ColorSchemeName.SingleColorGradientDenim,
            ColorSchemeName.SingleColorGradientTeal,
            ColorSchemeName.SingleColorGradientPurple,
            ColorSchemeName.SingleColorGradientDustyCoral,
            ColorSchemeName.SingleColorGradientDarkCopper,
        ])
        .with(GRAPHER_MAP_TYPE, () => [
            ColorSchemeName.BinaryMapPaletteA,
            ColorSchemeName.BinaryMapPaletteB,
            ColorSchemeName.BinaryMapPaletteC,
            ColorSchemeName.BinaryMapPaletteD,
            ColorSchemeName.BinaryMapPaletteE,
        ])
        .exhaustive()
}

const initColorScheme = (scheme: ColorSchemeInterface): ColorScheme =>
    new ColorScheme(
        scheme.displayName ?? scheme.name,
        scheme.colorSets,
        scheme.singleColorScale,
        scheme.isDistinct
    )

const _colorSchemes = new Map<ColorSchemeName, ColorScheme>()

// This object has a map-like appearance from the outside (with a .get() method),
// but lazy-loads color schemes as they are requested
export const ColorSchemes = {
    get: (name: ColorSchemeName): ColorScheme => {
        if (!_colorSchemes.has(name)) {
            const schemeRaw =
                getColorBrewerScheme(name) ??
                CustomColorSchemes.find((s) => s.name === name)
            if (!schemeRaw) throw new Error(`Color scheme ${name} not found`)
            const scheme = initColorScheme(schemeRaw)
            _colorSchemes.set(name, scheme)
        }
        return _colorSchemes.get(name)!
    },
}

const getAllColorSchemes = (): Map<ColorSchemeName, ColorScheme> => {
    return new Map(
        Object.keys(ColorSchemeName).map((key) => [
            key as ColorSchemeName,
            ColorSchemes.get(key as ColorSchemeName),
        ])
    )
}

export function getColorSchemeForChartType(type: GrapherChartOrMapType): {
    [key in ColorSchemeName]: ColorScheme
} {
    const preferred = new Set(getPreferredSchemesByType(type))
    const allSchemes = getAllColorSchemes()
    const [preferredSchemes, otherSchemes] = partition(
        [...allSchemes.entries()],
        (schemeKeyValue) => preferred.has(schemeKeyValue[0])
    )
    return Object.fromEntries([...preferredSchemes, ...otherSchemes]) as {
        [key in ColorSchemeName]: ColorScheme
    }
}
