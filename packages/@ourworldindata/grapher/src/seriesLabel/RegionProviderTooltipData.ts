import * as R from "remeda"
import {
    checkIsAggregate,
    EntityName,
    getAggregatesByProvider,
    getRegionByName,
    getRegionByShortName,
    RegionDataProvider,
} from "@ourworldindata/utils"
import { ContinentColors } from "../color/CustomSchemes.js"
import {
    AnyRegionDataProvider,
    parseLabelWithSuffix,
} from "../core/RegionGroups.js"
import { RegionProviderTooltipProps } from "./RegionProviderTooltip.js"

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

const descriptionsByKey: Record<RegionProviderWithTooltipData, string> = {
    wb: "The **World Bank (WB)** defines [seven world regions](https://ourworldindata.org/world-region-map-definitions#world-bank-wb-continents):",
    un: "The **United Nations Statistical Division (UNSD)** establishes and maintains a geoscheme based on the [M49 coding classification](https://unstats.un.org/unsd/methodology/m49). At the highest level, the M49 classification categorizes countries into [five principal regions](https://ourworldindata.org/world-region-map-definitions#united-nations-un):",
    who: "The **World Health Organization (WHO)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#world-health-organization-who):",
    unsdg: "When reporting data on the Sustainable Development Goals, the **United Nations (UN)** defines [eight world regions](https://ourworldindata.org/world-region-map-definitions#united-nations-sustainable-development-goals-un-sdg):",
    pew: "The **Pew Research Center (Pew)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#pew-research-center-pew):",
}

const chartSlugsByKey: Record<RegionProviderWithTooltipData, string> = {
    wb: "world-regions-according-to-the-world-bank",
    un: "world-regions-according-to-un",
    who: "who-regions",
    unsdg: "world-regions-sdg-united-nations",
    pew: "world-regions-according-to-pew",
}

const continentColorsMap = ContinentColors as Record<string, string>

// Geographic display order: left-to-right on the globe
const regionDisplayOrder: Record<RegionProviderWithTooltipData, string[]> = {
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
}

export function hasProviderTooltipData(
    providerKey: AnyRegionDataProvider,
    entityName: EntityName
): providerKey is RegionProviderWithTooltipData {
    if (!providersWithTooltipDataAsSet.has(providerKey)) return false

    // Verify the regions entry has the right definedBy field
    // This is important for cases like the "UN" suffix which could refer to
    // multiple provider schemes (e.g. un, un_m49_1, un_m49_2, un_m49_3)
    const region =
        getRegionByName(entityName) ?? getRegionByShortName(entityName)
    if (!region || !checkIsAggregate(region)) return false
    if (region.definedBy !== providerKey) return false

    return true
}

function getDescriptionForKey(
    providerKey: RegionProviderWithTooltipData
): string {
    return descriptionsByKey[providerKey]
}

function getThumbnailUrlForKey(
    providerKey: RegionProviderWithTooltipData
): string {
    const slug = chartSlugsByKey[providerKey]
    return `https://ourworldindata.org/grapher/${slug}.png?imType=thumbnail&imMinimal=1`
}

function getRegionsForKey(
    key: RegionProviderWithTooltipData
): RegionProviderTooltipProps["regions"] {
    const orderIndex = new Map(
        regionDisplayOrder[key].map((name, i) => [name, i])
    )

    return R.pipe(
        getAggregatesByProvider(key),
        R.map((aggregate) => {
            const parsed = parseLabelWithSuffix(aggregate.name)
            if (!parsed.providerKey) return undefined
            return {
                name: parsed.main,
                fullName: aggregate.name,
                color: continentColorsMap[aggregate.name],
            }
        }),
        R.filter(R.isDefined),
        R.sortBy((region) => orderIndex.get(region.fullName) ?? Infinity),
        R.map(({ name, color }) => ({ name, color }))
    )
}

export function getRegionProviderTooltipData(
    providerKey: RegionProviderWithTooltipData
): RegionProviderTooltipProps {
    return {
        description: getDescriptionForKey(providerKey),
        imageUrl: getThumbnailUrlForKey(providerKey),
        regions: getRegionsForKey(providerKey),
    }
}
