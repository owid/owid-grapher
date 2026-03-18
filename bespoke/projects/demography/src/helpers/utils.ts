import { MAX_AGE, OWID_AGE_GROUPS, PYRAMID_AGE_GROUPS } from "./constants"
import type { CountryData, PopulationBySex, DeathsByAgeGroup } from "./types"
import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import { QueryStatus } from "@tanstack/react-query"

export function formatPopulationValueShort(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 1,
        numberAbbreviation: "short",
    })
}

export function formatPopulationValueLong(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
        numberAbbreviation: "long",
    })
}

function parseAgeGroupBounds(ageGroup: string): {
    startAge: number
    endAge: number
} {
    if (ageGroup.endsWith("+")) {
        const start = parseInt(ageGroup, 10)
        return { startAge: start, endAge: MAX_AGE }
    }
    const [startStr, endStr] = ageGroup.split("-")
    return { startAge: parseInt(startStr, 10), endAge: parseInt(endStr, 10) }
}

/**
 * Compute the median age for a single-sex population array (indexed by age).
 * Returns the age at which cumulative population reaches 50% of the total.
 */
export function calculateMedianAge(populationByAge: number[]): number {
    let total = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        total += populationByAge[age] || 0
    }
    const half = total / 2
    let cumulative = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        cumulative += populationByAge[age] || 0
        if (cumulative >= half) return age
    }
    return 0
}

/**
 * Find which pyramid age group bucket a given single-year age falls into.
 */
export function findAgeGroup(age: number): string | undefined {
    for (const ageGroup of PYRAMID_AGE_GROUPS) {
        const { startAge, endAge } = parseAgeGroupBounds(ageGroup)
        if (age >= startAge && age <= endAge) return ageGroup
    }
    return undefined
}

export function groupByAgeRange(
    singleYearArray: number[]
): Record<string, number> {
    const grouped: Record<string, number> = {}
    for (const ageGroup of PYRAMID_AGE_GROUPS) {
        const { startAge, endAge } = parseAgeGroupBounds(ageGroup)
        let sum = 0
        for (let age = startAge; age <= Math.min(endAge, MAX_AGE); age++) {
            sum += singleYearArray[age] || 0
        }
        grouped[ageGroup] = sum
    }
    return grouped
}

export function combineStatuses(...statuses: QueryStatus[]): QueryStatus {
    if (statuses.some((status) => status === "error")) return "error"
    if (statuses.some((status) => status === "pending")) return "pending"
    return "success"
}

// -- Age group helpers --

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

export function getTotalPopulation(population: PopulationBySex): number {
    let total = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        total += (population.female[age] || 0) + (population.male[age] || 0)
    }
    return total
}
