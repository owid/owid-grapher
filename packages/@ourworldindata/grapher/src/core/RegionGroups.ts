import * as _ from "lodash-es"
import { EntityName } from "@ourworldindata/types"
import {
    getRegionPublishers,
    Country,
    excludeUndefined,
    getRegionByName,
    parseRegionNameSuffix,
    toPublisherLookupKey,
    type RegionPublisher,
} from "@ourworldindata/utils"
import {
    ADDITIONAL_REGION_PUBLISHERS,
    isWorldEntityName,
    type AdditionalRegionPublisher,
} from "./GrapherConstants"
import * as R from "remeda"

type OwidRegionGroup =
    | "countries"
    | "continents"
    | "incomeGroups"
    | "historicalCountries"

/** Any institution we can recognise from an entity name's suffix */
export type AnyRegionPublisher = RegionPublisher | AdditionalRegionPublisher

export type RegionGroupKey = OwidRegionGroup | AnyRegionPublisher

/**
 * The name each group of regions is shown under in the entity selector
 * and on the data tab
 */
export const regionGroupLabels: Record<RegionGroupKey, string> = {
    // OWID-defined region groups
    countries: "Countries",
    continents: "Continents", // OWID-defined continents
    incomeGroups: "Income groups",
    historicalCountries: "Historical countries and regions", // e.g. USSR, Austria-Hungary

    // Publishers whose regions are defined in regions.ts
    who: "World Health Organization regions",
    wb: "World Bank regions",
    pew: "Pew Research Center regions",
    un: "United Nations regions",
    un_m49: "United Nations M49 regions",
    un_sdg: "UN Sustainable Development Goals regions",
    iea: "International Energy Agency regions",
    ei: "Energy Institute regions",
    ember: "Ember regions",
    maddison: "Maddison Project Database regions",
    wid: "World Inequality Database regions",
    ilo: "International Labour Organization regions",
    fao: "Food and Agriculture Organization regions",
    ihme_gbd: "IHME Global Burden of Disease regions",

    // Publishers with no region definitions in regions.ts
    unsd: "UN Statistics Division regions",
    pip: "PIP regions", // World Bank’s Poverty and Inequality Platform
    gcp: "Global Carbon Project regions",
    niaid: "NIAID regions", // National Institute of Allergy and Infectious Diseases
    unicef: "UNICEF regions",
    unaids: "UNAIDS regions", // Joint United Nations Programme on HIV and AIDS
    undp: "UN Development Programme regions",
    oecd: "OECD regions", // Organisation for Economic Co-operation and Development
}

const regionGroupKeySet = new Set<string>(Object.keys(regionGroupLabels))
const regionPublisherSet = new Set<string>([
    ...getRegionPublishers(),
    ...ADDITIONAL_REGION_PUBLISHERS,
])

export interface RegionGroup {
    regionGroupKey: RegionGroupKey
    entityNames: EntityName[]
}

export type EntitiesByRegionGroup = Map<RegionGroupKey, EntityName[]>

const publishersByLookupKey = new Map<string, AnyRegionPublisher>(
    [...regionPublisherSet].map((key) => [
        toPublisherLookupKey(key),
        key as AnyRegionPublisher,
    ])
)

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

    const entitiesByRegionGroup: RegionGroup[] = []

    // Split countries into historical and non-historical
    const [historicalCountries, nonHistoricalCountries] = R.partition(
        regionsGroupedByType.country ?? [],
        (country) => !!(country as Country).isHistorical
    )

    // Add the 'countries' group
    if (nonHistoricalCountries.length > 0) {
        entitiesByRegionGroup.push({
            regionGroupKey: "countries",
            entityNames: nonHistoricalCountries.map((region) => region.name),
        })
    }

    // Add the 'continents' group
    if (regionsGroupedByType.continent) {
        entitiesByRegionGroup.push({
            regionGroupKey: "continents",
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

        entitiesByRegionGroup.push({
            regionGroupKey: "incomeGroups",
            entityNames: incomeGroups,
        })
    }

    const entitiesByPublisher = R.groupBy(
        availableEntityNames,
        (entityName) => parseLabel(entityName).publisherKey
    )

    for (const [publisher, entityNames] of R.entries(entitiesByPublisher)) {
        entitiesByRegionGroup.push({ regionGroupKey: publisher, entityNames })
    }

    // Add a group for historical countries
    if (historicalCountries.length > 0) {
        entitiesByRegionGroup.push({
            regionGroupKey: "historicalCountries",
            entityNames: historicalCountries.map((region) => region.name),
        })
    }

    return entitiesByRegionGroup
}

export interface ParsedLabel {
    raw: string // e.g. "Africa (UN)"
    name: string // e.g. "Africa"
    suffix?: string // e.g. "UN"
    publisherKey?: AnyRegionPublisher // e.g. "un"
}

export function parseLabel(raw: string): ParsedLabel {
    const parsed = parseRegionNameSuffix(raw)
    if (!parsed) return { raw, name: raw }

    const { name, suffix } = parsed
    const publisherKey = publishersByLookupKey.get(toPublisherLookupKey(suffix))
    if (!publisherKey) return { raw, name, suffix }

    return { raw, name, suffix, publisherKey }
}

export function isAnyRegionPublisher(
    candidate: string
): candidate is AnyRegionPublisher {
    return regionPublisherSet.has(candidate)
}

export function isEntityRegionGroupKey(
    candidate: string
): candidate is RegionGroupKey {
    return regionGroupKeySet.has(candidate)
}
