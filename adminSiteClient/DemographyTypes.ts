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
