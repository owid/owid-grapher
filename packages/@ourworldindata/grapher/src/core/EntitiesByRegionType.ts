import { EntityName } from "@ourworldindata/types"
import {
    AggregateSource,
    aggregateSources,
    excludeUndefined,
    getRegionByName,
    groupBy,
} from "@ourworldindata/utils"
import { isWorldEntityName } from "./GrapherConstants"

const customAggregateSources = [
    "un",
    "fao",
    "ei",
    "pip",
    "ember",
    "gcp",
    "niaid",
    "unicef",
    "unaids",
    "undp",
    "wid",
    "oecd",
] as const
type CustomAggregateSource = (typeof customAggregateSources)[number]

export type EntityRegionType =
    | "countries"
    | "continents" // owid continents
    | "incomeGroups"
    | AggregateSource // defined in the regions file, e.g. who or wb
    | CustomAggregateSource // hard-coded for now, see above

export interface EntityRegionTypeGroup {
    regionType: EntityRegionType
    entityNames: EntityName[]
}

export type EntityNamesByRegionType = Map<EntityRegionType, EntityName[]>

export const entityRegionTypeLabels: Record<EntityRegionType, string> = {
    countries: "Countries",
    continents: "Continents", // OWID-defined continents
    incomeGroups: "Income groups",

    // Regions defined by an institution
    who: "World Health Organization regions",
    wb: "World Bank regions",
    unsd: "UN Statistics Division regions",
    un: "United Nations regions",
    fao: "FAO regions", // UN's Food and Agriculture Organization
    ei: "Education International regions",
    pip: "PIP regions", // World Bank’s Poverty and Inequality Platform
    ember: "Ember regions",
    gcp: "Global Carbon Project regions",
    niaid: "NIAID regions", // National Institute of Allergy and Infectious Diseases
    unicef: "UNICEF regions",
    unaids: "UNAIDS regions", // Joint United Nations Programme on HIV and AIDS
    undp: "UN Development Programme regions",
    wid: "World Inequality Database regions",
    oecd: "OECD regions", // Organisation for Economic Co-operation and Development
}

export function groupEntityNamesByRegionType(
    entityNames: EntityName[]
): EntityRegionTypeGroup[] {
    // the 'World' entity shouldn't show up in any of the groups
    const availableEntityNames = entityNames.filter(
        (entityName) => !isWorldEntityName(entityName)
    )

    // map entities to their regions
    const availableRegions = excludeUndefined(
        availableEntityNames.map((entityName) => getRegionByName(entityName))
    )

    // group regions by type
    const regionsGroupedByType = groupBy(availableRegions, (r) => r.regionType)

    const entitiesByType: EntityRegionTypeGroup[] = []

    // add the 'countries' group
    if (regionsGroupedByType.country) {
        entitiesByType.push({
            regionType: "countries",
            entityNames: regionsGroupedByType.country.map(
                (region) => region.name
            ),
        })
    }

    // add the 'continents' group
    if (regionsGroupedByType.continent) {
        entitiesByType.push({
            regionType: "continents",
            entityNames: regionsGroupedByType.continent.map(
                (region) => region.name
            ),
        })
    }

    // add the 'incomeGroups' group
    if (regionsGroupedByType.income_group) {
        entitiesByType.push({
            regionType: "incomeGroups",
            entityNames: regionsGroupedByType.income_group.map(
                (region) => region.name
            ),
        })
    }

    for (const source of [...aggregateSources, ...customAggregateSources]) {
        // The regions file includes a definedBy field for aggregates,
        // which could be used here. However, non-OWID regions aren't
        // standardized, meaning we might miss some entities.
        // Instead, we rely on the convention that non-OWID regions
        // are suffixed with (source) and check the entity name.
        const entityNames = availableEntityNames.filter((entityName) =>
            entityName.toLowerCase().trim().endsWith(`(${source})`)
        )
        if (entityNames.length > 0)
            entitiesByType.push({ regionType: source, entityNames })
    }

    return entitiesByType
}
