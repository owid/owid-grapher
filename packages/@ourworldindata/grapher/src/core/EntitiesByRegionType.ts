import * as _ from "lodash-es"
import { EntityName } from "@ourworldindata/types"
import {
    AggregateSource,
    aggregateSources,
    Country,
    excludeUndefined,
    getRegionByName,
} from "@ourworldindata/utils"
import { CUSTOM_REGION_SOURCE_IDS, isWorldEntityName } from "./GrapherConstants"
import * as R from "remeda"

const customAggregateSources = CUSTOM_REGION_SOURCE_IDS
type CustomAggregateSource = (typeof customAggregateSources)[number]

const entityRegionTypes = [
    "countries",
    "continents", // owid continents
    "incomeGroups",
    "historicalCountries", // e.g. USSR, Austria-Hungary
    ...aggregateSources,
    ...customAggregateSources,
] as const
export type EntityRegionType = (typeof entityRegionTypes)[number]

export interface EntityRegionTypeGroup {
    regionType: EntityRegionType
    entityNames: EntityName[]
}

export type EntityNamesByRegionType = Map<EntityRegionType, EntityName[]>

export const entityRegionTypeLabels: Record<EntityRegionType, string> = {
    countries: "Countries",
    continents: "Continents", // OWID-defined continents
    incomeGroups: "Income groups",
    historicalCountries: "Historical countries and regions", // e.g. USSR, Austria-Hungary

    // Regions defined by an institution, and where we have region definition about what constitutes these regions in regions.json
    who: "World Health Organization regions",
    wb: "World Bank regions",
    un: "United Nations regions",
    unsdg: "UN Sustainable Development Goals regions",

    // Regions defined by an institution, but we don't have region definitions in regions.json for these (we recognize them by their suffix)
    unsd: "UN Statistics Division regions",
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
    const regionsGroupedByType = _.groupBy(
        availableRegions,
        (r) => r.regionType
    )

    const entitiesByType: EntityRegionTypeGroup[] = []

    // split countries into historical and non-historical
    const [historicalCountries, nonHistoricalCountries] = R.partition(
        regionsGroupedByType.country ?? [],
        (country) => !!(country as Country).isHistorical
    )

    // add the 'countries' group
    if (nonHistoricalCountries.length > 0) {
        entitiesByType.push({
            regionType: "countries",
            entityNames: nonHistoricalCountries.map((region) => region.name),
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
        // match by name instead of relying on the regions file because
        // some charts have income groups that aren't listed in the regions
        // file, e.g. 'Lower-middle-income countries'
        const incomeGroups = availableEntityNames.filter(
            (entityName) =>
                entityName.includes("income countries") ||
                // matches 'No income group available', for example
                entityName.includes("income group")
        )

        entitiesByType.push({
            regionType: "incomeGroups",
            entityNames: incomeGroups,
        })
    }

    const entitiesBySource = new Map<
        AggregateSource | CustomAggregateSource,
        EntityName[]
    >()
    for (const entityName of availableEntityNames) {
        // The regions file includes a definedBy field for aggregates,
        // which could be used here. However, non-OWID regions aren't
        // standardized, meaning we might miss some entities.
        // Instead, we rely on the convention that non-OWID regions
        // are suffixed with (source) and check the entity name.
        const match = entityName.match(/\(([^)]+)\)$/)
        const sourceCandidate = match?.[1].toLowerCase().replaceAll(" ", "")
        if (sourceCandidate && isAggregateSource(sourceCandidate)) {
            if (!entitiesBySource.get(sourceCandidate))
                entitiesBySource.set(sourceCandidate, [])
            entitiesBySource.get(sourceCandidate)!.push(entityName)
        }
    }

    for (const [source, entityNames] of entitiesBySource) {
        entitiesByType.push({ regionType: source, entityNames })
    }

    // add a group for historical countries
    if (historicalCountries.length > 0) {
        entitiesByType.push({
            regionType: "historicalCountries",
            entityNames: historicalCountries.map((region) => region.name),
        })
    }

    return entitiesByType
}

const aggregateSourceSet = new Set([
    ...aggregateSources,
    ...customAggregateSources,
])

export function isAggregateSource(
    candidate: string
): candidate is AggregateSource | CustomAggregateSource {
    return aggregateSourceSet.has(candidate as any)
}

export function isEntityRegionType(
    candidate: string
): candidate is EntityRegionType {
    return entityRegionTypes.includes(candidate as any)
}
