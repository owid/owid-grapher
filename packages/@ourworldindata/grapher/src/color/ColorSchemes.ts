import { ColorSchemeName } from "./ColorConstants"
import { CustomColorSchemes } from "./CustomSchemes"
import { ColorBrewerSchemes } from "./ColorBrewerSchemes"
import { ColorScheme } from "./ColorScheme"
import { ChartTypeName } from "../core/GrapherConstants"
import { match } from "ts-pattern"
import { partition, fromPairs } from "@ourworldindata/utils"

function getPreferredSchemesByType(type: ChartTypeName): ColorSchemeName[] {
    // This function could also be a Map<ChartTypeName, ColorName[]> but
    // by doing it as a function usign ts-pattern.match we get compile
    // time safety that all enum cases in ChartTypeName are always handled here
    return match(type) 
        .with(ChartTypeName.DiscreteBar, () => [
            ColorSchemeName.SingleColorDenim,
            ColorSchemeName.SingleColorDustyCoral,
            ColorSchemeName.SingleColorPurple,
            ColorSchemeName.SingleColorTeal,
            ColorSchemeName.SingleColorDarkCopper,
        ])
        .with(ChartTypeName.LineChart, () => [
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(ChartTypeName.Marimekko, () => [
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
        .with(ChartTypeName.ScatterPlot, () => [
            ColorSchemeName.continents,
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(ChartTypeName.SlopeChart, () => [
            ColorSchemeName.continents,
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(ChartTypeName.StackedArea, () => [
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
        .with(ChartTypeName.StackedBar, () => [
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
        .with(ChartTypeName.StackedDiscreteBar, () => [
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
        .with(ChartTypeName.TimeScatter, () => [
            ColorSchemeName.continents,
            ColorSchemeName.OwidDistinctLines,
        ])
        .with(ChartTypeName.WorldMap, () => [
            ColorSchemeName.BinaryMapPaletteA,
            ColorSchemeName.BinaryMapPaletteB,
            ColorSchemeName.BinaryMapPaletteC,
            ColorSchemeName.BinaryMapPaletteD,
            ColorSchemeName.BinaryMapPaletteE,
        ])
        .exhaustive()
}

const initAllSchemes = (): { [key in ColorSchemeName]: ColorScheme } => {
    const schemes = [...ColorBrewerSchemes, ...CustomColorSchemes]

    // NB: Temporarily switch to any typing to build the ColorScheme map. Ideally it would just be an enum, but in TS in enums you can only have primitive values.
    // There is another way to do it with static classes, but that's also not great. If you are adding a color scheme, just make sure to add it's name to the ColorSchemeName enum.
    const colorSchemes: any = {}
    schemes.forEach((scheme) => {
        colorSchemes[scheme.name] = new ColorScheme(
            scheme.displayName ?? scheme.name,
            scheme.colorSets,
            scheme.singleColorScale,
            scheme.isDistinct
        )
    })
    return colorSchemes as { [key in ColorSchemeName]: ColorScheme }
}

export const ColorSchemes = initAllSchemes()

export function getColorSchemeForChartType(type: ChartTypeName): {
    [key in ColorSchemeName]: ColorScheme
} {
    const preferred = new Set(getPreferredSchemesByType(type))
    const [preferredSchemes, otherSchemes] = partition(
        Object.entries(ColorSchemes) as [ColorSchemeName, ColorScheme][],
        (schemeKeyValue) => preferred.has(schemeKeyValue[0])
    )
    return fromPairs([...preferredSchemes, ...otherSchemes]) as {
        [key in ColorSchemeName]: ColorScheme
    }
}
