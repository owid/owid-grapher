/**
 * Data loading and preprocessing for population dynamics model.
 * Uses single-year ages (0-130) internally.
 */

const DATA_BASE_URL =
    "https://owid-public.owid.io/population-simulation-2026-03"

// Maximum age tracked (131 single-year ages: 0 to 130)
export const MAX_AGE = 130

// OWID data uses these 5-year age groups
export const OWID_AGE_GROUPS = [
    "0-4",
    "5-9",
    "10-14",
    "15-19",
    "20-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
    "55-59",
    "60-64",
    "65-69",
    "70-74",
    "75-79",
    "80-84",
    "85-89",
    "90-94",
    "95-99",
    "100+",
]

// Fertility age groups in OWID data (mothers aged 10-54)
export const FERTILITY_AGE_GROUPS = [
    "10-14",
    "15-19",
    "20-24",
    "25-29",
    "30-34",
    "35-39",
    "40-44",
    "45-49",
    "50-54",
]

// -- Types --

/** Population data indexed by year, then age group */
export type YearAgeData = Record<string, Record<string, number>>

/** Deaths data by sex, then year, then age group */
export type DeathsBySex = {
    male: Record<string, Record<string, number>>
    female: Record<string, Record<string, number>>
}

/** Migration data indexed by year */
export type MigrationData = Record<string, { net_migration_rate: number }>

/** Projection population data by sex */
export type ProjectionPopulation = {
    male: Record<string, Record<string, number>>
    female: Record<string, Record<string, number>>
}

/** Full country dataset as returned by the API / static JSON */
export interface CountryData {
    country: string
    femalePopulation: YearAgeData
    malePopulation: YearAgeData
    fertility: YearAgeData
    deaths: DeathsBySex
    migration: MigrationData
    projection: ProjectionPopulation
    projectionScenario: {
        fertility: YearAgeData
        deaths: DeathsBySex
        migration: MigrationData
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

/** Metadata from the static JSON */
interface Metadata {
    countries: string[]
    slugs: Record<string, string>
}

// -- Metadata loading (cached) --

let _metadataPromise: Promise<Metadata> | null = null

function getMetadata(): Promise<Metadata> {
    if (!_metadataPromise) {
        _metadataPromise = fetch(
            `${DATA_BASE_URL}/population-simulation.metadata.json`
        ).then((resp) => {
            if (!resp.ok)
                throw new Error(`Failed to load metadata: ${resp.statusText}`)
            return resp.json()
        })
    }
    return _metadataPromise
}

/**
 * Load all demographic data for a country from static JSON.
 */
export async function loadAllData(
    country = "United Kingdom"
): Promise<CountryData> {
    const metadata = await getMetadata()
    const slug = metadata.slugs[country]
    if (!slug) {
        throw new Error(`Unknown country: ${country}`)
    }

    const response = await fetch(
        `${DATA_BASE_URL}/population-simulation.${slug}.data.json`
    )
    if (!response.ok) {
        throw new Error(
            `Failed to load data for ${country}: ${response.statusText}`
        )
    }

    return response.json()
}

/**
 * Load list of available countries.
 */
export async function loadCountries(): Promise<string[]> {
    const metadata = await getMetadata()
    return metadata.countries
}

// -- Age group helpers --

export function getAgeGroup(age: number): string {
    if (age >= 100) return "100+"
    const lower = Math.floor(age / 5) * 5
    return `${lower}-${lower + 4}`
}

export function getAgeGroupStart(ageGroup: string): number {
    if (ageGroup === "100+") return 100
    return parseInt(ageGroup.split("-")[0])
}

/**
 * Convert OWID 5-year bin population data to single-year ages.
 * Distributes each bin evenly across its 5 component years.
 */
export function expandToSingleYearAges(
    owidRow: Record<string, number>
): number[] {
    const result = new Array(MAX_AGE + 1).fill(0)

    for (const ageGroup of OWID_AGE_GROUPS) {
        const count = owidRow[ageGroup] || 0

        if (ageGroup === "100+") {
            const perYear = count / 5
            for (let age = 100; age <= 104 && age <= MAX_AGE; age++) {
                result[age] = perYear
            }
        } else {
            const startAge = getAgeGroupStart(ageGroup)
            const perYear = count / 5
            for (
                let age = startAge;
                age < startAge + 5 && age <= MAX_AGE;
                age++
            ) {
                result[age] = perYear
            }
        }
    }

    return result
}

/**
 * Aggregate single-year age array back to OWID 5-year bins.
 */
export function aggregateToAgeGroups(
    singleYearArray: number[]
): Record<string, number> {
    const result: Record<string, number> = {}

    for (const ageGroup of OWID_AGE_GROUPS) {
        if (ageGroup === "100+") {
            let sum = 0
            for (let age = 100; age <= MAX_AGE; age++) {
                sum += singleYearArray[age] || 0
            }
            result[ageGroup] = sum
        } else {
            const startAge = getAgeGroupStart(ageGroup)
            let sum = 0
            for (let age = startAge; age < startAge + 5; age++) {
                sum += singleYearArray[age] || 0
            }
            result[ageGroup] = sum
        }
    }

    return result
}

// -- Data accessors --

export function getPopulationForYear(
    data: CountryData,
    year: number
): PopulationBySex | null {
    const femaleRow = data.femalePopulation[year]
    const maleRow = data.malePopulation[year]

    if (!femaleRow || !maleRow) return null

    return {
        female: expandToSingleYearAges(femaleRow),
        male: expandToSingleYearAges(maleRow),
    }
}

export function getFertilityForYear(
    data: CountryData,
    year: number
): number[] | null {
    const row = data.fertility[year]
    if (!row) return null

    const result = new Array(MAX_AGE + 1).fill(0)
    for (const ageGroup of FERTILITY_AGE_GROUPS) {
        const rate = row[ageGroup] || 0
        const startAge = getAgeGroupStart(ageGroup)
        for (let age = startAge; age < startAge + 5 && age <= MAX_AGE; age++) {
            result[age] = rate
        }
    }
    return result
}

export function getDeathsForYear(
    data: CountryData,
    year: number
): DeathsByAgeGroup | null {
    const femaleRow = data.deaths.female?.[year]
    const maleRow = data.deaths.male?.[year]
    if (!femaleRow && !maleRow) return null

    const result: DeathsByAgeGroup = { female: {}, male: {} }
    for (const ageGroup of OWID_AGE_GROUPS) {
        result.female[ageGroup] = femaleRow?.[ageGroup] || 0
        result.male[ageGroup] = maleRow?.[ageGroup] || 0
    }
    return result
}

export function getMigrationRateForYear(
    data: CountryData,
    year: number
): number {
    const row = data.migration[year]
    return row ? row.net_migration_rate : 0
}

// -- Mortality --

function clampProbability(value: number, min = 1e-6, max = 0.999): number {
    if (!Number.isFinite(value)) return min
    return Math.min(max, Math.max(min, value))
}

function logit(p: number): number {
    const q = clampProbability(p)
    return Math.log(q / (1 - q))
}

function invLogit(z: number): number {
    return 1 / (1 + Math.exp(-z))
}

/**
 * Apply a Kannisto-like old-age closure so mortality rises smoothly and monotonically.
 */
export function applyOldAgeClosure(rates: number[], sex: string): number[] {
    const closed = [...rates]
    const startAge = 85
    const anchorAge = 100

    const qStartObserved = closed[startAge] ?? closed[80] ?? 0.05
    const qAnchorObserved =
        closed[anchorAge] ?? closed[95] ?? (sex === "female" ? 0.55 : 0.6)

    const qStart = clampProbability(qStartObserved, 1e-5, 0.98)
    const qAnchor = clampProbability(
        Math.max(qAnchorObserved, qStart + 0.01),
        qStart + 1e-5,
        0.995
    )

    let slope = (logit(qAnchor) - logit(qStart)) / (anchorAge - startAge)
    if (!Number.isFinite(slope) || slope < 0.005) {
        slope = 0.005
    }

    const intercept = logit(qStart)
    let prev = qStart

    for (let age = startAge; age <= MAX_AGE; age++) {
        let qx = invLogit(intercept + slope * (age - startAge))
        qx = clampProbability(Math.max(qx, prev), 1e-6, 0.999)
        closed[age] = qx
        prev = qx
    }

    return closed
}

export function calculateMortalityRates(
    deaths: DeathsByAgeGroup,
    femalePop: number[],
    malePop: number[]
): MortalityRates {
    const result: MortalityRates = {
        female: new Array(MAX_AGE + 1).fill(0),
        male: new Array(MAX_AGE + 1).fill(0),
    }

    for (const sex of ["female", "male"] as const) {
        const pop = sex === "female" ? femalePop : malePop
        const sexDeaths = deaths[sex] || {}
        const groupRates: Record<string, number> = {}

        for (const ageGroup of OWID_AGE_GROUPS) {
            const startAge = getAgeGroupStart(ageGroup)
            const endAge =
                ageGroup === "100+" ? Math.min(104, MAX_AGE) : startAge + 4

            let totalPop = 0
            for (let age = startAge; age <= endAge; age++) {
                totalPop += pop[age] || 0
            }

            const deathCount = sexDeaths[ageGroup] || 0
            groupRates[ageGroup] =
                totalPop > 0 ? Math.min(deathCount / totalPop, 1.0) : 0
        }

        for (let age = 0; age <= MAX_AGE; age++) {
            const ageGroup = getAgeGroup(age)
            result[sex][age] = groupRates[ageGroup] || 0
        }

        result[sex] = applyOldAgeClosure(result[sex], sex)
    }

    return result
}

// -- Totals --

export function getTotalPopulation(population: PopulationBySex): number {
    let total = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        total += (population.female[age] || 0) + (population.male[age] || 0)
    }
    return total
}

export function getRawPopulationForYear(
    data: CountryData,
    year: number
): { female: Record<string, number>; male: Record<string, number> } {
    return {
        female: data.femalePopulation[year],
        male: data.malePopulation[year],
    }
}

// -- UN WPP projection scenario data accessors --

export function getProjectionFertilityForYear(
    data: CountryData,
    year: number
): number[] | null {
    const row = data.projectionScenario?.fertility?.[year]
    if (!row) return null

    const result = new Array(MAX_AGE + 1).fill(0)
    for (const ageGroup of FERTILITY_AGE_GROUPS) {
        const rate = row[ageGroup] || 0
        const startAge = getAgeGroupStart(ageGroup)
        for (let age = startAge; age < startAge + 5 && age <= MAX_AGE; age++) {
            result[age] = rate
        }
    }
    return result
}

export function getProjectionDeathsForYear(
    data: CountryData,
    year: number
): DeathsByAgeGroup | null {
    const femaleRow = data.projectionScenario?.deaths?.female?.[year]
    const maleRow = data.projectionScenario?.deaths?.male?.[year]
    if (!femaleRow && !maleRow) return null

    const result: DeathsByAgeGroup = { female: {}, male: {} }
    for (const ageGroup of OWID_AGE_GROUPS) {
        result.female[ageGroup] = femaleRow?.[ageGroup] || 0
        result.male[ageGroup] = maleRow?.[ageGroup] || 0
    }
    return result
}

export function getProjectionMigrationRateForYear(
    data: CountryData,
    year: number
): number {
    const row = data.projectionScenario?.migration?.[year]
    return row ? row.net_migration_rate : 0
}

export function getProjectionPopulationForYear(
    data: CountryData,
    year: number
): PopulationBySex | null {
    const femaleRow = data.projection?.female?.[year]
    const maleRow = data.projection?.male?.[year]

    if (!femaleRow || !maleRow) return null

    return {
        female: expandToSingleYearAges(femaleRow),
        male: expandToSingleYearAges(maleRow),
    }
}
