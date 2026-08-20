import * as R from "remeda"
import {
    checkIsAggregate,
    EntityName,
    Aggregate,
    Continent,
    IncomeGroup,
    getAggregatesByProvider,
    getContinents,
    getIncomeGroups,
    Region,
    RegionDataProvider,
    RequiredBy,
} from "@ourworldindata/utils"
import {
    CategoricalMapPalette17,
    MapContinentColors,
} from "../color/CustomSchemes.js"
import { parseLabel } from "../core/RegionGroups.js"
import { getCountriesByRegion } from "../mapCharts/MapHelpers.js"

export type TooltipKey = RegionDataProvider | "incomeGroups" | "continents"

export interface TooltipRegion {
    name: EntityName
    displayName: string
    color: string
    members: string[]
}

const continentColorsMap = MapContinentColors as Record<EntityName, string>
const categoricalMapColors = CategoricalMapPalette17

const descriptions: Record<TooltipKey, string> = {
    wb: "The **World Bank (WB)** defines [seven world regions](https://ourworldindata.org/world-region-map-definitions#world-bank-wb-continents):",
    who: "The **World Health Organization (WHO)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#world-health-organization-who):",
    unsdg: "When reporting data on the Sustainable Development Goals, the **United Nations (UN)** defines [eight world regions](https://ourworldindata.org/world-region-map-definitions#united-nations-sustainable-development-goals-un-sdg):",
    pew: "The **Pew Research Center (Pew)** defines [six world regions](https://ourworldindata.org/world-region-map-definitions#pew-research-center-pew):",
    un: "The **United Nations Statistical Division (UNSD)** establishes and maintains a geographic classification based on the [M49 coding system](https://unstats.un.org/unsd/methodology/m49). At the highest level, the M49 classification categorizes countries into [six regions](https://ourworldindata.org/world-region-map-definitions#united-nations-un):",
    un_m49_1:
        "The **United Nations Statistical Division (UNSD)** establishes and maintains a geographic classification based on the [M49 coding system](https://unstats.un.org/unsd/methodology/m49). At the highest level, the M49 classification categorizes countries into five regions:",
    un_m49_2:
        "The **United Nations Statistical Division (UNSD)** establishes and maintains a geographic classification based on the [M49 coding system](https://unstats.un.org/unsd/methodology/m49). At level 2, the M49 classification categorizes countries into 17 regions:",
    un_m49_3:
        "The **United Nations Statistical Division (UNSD)** establishes and maintains a geographic classification based on the [M49 coding system](https://unstats.un.org/unsd/methodology/m49). At level 3, the M49 classification provides more granular subdivisions, including separate regions for parts of Africa and the Americas:",
    incomeGroups:
        "The **World Bank** defines [four income groups](https://ourworldindata.org/world-bank-income-groups-explained):",
    continents:
        "Our team defines [six world regions](https://ourworldindata.org/world-region-map-definitions#our-world-in-data):",
    iea: "The **International Energy Agency (IEA)** defines seven world regions:",
    ei: "The **Energy Institute (EI)** defines [seven world regions](https://ourworldindata.org/world-region-map-definitions#energy-institute-ei):",
    ember: "**Ember** groups countries into [seven world regions](https://ourworldindata.org/world-region-map-definitions#ember):",
    maddison:
        "The **Maddison Project Database** groups countries into [eight world regions](https://ourworldindata.org/world-region-map-definitions#maddison-project-database-maddison):",
    wid: "The **World Inequality Database (WID)** groups countries into [nine world regions](https://ourworldindata.org/world-region-map-definitions#world-inequality-database-wid):",
    ilo_1: "The **International Labour Organization (ILO)** defines [five broad world regions](https://ourworldindata.org/world-region-map-definitions#international-labour-organization-ilo):",
    ilo_2: "The **International Labour Organization (ILO)** divides the world into [eleven subregions](https://ourworldindata.org/world-region-map-definitions#international-labour-organization-ilo):",
    fao_1: "The **Food and Agriculture Organization of the United Nations (FAO)** reports data for [world regions](https://ourworldindata.org/world-region-map-definitions#food-and-agriculture-organization-fao) at several levels of detail. This map shows its broadest level, the continents:",
    fao_2: "The **Food and Agriculture Organization of the United Nations (FAO)** reports data for [world regions](https://ourworldindata.org/world-region-map-definitions#food-and-agriculture-organization-fao) at several levels of detail. This map shows its subregions:",
    fao_sdg:
        "The **Food and Agriculture Organization of the United Nations (FAO)** groups countries into [world regions](https://ourworldindata.org/world-region-map-definitions#food-and-agriculture-organization-fao) for its Sustainable Development Goals reporting:",
    ihme_gbd_1:
        "In its Global Burden of Disease study, the **Institute for Health Metrics and Evaluation (IHME)** groups countries into [seven super-regions](https://ourworldindata.org/world-region-map-definitions#institute-for-health-metrics-and-evaluation-ihme-gbd):",
    ihme_gbd_2:
        "In its Global Burden of Disease study, the **Institute for Health Metrics and Evaluation (IHME)** divides the world into [21 regions](https://ourworldindata.org/world-region-map-definitions#institute-for-health-metrics-and-evaluation-ihme-gbd), nested within its seven super-regions:",
}

// Geographic display order: left-to-right on the map.
// Providers without a custom order will be sorted alphabetically.
const customRegionDisplayOrder: Partial<Record<TooltipKey, string[]>> = {
    continents: [
        "North America",
        "South America",
        "Africa",
        "Europe",
        "Asia",
        "Oceania",
    ],
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
    un_m49_1: [
        "Americas (UN M49)",
        "Africa (UN M49)",
        "Europe (UN M49)",
        "Asia (UN M49)",
        "Oceania (UN M49)",
    ],
    un_m49_2: [
        "Northern America (UN M49)",
        "Latin America and the Caribbean (UN M49)",
        "Northern Africa (UN M49)",
        "Sub-Saharan Africa (UN M49)",
        "Southern Europe (UN M49)",
        "Western Europe (UN M49)",
        "Northern Europe (UN M49)",
        "Eastern Europe (UN M49)",
        "Western Asia (UN M49)",
        "Central Asia (UN M49)",
        "Southern Asia (UN M49)",
        "Eastern Asia (UN M49)",
        "South-eastern Asia (UN M49)",
        "Australia and New Zealand (UN M49)",
        "Melanesia (UN M49)",
        "Micronesia (UN M49)",
        "Polynesia (UN M49)",
    ],
    un_m49_3: [
        "Caribbean (UN M49)",
        "Central America (UN M49)",
        "South America (UN M49)",
        "Eastern Africa (UN M49)",
        "Middle Africa (UN M49)",
        "Southern Africa (UN M49)",
        "Western Africa (UN M49)",
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
    ei: [
        "North America (EI)",
        "South and Central America (EI)",
        "Africa (EI)",
        "Middle East (EI)",
        "Europe (EI)",
        "CIS (EI)",
        "Asia Pacific (EI)",
    ],
    iea: [
        "North America (IEA)",
        "Central and South America (IEA)",
        "Africa (IEA)",
        "Middle East (IEA)",
        "Europe (IEA)",
        "Eurasia (IEA)",
        "Asia Pacific (IEA)",
    ],
    ember: [
        "North America (Ember)",
        "Latin America and Caribbean (Ember)",
        "Africa (Ember)",
        "Middle East (Ember)",
        "Europe (Ember)",
        "Asia (Ember)",
        "Oceania (Ember)",
    ],
    maddison: [
        "Western offshoots (Maddison)",
        "Latin America (Maddison)",
        "Sub Saharan Africa (Maddison)",
        "Middle East and North Africa (Maddison)",
        "Western Europe (Maddison)",
        "Eastern Europe (Maddison)",
        "South and South East Asia (Maddison)",
        "East Asia (Maddison)",
    ],
    wid: [
        "North America (WID)",
        "Latin America (WID)",
        "Sub-Saharan Africa (WID)",
        "Middle East and North Africa (WID)",
        "Europe (WID)",
        "Russia and Central Asia (WID)",
        "South and South-East Asia (WID)",
        "East Asia (WID)",
        "Oceania (WID)",
    ],
    ilo_1: [
        "Americas (ILO)",
        "Africa (ILO)",
        "Arab States (ILO)",
        "Europe and Central Asia (ILO)",
        "Asia and the Pacific (ILO)",
    ],
    ilo_2: [
        "Northern America (ILO)",
        "Latin America and the Caribbean (ILO)",
        "Northern Africa (ILO)",
        "Sub-Saharan Africa (ILO)",
        "Arab States (ILO)",
        "Northern, Southern and Western Europe (ILO)",
        "Eastern Europe (ILO)",
        "Central and Western Asia (ILO)",
        "Southern Asia (ILO)",
        "Eastern Asia (ILO)",
        "South-Eastern Asia and the Pacific (ILO)",
    ],
    fao_1: [
        "Americas (FAO)",
        "Africa (FAO)",
        "Europe (FAO)",
        "Asia (FAO)",
        "Oceania (FAO)",
    ],
    fao_2: [
        "Northern America (FAO)",
        "Caribbean (FAO)",
        "Central America (FAO)",
        "South America (FAO)",
        "Northern Africa (FAO)",
        "Eastern Africa (FAO)",
        "Middle Africa (FAO)",
        "Southern Africa (FAO)",
        "Western Africa (FAO)",
        "Southern Europe (FAO)",
        "Western Europe (FAO)",
        "Northern Europe (FAO)",
        "Eastern Europe (FAO)",
        "Western Asia (FAO)",
        "Central Asia (FAO)",
        "Southern Asia (FAO)",
        "Eastern Asia (FAO)",
        "South-eastern Asia (FAO)",
        "Australia and New Zealand (FAO)",
        "Melanesia (FAO)",
        "Micronesia (FAO)",
        "Polynesia (FAO)",
    ],
    fao_sdg: [
        "Northern America and Europe (FAO)",
        "Latin America and the Caribbean (FAO)",
        "Sub-Saharan Africa (FAO)",
        "Western Asia and Northern Africa (FAO)",
        "Central Asia and Southern Asia (FAO)",
        "Eastern Asia and South-eastern Asia (FAO)",
        "Australia and New Zealand (FAO)",
        "Oceania excluding Australia and New Zealand (FAO)",
    ],
    ihme_gbd_1: [
        "High-income (IHME GBD)",
        "Latin America and Caribbean (IHME GBD)",
        "Sub-Saharan Africa (IHME GBD)",
        "North Africa and Middle East (IHME GBD)",
        "Central Europe, Eastern Europe, and Central Asia (IHME GBD)",
        "South Asia (IHME GBD)",
        "Southeast Asia, East Asia, and Oceania (IHME GBD)",
    ],
    ihme_gbd_2: [
        "High-income North America (IHME GBD)",
        "Caribbean (IHME GBD)",
        "Central Latin America (IHME GBD)",
        "Andean Latin America (IHME GBD)",
        "Tropical Latin America (IHME GBD)",
        "Southern Latin America (IHME GBD)",
        "Western Sub-Saharan Africa (IHME GBD)",
        "Central Sub-Saharan Africa (IHME GBD)",
        "Eastern Sub-Saharan Africa (IHME GBD)",
        "Southern Sub-Saharan Africa (IHME GBD)",
        "North Africa and Middle East (IHME GBD)",
        "Western Europe (IHME GBD)",
        "Central Europe (IHME GBD)",
        "Eastern Europe (IHME GBD)",
        "Central Asia (IHME GBD)",
        "South Asia (IHME GBD)",
        "East Asia (IHME GBD)",
        "Southeast Asia (IHME GBD)",
        "High-income Asia Pacific (IHME GBD)",
        "Australasia (IHME GBD)",
        "Oceania (IHME GBD)",
    ],
}

export function hasTooltipData(
    region: Region
): region is RequiredBy<Aggregate, "definedBy"> {
    return checkIsAggregate(region) && region.definedBy !== undefined
}

export function getDescriptionForKey(key: TooltipKey): string {
    return descriptions[key]
}

export function getRegionsForKey(key: TooltipKey): TooltipRegion[] {
    const regions =
        key === "incomeGroups"
            ? getIncomeGroups()
            : key === "continents"
              ? getContinents()
              : getAggregatesByProvider(key)

    const customOrder = customRegionDisplayOrder[key]
    const sortFn = (
        region: Aggregate | IncomeGroup | Continent
    ): number | string => {
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
