type CountryName = string
type CountrySlug = string

type Year = string
type AgeGroup = string

export interface DemographyMetadata {
    countries: CountryName[]
    slugs: Record<CountryName, CountrySlug>
}

type ByYearAndAgeGroup = Record<Year, Record<AgeGroup, number>>
type BySexAndYearAndAgeGroup = Record<"male" | "female", ByYearAndAgeGroup>

export type MigrationByYear = Record<Year, { net_migration_rate: number }>

export interface CountryData {
    country: string
    femalePopulation: ByYearAndAgeGroup
    malePopulation: ByYearAndAgeGroup
    fertility: ByYearAndAgeGroup
    deaths: BySexAndYearAndAgeGroup
    migration: MigrationByYear
    projection: BySexAndYearAndAgeGroup
    projectionScenario: {
        fertility: ByYearAndAgeGroup
        deaths: BySexAndYearAndAgeGroup
        migration: MigrationByYear
    }
}

/** Single-year population by sex */
export interface PopulationBySex {
    female: number[]
    male: number[]
}

/** Deaths by sex and age group */
export interface DeathsByAgeGroup {
    female: Record<string, number>
    male: Record<string, number>
}

/** Mortality rates by sex (single-year ages) */
export interface MortalityRates {
    female: number[]
    male: number[]
}

export const PARAMETER_KEYS = [
    "fertilityRate",
    "lifeExpectancy",
    "netMigrationRate",
] as const

export type ParameterKey = (typeof PARAMETER_KEYS)[number]

export function isValidParameterKey(value: unknown): value is ParameterKey {
    return (
        typeof value === "string" &&
        PARAMETER_KEYS.includes(value as ParameterKey)
    )
}
