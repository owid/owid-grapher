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

const regionDataProviders = [
    ...REGION_DATA_PROVIDERS,
    ...additionalRegionDataProviders,
]
const regionDataProviderSet = new Set(regionDataProviders)

const regionGroupKeys = [
    "countries",
    "continents", // owid continents
    "incomeGroups",
    "historicalCountries", // e.g. USSR, Austria-Hungary
    ...REGION_DATA_PROVIDERS,
    ...additionalRegionDataProviders,
] as const
export type RegionGroupKey = (typeof regionGroupKeys)[number]

export interface RegionGroup {
    regionGroupKey: RegionGroupKey
    entityNames: EntityName[]
}

export type EntitiesByRegionGroup = Map<RegionGroupKey, EntityName[]>

type AnyRegionDataProvider = RegionDataProvider | AdditionalRegionDataProvider

export const regionGroupLabels: Record<RegionGroupKey, string> = {
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

function toProviderKey(
    providerSuffix: string
): AnyRegionDataProvider | undefined {
    const candidate = providerSuffix.toLowerCase().replaceAll(" ", "")
    return isRegionDataProviderKey(candidate) ? candidate : undefined
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

    const entitiesByProvider = new Map<AnyRegionDataProvider, EntityName[]>()
    for (const entityName of availableEntityNames) {
        const parsedEntityName = parseLabelWithSuffix(entityName)
        if (parsedEntityName.type === "regionWithProviderSuffix") {
            const providerKey = parsedEntityName.providerKey
            if (!entitiesByProvider.get(providerKey))
                entitiesByProvider.set(providerKey, [])
            entitiesByProvider.get(providerKey)!.push(entityName)
        }
    }

    for (const [provider, entityNames] of entitiesByProvider) {
        entitiesByRegionGroup.push({ regionGroupKey: provider, entityNames })
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

interface PlainParsedLabel {
    type: "plain"
    name: string
    suffix?: string
}

export interface RegionWithProviderSuffixParsedLabel {
    type: "regionWithProviderSuffix"
    name: string
    suffix: string
    providerKey: AnyRegionDataProvider
}

export type ParsedLabel = PlainParsedLabel | RegionWithProviderSuffixParsedLabel

export function parseLabelWithSuffix(entityName: string): ParsedLabel {
    const match = entityName.match(/^(.+)\s+\(([^)]+)\)$/)
    if (!match) return { type: "plain", name: entityName }

    const [, name, suffix] = match

    if (!suffix) return { type: "plain", name: entityName }

    const providerKey = toProviderKey(suffix)
    if (!providerKey || !isRegionDataProviderKey(providerKey))
        return { type: "plain", name, suffix }

    return {
        type: "regionWithProviderSuffix",
        name,
        suffix,
        providerKey,
    }
}

export function isRegionDataProviderKey(
    candidate: string
): candidate is AnyRegionDataProvider {
    return regionDataProviderSet.has(candidate as any)
}

export function isEntityRegionGroupKey(
    candidate: string
): candidate is RegionGroupKey {
    return regionGroupKeys.includes(candidate as any)
}
