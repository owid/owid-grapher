import { regionsData } from "./regions.data.js"

export type RegionType =
    | "country"
    | "other"
    | "aggregate"
    | "continent"
    | "income_group"

// Derive literal union types from the generated data
type RegionEntry = (typeof regionsData)[number]
type ContinentEntry = Extract<RegionEntry, { regionType: "continent" }>
type IncomeGroupEntry = Extract<RegionEntry, { regionType: "income_group" }>
type AggregateEntryWithPublisher = Extract<
    RegionEntry,
    { regionType: "aggregate"; definedBy: string; publisher: string }
>

export type OwidContinentName = ContinentEntry["name"]
export type OwidContinentCode = ContinentEntry["code"]

export type OwidIncomeGroupName = IncomeGroupEntry["name"]
export type OwidIncomeGroupCode = IncomeGroupEntry["code"]

export type RegionSet = AggregateEntryWithPublisher["definedBy"]
export type RegionPublisher = AggregateEntryWithPublisher["publisher"]
export type SuffixedRegionName = AggregateEntryWithPublisher["name"]

export interface BaseRegion {
    regionType: RegionType
    name: string
    code: string
    slug: string
    shortName?: string
}

export interface Country extends BaseRegion {
    regionType: "country" | "other"
    shortCode?: string
    isMappable?: boolean
    isHistorical?: boolean
    isUnlisted?: boolean
    variantNames?: readonly string[]
    article?: string
}

export interface Aggregate extends BaseRegion {
    regionType: "aggregate"
    definedBy?: RegionSet
    publisher?: RegionPublisher
    translationCodes?: readonly string[]
    members: readonly string[]
}

export interface AggregateWithPublisher extends Aggregate {
    definedBy: RegionSet
    publisher: RegionPublisher
}

export interface Continent extends BaseRegion {
    regionType: "continent"
    name: OwidContinentName
    code: OwidContinentCode
    translationCodes?: readonly string[]
    members: readonly string[]
}

export interface IncomeGroup extends BaseRegion {
    regionType: "income_group"
    name: OwidIncomeGroupName
    code: OwidIncomeGroupCode
    members: readonly string[]
}

export type Region = Country | Aggregate | Continent | IncomeGroup

export interface RegionNameSuffix {
    /** The name without its suffix, e.g. "Africa" */
    name: string
    /** The suffix as spelled, e.g. "IHME GBD" */
    suffix: string
    /** The key that spelling canonicalises to, e.g. "ihme_gbd" */
    publisherKey: string
}
