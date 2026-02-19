import * as R from "remeda"
import {
    checkIsAggregate,
    EntityName,
    Aggregate,
    IncomeGroup,
    getAggregatesByProvider,
    getIncomeGroups,
    Region,
    RegionDataProvider,
    RequiredBy,
    regionDataProviderNames,
} from "@ourworldindata/utils"
import {
    CategoricalColorsPaletteC,
    ContinentColors,
} from "../color/CustomSchemes.js"
import { parseLabel } from "../core/RegionGroups.js"
import { getCountriesByRegion } from "../mapCharts/MapHelpers.js"

export type TooltipKey = RegionDataProvider | "incomeGroups"

export interface TooltipRegion {
    name: EntityName
    displayName: string
    color: string
    members: string[]
}

const continentColorsMap = ContinentColors as Record<EntityName, string>
const categoricalMapColors = CategoricalColorsPaletteC

const customDescriptions: Partial<Record<TooltipKey, string>> = {
    wb: "The **World Bank (WB)** defines [seven world regions](https://ourworldindata.org/world-region-map-definitions#world-bank-wb-continents):",
    un: "The **United Nations Statistical Division (UNSD)** establishes and maintains a geoscheme based on the [M49 coding classification](https://unstats.un.org/unsd/methodology/m49). At the highest level, the M49 classification categorizes countries into [six principal regions](https://ourworldindata.org/world-region-map-definitions#united-nations-un):",
    who: "The **World Health Organization (WHO)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#world-health-organization-who):",
    unsdg: "When reporting data on the Sustainable Development Goals, the **United Nations (UN)** defines [eight world regions](https://ourworldindata.org/world-region-map-definitions#united-nations-sustainable-development-goals-un-sdg):",
    pew: "The **Pew Research Center (Pew)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#pew-research-center-pew):",
    // Must be included here because we don't auto-generate a description for income groups
    incomeGroups:
        "The **World Bank** defines [four income groups](https://ourworldindata.org/world-bank-income-groups-explained):",
}

// Geographic display order: left-to-right on the map.
// Providers without a custom order will be sorted alphabetically.
const customRegionDisplayOrder: Partial<Record<TooltipKey, string[]>> = {
    wb: [
        "North America (WB)",
        "Latin America and Caribbean (WB)",
        "Sub-Saharan Africa (WB)",
        "Middle East, North Africa, Afghanistan and Pakistan (WB)",
        "Europe and Central Asia (WB)",
        "South Asia (WB)",
        "East Asia and Pacific (WB)",
    ],
    un: [
        "Northern America (UN)",
        "Latin America and the Caribbean (UN)",
        "Africa (UN)",
        "Europe (UN)",
        "Asia (UN)",
        "Oceania (UN)",
    ],
    who: [
        "Americas (WHO)",
        "Africa (WHO)",
        "Eastern Mediterranean (WHO)",
        "Europe (WHO)",
        "South-East Asia (WHO)",
        "Western Pacific (WHO)",
    ],
    unsdg: [
        "Europe and Northern America (UN SDG)",
        "Latin America and the Caribbean (UN SDG)",
        "Sub-Saharan Africa (UN SDG)",
        "Northern Africa and Western Asia (UN SDG)",
        "Central and Southern Asia (UN SDG)",
        "Eastern and South-Eastern Asia (UN SDG)",
        "Australia and New Zealand (UN SDG)",
        "Oceania (UN SDG)",
    ],
    pew: [
        "North America (Pew)",
        "Latin America-Caribbean (Pew)",
        "Sub-Saharan Africa (Pew)",
        "Middle East-North Africa (Pew)",
        "Europe (Pew)",
        "Asia-Pacific (Pew)",
    ],
    incomeGroups: [
        "Low-income countries",
        "Lower-middle-income countries",
        "Upper-middle-income countries",
        "High-income countries",
    ],
}

export function hasTooltipData(
    region: Region
): region is RequiredBy<Aggregate, "definedBy"> {
    return checkIsAggregate(region) && region.definedBy !== undefined
}

export function getDescriptionForKey(key: TooltipKey): string {
    if (customDescriptions[key]) return customDescriptions[key]

    // It's safe to assume the key is a RegionDataProvider
    // since income groups have a custom description
    const provider = key as RegionDataProvider

    const providerName = regionDataProviderNames[provider]
    const regions = getAggregatesByProvider(provider)
    const regionCount = regions.length

    // Extract the suffix from the first region's name to include in the description
    const firstRegion = regions[0]
    const suffix = firstRegion ? parseLabel(firstRegion.name).suffix : undefined
    const labelWithSuffix = suffix
        ? `${providerName} (${suffix})`
        : providerName

    return `The **${labelWithSuffix}** defines ${regionCount} world regions:`
}

export function getRegionsForKey(key: TooltipKey): TooltipRegion[] {
    const regions =
        key === "incomeGroups"
            ? getIncomeGroups()
            : getAggregatesByProvider(key)

    const customOrder = customRegionDisplayOrder[key]
    const sortFn = (region: Aggregate | IncomeGroup): number | string => {
        if (customOrder) {
            const index = customOrder.indexOf(region.name)
            return index >= 0 ? index : Infinity
        }
        return parseLabel(region.name).name
    }

    return R.pipe(
        regions,
        R.sortBy(sortFn),
        R.map((region, index) => ({
            name: region.name,
            displayName: parseLabel(region.name).name, // Strip suffix
            color:
                continentColorsMap[region.name] ??
                categoricalMapColors[index % categoricalMapColors.length],
            members: [...(getCountriesByRegion(region.name) ?? [])],
        }))
    )
}

/** Build a map from country name to its color and region */
export function buildCountryMap(
    regions: TooltipRegion[]
): Map<EntityName, { region: EntityName; color: string }> {
    const map = new Map<string, { color: string; region: string }>()
    for (const region of regions) {
        for (const country of region.members) {
            map.set(country, { color: region.color, region: region.name })
        }
    }
    return map
}
