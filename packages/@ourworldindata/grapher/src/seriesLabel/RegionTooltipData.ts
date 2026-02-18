import * as R from "remeda"
import {
    checkIsAggregate,
    EntityName,
    getAggregatesByProvider,
    getIncomeGroups,
    Region,
    RegionDataProvider,
} from "@ourworldindata/utils"
import { ContinentColors } from "../color/CustomSchemes.js"
import { AnyRegionDataProvider, parseLabel } from "../core/RegionGroups.js"
import { getCountriesByRegion } from "../mapCharts/MapHelpers.js"

// We only support a subset of region data providers for the tooltip,
// based on whether we have the necessary data to show in the tooltip
const providersWithTooltipData = [
    "wb",
    "un",
    "who",
    "unsdg",
    "pew",
] as const satisfies RegionDataProvider[]

const providersWithTooltipDataAsSet = new Set<string>(providersWithTooltipData)

export type RegionProviderWithTooltipData =
    (typeof providersWithTooltipData)[number]

export type TooltipKey = RegionProviderWithTooltipData | "incomeGroups"

export interface TooltipRegion {
    name: EntityName
    displayName: string
    color: string
    members: string[]
}

const continentColorsMap = ContinentColors as Record<EntityName, string>

const descriptions: Record<TooltipKey, string> = {
    wb: "The **World Bank (WB)** defines [seven world regions](https://ourworldindata.org/world-region-map-definitions#world-bank-wb-continents):",
    un: "The **United Nations Statistical Division (UNSD)** establishes and maintains a geoscheme based on the [M49 coding classification](https://unstats.un.org/unsd/methodology/m49). At the highest level, the M49 classification categorizes countries into [six principal regions](https://ourworldindata.org/world-region-map-definitions#united-nations-un):",
    who: "The **World Health Organization (WHO)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#world-health-organization-who):",
    unsdg: "When reporting data on the Sustainable Development Goals, the **United Nations (UN)** defines [eight world regions](https://ourworldindata.org/world-region-map-definitions#united-nations-sustainable-development-goals-un-sdg):",
    pew: "The **Pew Research Center (Pew)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#pew-research-center-pew):",
    incomeGroups:
        "The **World Bank** defines [four income groups](https://ourworldindata.org/world-bank-income-groups-explained):",
}

// Geographic display order: left-to-right on the map
const regionDisplayOrder: Record<TooltipKey, string[]> = {
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
    providerKey: AnyRegionDataProvider,
    region: Region
): providerKey is RegionProviderWithTooltipData {
    if (!providersWithTooltipDataAsSet.has(providerKey)) return false

    // Verify the regions entry has the right definedBy field
    // This is important for cases like the "UN" suffix which could refer to
    // multiple provider schemes (e.g. un, un_m49_1, un_m49_2, un_m49_3)
    return checkIsAggregate(region) && region.definedBy === providerKey
}

export function getDescriptionForKey(key: TooltipKey): string {
    return descriptions[key]
}

export function getRegionsForKey(key: TooltipKey): TooltipRegion[] {
    const orderIndex = new Map(
        regionDisplayOrder[key].map((name, i) => [name, i])
    )

    const regions =
        key === "incomeGroups"
            ? getIncomeGroups()
            : getAggregatesByProvider(key)

    return R.pipe(
        regions,
        R.sortBy((region) => orderIndex.get(region.name) ?? Infinity),
        R.map((region) => ({
            name: region.name,
            displayName: parseLabel(region.name).name, // Strip suffix
            color: continentColorsMap[region.name],
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
