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
type AggregateEntryWithDefinedBy = Extract<
    RegionEntry,
    { regionType: "aggregate"; definedBy: string }
>

export type OwidContinentName = ContinentEntry["name"]
export type OwidContinentCode = ContinentEntry["code"]

export type OwidIncomeGroupName = IncomeGroupEntry["name"]
export type OwidIncomeGroupCode = IncomeGroupEntry["code"]

export type RegionDataProvider = AggregateEntryWithDefinedBy["definedBy"]

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
    definedBy?: RegionDataProvider
    translationCodes?: readonly string[]
    members: readonly string[]
}

export interface AggregateWithDefinedBy extends Aggregate {
    definedBy: RegionDataProvider
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
