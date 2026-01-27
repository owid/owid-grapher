import * as _ from "lodash-es"
import { EntityName } from "@ourworldindata/types"
import {
    RegionDataProvider,
    REGION_DATA_PROVIDERS,
    Country,
    excludeUndefined,
    getRegionByName,
} from "@ourworldindata/utils"
import {
    ADDITIONAL_REGION_DATA_PROVIDERS,
    AdditionalRegionDataProvider,
    isWorldEntityName,
} from "./GrapherConstants"
import * as R from "remeda"

const additionalRegionDataProviders = ADDITIONAL_REGION_DATA_PROVIDERS.filter(
    (source) => !REGION_DATA_PROVIDERS.includes(source as RegionDataProvider)
)

const entityRegionTypes = [
    "countries",
    "continents", // owid continents
    "incomeGroups",
    "historicalCountries", // e.g. USSR, Austria-Hungary
    ...REGION_DATA_PROVIDERS,
    ...additionalRegionDataProviders,
] as const
export type EntityRegionType = (typeof entityRegionTypes)[number]

export interface RegionGroup {
    regionType: EntityRegionType
    entityNames: EntityName[]
}

export type EntitiesByRegionType = Map<EntityRegionType, EntityName[]>

export const entityRegionTypeLabels: Record<EntityRegionType, string> = {
    countries: "Countries",
    continents: "Continents", // OWID-defined continents
    incomeGroups: "Income groups",
    historicalCountries: "Historical countries and regions", // e.g. USSR, Austria-Hungary

    // Regions defined by an institution, and where we have region definition about what constitutes these regions in regions.json
    who: "World Health Organization regions",
    wb: "World Bank regions",
    pew: "Pew Research Center regions",
    un: "United Nations regions",
    un_m49_1: "United Nations regions",
    un_m49_2: "United Nations regions",
    un_m49_3: "United Nations regions",

    // Regions defined by an institution, but we don't have region definitions in regions.json for these (we recognize them by their suffix)
    unsdg: "UN Sustainable Development Goals regions",
    unm49: "United Nations M49 regions",
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

export function groupEntitiesByRegionType(
    entityNames: EntityName[]
): RegionGroup[] {
    // The 'World' entity shouldn't show up in any of the groups
    const availableEntityNames = entityNames.filter(
        (entityName) => !isWorldEntityName(entityName)
    )

    // Map entities to their regions
    const availableRegions = excludeUndefined(
        availableEntityNames.map((entityName) => getRegionByName(entityName))
    )

    // Group regions by type
    const regionsGroupedByType = _.groupBy(
        availableRegions,
        (r) => r.regionType
    )

    const entitiesByRegionType: RegionGroup[] = []

    // Split countries into historical and non-historical
    const [historicalCountries, nonHistoricalCountries] = R.partition(
        regionsGroupedByType.country ?? [],
        (country) => !!(country as Country).isHistorical
    )

    // Add the 'countries' group
    if (nonHistoricalCountries.length > 0) {
        entitiesByRegionType.push({
            regionType: "countries",
            entityNames: nonHistoricalCountries.map((region) => region.name),
        })
    }

    // Add the 'continents' group
    if (regionsGroupedByType.continent) {
        entitiesByRegionType.push({
            regionType: "continents",
            entityNames: regionsGroupedByType.continent.map(
                (region) => region.name
            ),
        })
    }

    // Add the 'incomeGroups' group
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

        entitiesByRegionType.push({
            regionType: "incomeGroups",
            entityNames: incomeGroups,
        })
    }

    const entitiesByProvider = new Map<
        RegionDataProvider | AdditionalRegionDataProvider,
        EntityName[]
    >()
    for (const entityName of availableEntityNames) {
        // The regions file includes a definedBy field for aggregates,
        // which could be used here. However, non-OWID regions aren't
        // standardized, meaning we might miss some entities.
        // Instead, we rely on the convention that non-OWID regions
        // are suffixed with (provider) and check the entity name.
        const match = entityName.match(/\(([^)]+)\)$/)
        const providerCandidate = match?.[1].toLowerCase().replaceAll(" ", "")
        if (providerCandidate && isRegionDataProvider(providerCandidate)) {
            if (!entitiesByProvider.get(providerCandidate))
                entitiesByProvider.set(providerCandidate, [])
            entitiesByProvider.get(providerCandidate)!.push(entityName)
        }
    }

    for (const [provider, entityNames] of entitiesByProvider) {
        entitiesByRegionType.push({ regionType: provider, entityNames })
    }

    // Add a group for historical countries
    if (historicalCountries.length > 0) {
        entitiesByRegionType.push({
            regionType: "historicalCountries",
            entityNames: historicalCountries.map((region) => region.name),
        })
    }

    return entitiesByRegionType
}

const regionDataProviderSet = new Set([
    ...REGION_DATA_PROVIDERS,
    ...additionalRegionDataProviders,
])

export function isRegionDataProvider(
    candidate: string
): candidate is RegionDataProvider | AdditionalRegionDataProvider {
    return regionDataProviderSet.has(candidate as any)
}

export function isEntityRegionType(
    candidate: string
): candidate is EntityRegionType {
    return entityRegionTypes.includes(candidate as any)
}
